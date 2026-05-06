import json, time, boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME          = "airdate-users"
NOTIFICATIONS_TABLE = "airdate-notifications"
FREE_TIER_LIMIT     = 5
HISTORY_LIMIT       = 50
RENEWAL_TABLE       = "airdate-renewal-predictions"

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

_table       = None
_notif_table = None

def get_table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb", region_name="us-east-1").Table(TABLE_NAME)
    return _table

def get_notif_table():
    global _notif_table
    if _notif_table is None:
        _notif_table = boto3.resource("dynamodb", region_name="us-east-1").Table(NOTIFICATIONS_TABLE)
    return _notif_table

def ok(body, status=200):
    from decimal import Decimal
    def _default(o):
        if isinstance(o, Decimal): return int(o) if o % 1 == 0 else float(o)
        raise TypeError()
    return {"statusCode": status, "headers": HEADERS, "body": json.dumps(body, default=_default)}

def err(msg, status=400):
    return {"statusCode": status, "headers": HEADERS, "body": json.dumps({"error": msg})}

def extract_sub(event):
    try:
        import base64
        auth = event.get("headers", {}).get("Authorization", "") or \
               event.get("headers", {}).get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        seg = auth.split(" ", 1)[1].split(".")[1]
        seg += "=" * (4 - len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg)).get("sub")
    except Exception:
        return None

def get_user(uid):
    return get_table().get_item(Key={"user_id": uid}).get("Item")

def ensure_user(uid, email="", tier="free"):
    user = get_user(uid)
    if not user:
        now  = int(time.time())
        user = {
            "user_id": uid, "email": email, "tier": tier,
            "watchlist": [], "history": [],
            "preferences": {"networks": [], "genres": [], "notifications": False},
            "created_at": now, "updated_at": now,
        }
        get_table().put_item(Item=user)
    return user

def handle_get_user(uid, token_sub):
    if uid != token_sub:
        return err("Forbidden", 403)
    user = ensure_user(uid)
    return ok({k: user.get(k) for k in
               ["user_id","email","tier","watchlist","history","preferences",
                "cancel_at_period_end","subscription_period_end",
                "created_at","updated_at"]})

def handle_add_pulse(uid, token_sub, body):
    if uid != token_sub:
        return err("Forbidden", 403)
    show = body.get("show", {})
    if not show.get("id"):
        return err("Missing show.id")
    show_id   = str(show["id"])
    user      = ensure_user(uid, body.get("email",""), body.get("tier","free"))
    watchlist = user.get("watchlist", [])
    tier      = user.get("tier", "free")
    if tier == "free" and len(watchlist) >= FREE_TIER_LIMIT:
        if not any(str(w.get("id")) == show_id for w in watchlist):
            return err("FREEMIUM_LIMIT", 402)
    if any(str(w.get("id")) == show_id for w in watchlist):
        return ok({"watchlist": watchlist, "action": "already_tracked"})
    show["added_at"] = int(time.time())
    watchlist.append(show)
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="SET watchlist = :wl, updated_at = :ts",
        ExpressionAttributeValues={":wl": watchlist, ":ts": int(time.time())}
    )
    return ok({"watchlist": watchlist, "action": "added"})

def handle_remove_pulse(uid, token_sub, show_id):
    if uid != token_sub:
        return err("Forbidden", 403)
    user = get_user(uid)
    if not user:
        return err("User not found", 404)
    watchlist = [w for w in user.get("watchlist", []) if str(w.get("id")) != str(show_id)]
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="SET watchlist = :wl, updated_at = :ts",
        ExpressionAttributeValues={":wl": watchlist, ":ts": int(time.time())}
    )
    return ok({"watchlist": watchlist, "action": "removed"})

def handle_add_history(uid, token_sub, body):
    if uid != token_sub:
        return err("Forbidden", 403)
    show = body.get("show", {})
    if not show.get("id"):
        return err("Missing show.id")
    user    = ensure_user(uid)
    history = [h for h in user.get("history", []) if str(h.get("id")) != str(show["id"])]
    history.insert(0, {
        "id": str(show["id"]), "title": show.get("title",""),
        "poster": show.get("poster",""), "network": show.get("network",""),
        "visited_at": int(time.time()),
    })
    history = history[:HISTORY_LIMIT]
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="SET history = :h, updated_at = :ts",
        ExpressionAttributeValues={":h": history, ":ts": int(time.time())}
    )
    return ok({"history": history, "action": "recorded"})

# Replace handle_update_preferences in airdate-user-data/lambda_function.py

