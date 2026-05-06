"""
AirDate — Cognito PostAuthentication Trigger
Lambda: airdate-post-auth-trigger

Fires automatically every time a user signs in to either pool.
Writes a session record to DynamoDB airdate-sessions table.
TTL = 24 hours — DynamoDB auto-deletes stale sessions.

Setup:
  1. Deploy this Lambda
  2. Cognito Console → User Pool → User Pool Properties → Add Lambda Trigger
     → Authentication → Post Authentication → select this Lambda
  3. Repeat for BOTH pools (prod + dev)

Required IAM permissions on this Lambda's role:
  - dynamodb:PutItem on arn:aws:dynamodb:us-east-1:*:table/airdate-sessions
"""

import boto3
import time
import logging
import json

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamo = boto3.resource('dynamodb', region_name='us-east-1')
table  = dynamo.Table('airdate-sessions')


def lambda_handler(event, context):
    logger.info('PostAuth event: ' + json.dumps(event)[:300])

    try:
        attrs     = event.get('request', {}).get('userAttributes', {})
        pool_id   = event.get('userPoolId', '')
        username  = event.get('userName', '')
        now       = int(time.time())

        pool_label = 'dev' if 'LIdVq7KLY' in pool_id else 'prod'
        domain     = 'dev.airdate.tv' if pool_label == 'dev' else 'airdate.tv'

        item = {
            'sub':          attrs.get('sub', username),
            'username':     username,
            'email':        attrs.get('email', ''),
            'name':         attrs.get('name', attrs.get('given_name', '')),
            'pool':         pool_id,
            'pool_label':   pool_label,
            'domain':       domain,
            'lastSignIn':   now,
            'lastSignInISO': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(now)),
            'ttl':          now + (24 * 60 * 60),  # 24h auto-expiry
        }

        table.put_item(Item=item)
        logger.info('Session recorded for ' + attrs.get('email', username))

    except Exception as e:
        logger.error('Failed to record session: ' + str(e))
        # IMPORTANT: always return the event — never block sign-in
        # even if session tracking fails

    # Must return event unchanged or Cognito will reject the login
    return event
