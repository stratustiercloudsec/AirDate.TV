"""
AirDate Admin — Lambda: airdate-admin-users
v4: Complete stable version.
    - listUsers enriches Last Active from DynamoDB sessions (safe fallback)
    - getActiveSessions / getSessionStats for Active Sessions view
    - clearSession revokes Cognito tokens + deletes DynamoDB record
    - AdminUserGlobalSignOut added to clearSession for true force sign-out
"""

import json
import boto3
import logging
import time
from boto3.dynamodb.conditions import Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

POOL_MAP = {
    'us-east-1_J62LRXqEx': 'prod',
    'us-east-1_LIdVq7KLY': 'dev',
    'us-east-1_6lLVVlzzk': 'staff',
}
DEFAULT_POOL = 'us-east-1_J62LRXqEx'

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

cognito        = boto3.client('cognito-idp', region_name='us-east-1')
dynamo         = boto3.resource('dynamodb', region_name='us-east-1')
sessions_table = dynamo.Table('airdate-sessions')


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_pool_id(body):
    pool_id = body.get('poolId', DEFAULT_POOL)
    if pool_id not in POOL_MAP:
        raise ValueError('Unknown poolId: ' + pool_id)
    return pool_id


def attr_val(attrs, name):
    for a in attrs:
        if a.get('Name') == name:
            return a.get('Value', '')
    return ''


def ok(body):
    return {
        'statusCode': 200,
        'headers': HEADERS,
        'body': json.dumps(body, default=str),
    }


def err(code, msg):
    return {
        'statusCode': code,
        'headers': HEADERS,
        'body': json.dumps({'error': msg}),
    }


# ─── Session helpers ──────────────────────────────────────────────────────────

def get_all_sessions(pool_id):
    """
    Scan sessions table and return dict keyed by sub.
    Safe — always returns {} on error so user listing is never blocked.
    """
    try:
        now  = int(time.time())
        resp = sessions_table.scan(
            FilterExpression=Attr('pool').eq(pool_id) & Attr('ttl').gt(now)
        )
        sessions = {}
        for item in resp.get('Items', []):
            sub = item.get('sub', '')
            if sub:
                sessions[sub] = item
        return sessions
    except Exception as e:
        logger.warning('Session enrichment skipped: ' + str(e))
        return {}


def enrich_with_since_label(items):
    """Add human-readable sinceLabel and secondsSinceSignIn to session items."""
    now = int(time.time())
    for item in items:
        last = int(item.get('lastSignIn', 0))
        diff = now - last
        if diff < 3600:
            item['sinceLabel'] = str(int(diff / 60)) + 'm ago'
        elif diff < 86400:
            item['sinceLabel'] = str(int(diff / 3600)) + 'h ago'
        else:
            item['sinceLabel'] = str(int(diff / 86400)) + 'd ago'
        item['secondsSinceSignIn'] = diff
    return items


# ─── User serializer ──────────────────────────────────────────────────────────

def serialize_user(u, session=None):
    attrs = u.get('Attributes', u.get('UserAttributes', []))
    sub   = attr_val(attrs, 'sub')

    # Prefer DynamoDB lastSignInISO — it's the real sign-in time.
    # Fall back to Cognito UserLastModifiedDate when no session exists yet.
    if session and session.get('lastSignInISO'):
        last_active     = session['lastSignInISO']
        last_active_src = 'session'
    else:
        last_active     = str(u.get('UserLastModifiedDate', ''))
        last_active_src = 'cognito'

    return {
        'Username':             u.get('Username', ''),
        'UserStatus':           u.get('UserStatus', 'UNKNOWN'),
        'Enabled':              u.get('Enabled', True),
        'UserCreateDate':       str(u.get('UserCreateDate', '')),
        'UserLastModifiedDate': str(u.get('UserLastModifiedDate', '')),
        'LastActive':           last_active,
        'LastActiveSrc':        last_active_src,
        'Attributes': [
            {'Name': 'sub',            'Value': sub},
            {'Name': 'email',          'Value': attr_val(attrs, 'email')},
            {'Name': 'email_verified', 'Value': attr_val(attrs, 'email_verified')},
            {'Name': 'name',           'Value': attr_val(attrs, 'name')},
        ],
    }


# ─── Actions ─────────────────────────────────────────────────────────────────

def list_users(pool_id, filter_expr=None, limit=60):
    """List Cognito users, enriched with real last sign-in time from DynamoDB."""
    kwargs = {'UserPoolId': pool_id, 'Limit': min(int(limit), 60)}
    if filter_expr:
        kwargs['Filter'] = filter_expr

    cognito_users = []
    token = None
    while True:
        if token:
            kwargs['PaginationToken'] = token
        resp  = cognito.list_users(**kwargs)
        cognito_users.extend(resp.get('Users', []))
        token = resp.get('PaginationToken')
        if not token:
            break

    # Safe enrichment — never blocks user listing
    sessions = get_all_sessions(pool_id)
    logger.info('Enriching ' + str(len(cognito_users)) + ' users with ' +
                str(len(sessions)) + ' sessions from DynamoDB')

    result = []
    for u in cognito_users:
        sub     = attr_val(u.get('Attributes', []), 'sub')
        session = sessions.get(sub)
        result.append(serialize_user(u, session))

    return result