def handle_update_preferences(uid, token_sub, body):
    if uid != token_sub:
        return err("Forbidden", 403)
    prefs = body.get("preferences", {})

    # Validate alertDays — must be one of the allowed values
    raw_alert_days = prefs.get("alertDays", 1)
    try:
        alert_days = int(raw_alert_days)
        if alert_days not in {0, 1, 3, 7}:
            alert_days = 1
    except (ValueError, TypeError):
        alert_days = 1

    safe = {
        "networks":      prefs.get("networks", [])[:20],
        "genres":        prefs.get("genres", [])[:10],
        "notifications": bool(prefs.get("notifications", False)),
        "alertDays":     alert_days,
    }
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="SET preferences = :p, updated_at = :ts",
        ExpressionAttributeValues={":p": safe, ":ts": int(time.time())}
    )
    return ok({"preferences": safe, "action": "updated"})

def handle_save_push_subscription(uid, token_sub, body):
    if uid != token_sub:
        return err("Forbidden", 403)
    subscription = body.get("subscription")
    if not subscription:
        return err("Missing subscription")
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="SET pushSubscription = :s, updated_at = :ts",
        ExpressionAttributeValues={":s": subscription, ":ts": int(time.time())}
    )
    return ok({"action": "subscription_saved"})

def handle_delete_push_subscription(uid, token_sub):
    if uid != token_sub:
        return err("Forbidden", 403)
    get_table().update_item(
        Key={"user_id": uid},
        UpdateExpression="REMOVE pushSubscription SET updated_at = :ts",
        ExpressionAttributeValues={":ts": int(time.time())}
    )
    return ok({"action": "subscription_deleted"})

# ── Get user notifications (read-only — does NOT auto-mark as read) ────────────
def handle_get_notifications(uid, token_sub):
    if uid != token_sub:
        return err("Forbidden", 403)
    try:
        table  = get_notif_table()
        resp   = table.query(
            KeyConditionExpression=Key("user_id").eq(uid),
            ScanIndexForward=False,
            Limit=20,
        )
        items        = resp.get("Items", [])
        unread_count = sum(1 for i in items if not i.get("read", False))

        # ── REMOVED: auto-mark-as-read on fetch ──────────────────────────────
        # Read state is only updated by explicit user action:
        #   PUT /user/{sub}/notifications/read-all   (airdate-notifications)
        #   PUT /user/{sub}/notifications/{id}/read  (airdate-notifications)
        # ─────────────────────────────────────────────────────────────────────

        return ok({
            "notifications": items,
            "unread_count":  unread_count,
        })
    except Exception as e:
        return err(f"Notifications error: {str(e)}", 500)

def handle_get_renewal(show_id):
    try:
        table  = boto3.resource("dynamodb", region_name="us-east-1").Table(RENEWAL_TABLE)
        result = table.get_item(Key={"show_id": show_id})
        item   = result.get("Item")
        if not item:
            return err("No prediction found", 404)
        return ok(dict(item))
    except Exception as e:
        return err(str(e), 500)

def lambda_handler(event, context):
    method = (event.get("requestContext") or {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
    path   = event.get("rawPath") or event.get("path", "")
    params = event.get("pathParameters") or {}

    if method == "OPTIONS":
        return ok({})

    # Public endpoints — no auth required
    if method == "GET" and "/renewal/" in path:
        show_id = path.split("/renewal/")[-1].strip("/")
        return handle_get_renewal(show_id)

    token_sub = extract_sub(event)
    if not token_sub:
        return err("Unauthorized", 401)

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}

    uid     = params.get("sub") or params.get("user_id", "")
    show_id = params.get("show_id", "")

    # ── Route table ───────────────────────────────────────────────────────────
    if method == "GET"    and uid and "/notifications" in path:   return handle_get_notifications(uid, token_sub)
    if method == "GET"    and uid and not show_id:                 return handle_get_user(uid, token_sub)
    if method == "POST"   and "/pulse" in path and not show_id:    return handle_add_pulse(uid, token_sub, body)
    if method == "DELETE" and "/pulse/" in path and show_id:       return handle_remove_pulse(uid, token_sub, show_id)
    if method == "POST"   and "/history" in path:                  return handle_add_history(uid, token_sub, body)
    if method == "PUT"    and "/preferences" in path:              return handle_update_preferences(uid, token_sub, body)
    if method == "POST"   and "/push-subscription" in path: return handle_save_push_subscription(uid, token_sub, body)
    if method == "DELETE" and "/push-subscription" in path: return handle_delete_push_subscription(uid, token_sub)

    return err(f"No route: {method} {path}", 404)