def get_active_sessions(pool_id):
    """Return all non-expired sessions for the given pool, sorted newest first."""
    now  = int(time.time())
    resp = sessions_table.scan(
        FilterExpression=Attr('pool').eq(pool_id) & Attr('ttl').gt(now)
    )
    items = enrich_with_since_label(resp.get('Items', []))
    items.sort(key=lambda x: x.get('lastSignIn', 0), reverse=True)
    return items


def get_session_stats(pool_id):
    """Return session counts broken down by time bucket."""
    now  = int(time.time())
    resp = sessions_table.scan(
        FilterExpression=Attr('pool').eq(pool_id) & Attr('ttl').gt(now)
    )
    items = resp.get('Items', [])

    def count_since(ts):
        return sum(1 for i in items if int(i.get('lastSignIn', 0)) >= ts)

    return {
        'total':   len(items),
        'last1h':  count_since(now - 3600),
        'last24h': count_since(now - 86400),
        'last7d':  count_since(now - 7  * 86400),
        'last30d': count_since(now - 30 * 86400),
        'poolId':  pool_id,
    }


def clear_session(pool_id, sub, username):
    """
    Force sign-out a user:
    1. AdminUserGlobalSignOut — revokes all Cognito refresh tokens immediately
    2. Delete DynamoDB session record
    Access token remains valid until expiry (default 1h — reduce in App client settings).
    """
    # Step 1: Revoke Cognito tokens
    if username:
        try:
            cognito.admin_user_global_sign_out(
                UserPoolId=pool_id,
                Username=username,
            )
            logger.info('Cognito tokens revoked for: ' + username)
        except Exception as e:
            logger.warning('Could not revoke Cognito tokens: ' + str(e))

    # Step 2: Remove DynamoDB session record
    sessions_table.delete_item(Key={'sub': sub})

    return {
        'success':  True,
        'sub':      sub,
        'username': username,
        'action':   'session_cleared',
    }


# ─── Handler ──────────────────────────────────────────────────────────────────

def lambda_handler(event, context):
    # CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return ok({})

    logger.info('Event: ' + json.dumps(event)[:300])

    try:
        raw  = event.get('body', '{}')
        body = json.loads(raw) if isinstance(raw, str) else (raw or {})

        pool_id  = get_pool_id(body)
        action   = body.get('action', 'listUsers')
        username = body.get('username', '')
        sub      = body.get('sub', '')

        logger.info('Action=' + action + ' Pool=' + pool_id)

        # ── Cognito user management ───────────────────────────────────────────
        if action == 'listUsers':
            users = list_users(
                pool_id,
                filter_expr=body.get('filter'),
                limit=body.get('limit', 60),
            )
            return ok({'users': users, 'count': len(users), 'poolId': pool_id})

        elif action == 'getUser':
            if not username:
                return err(400, 'username required')
            resp = cognito.admin_get_user(UserPoolId=pool_id, Username=username)
            return ok({'user': serialize_user(resp)})

        elif action == 'disableUser':
            if not username:
                return err(400, 'username required')
            cognito.admin_disable_user(UserPoolId=pool_id, Username=username)
            return ok({'success': True, 'action': 'disabled', 'username': username})

        elif action == 'enableUser':
            if not username:
                return err(400, 'username required')
            cognito.admin_enable_user(UserPoolId=pool_id, Username=username)
            return ok({'success': True, 'action': 'enabled', 'username': username})

        elif action == 'deleteUser':
            if not username:
                return err(400, 'username required')
            cognito.admin_delete_user(UserPoolId=pool_id, Username=username)
            return ok({'success': True, 'action': 'deleted', 'username': username})

        # ── Session management ────────────────────────────────────────────────
        elif action == 'getActiveSessions':
            sessions = get_active_sessions(pool_id)
            return ok({'sessions': sessions, 'count': len(sessions), 'poolId': pool_id})

        elif action == 'getSessionStats':
            return ok(get_session_stats(pool_id))

        elif action == 'clearSession':
            if not sub:
                return err(400, 'sub required')
            return ok(clear_session(pool_id, sub, username))

        else:
            return err(400, 'Unknown action: ' + action)

    except ValueError as e:
        return err(400, str(e))
    except Exception as e:
        logger.error('Error: ' + str(e), exc_info=True)
        return err(500, str(e))