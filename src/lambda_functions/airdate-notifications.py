import json
import logging
import boto3
import os
import time
from datetime import datetime, timezone
from typing import List, Dict
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ses    = boto3.client("ses",        region_name="us-east-1")
dynamo = boto3.resource("dynamodb", region_name="us-east-1")

NOTIFICATIONS_TABLE = os.environ.get("NOTIFICATIONS_TABLE", "airdate-notifications")
FROM_EMAIL          = os.environ.get("FROM_EMAIL", "operations@stratustierlabs.com")
NOTIFICATION_TTL    = 30 * 86400

CORS_HEADERS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Content-Type":                 "application/json",
}


# ─────────────────────────────────────────────
# HTTP ROUTING  (API Gateway HTTP API v2 + direct invocation)
# ─────────────────────────────────────────────

def lambda_handler(event, context):
    # Support both HTTP API v2 (requestContext.http.method)
    # and REST API v1 (httpMethod) and direct scheduler invocation
    http_ctx = event.get("requestContext", {}).get("http", {})
    method   = http_ctx.get("method") or event.get("httpMethod", "")

    # Direct invocation from scheduler — no HTTP method present
    if not method:
        return handle_send_email(event)

    # rawPath for HTTP API v2, path for REST API v1
    path   = event.get("rawPath") or event.get("path", "")
    params = event.get("pathParameters") or {}

    logger.info(f"HTTP {method} {path} | params={params}")

    # CORS pre-flight
    if method == "OPTIONS":
        return _resp(200, {})

    # GET /user/{sub}/notifications
    if method == "GET" and "notifications" in path:
        return handle_get_notifications(params.get("sub", ""))

    # PUT /user/{sub}/notifications/read-all
    if method == "PUT" and path.endswith("read-all"):
        return handle_mark_all_read(params.get("sub", ""))

    # PUT /user/{sub}/notifications/{id}/read
    # created_at comes from request body — avoids URL encoding issues with ISO timestamps
    if method == "PUT" and path.endswith("read") and "read-all" not in path:
        return handle_mark_one_read(params.get("sub", ""), event)

    return _resp(404, {"error": "Route not found"})


# ─────────────────────────────────────────────
# GET  /user/{sub}/notifications
# ─────────────────────────────────────────────

def handle_get_notifications(user_id: str):
    if not user_id:
        return _resp(400, {"error": "Missing user sub"})

    try:
        table  = dynamo.Table(NOTIFICATIONS_TABLE)
        result = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=False,   # newest first
            Limit=50
        )
        items = result.get("Items", [])

        # Count unread for bell badge
        unread_count = sum(1 for n in items if not n.get("read", False))

        return _resp(200, {
            "notifications": items,
            "unread_count":  unread_count,
            "total":         len(items),
        })

    except Exception as e:
        logger.error(f"Failed to fetch notifications for {user_id}: {e}")
        return _resp(500, {"error": str(e)})


# ─────────────────────────────────────────────
# PUT  /user/{sub}/notifications/read-all
# ─────────────────────────────────────────────

def handle_mark_all_read(user_id: str):
    if not user_id:
        return _resp(400, {"error": "Missing user sub"})

    try:
        table  = dynamo.Table(NOTIFICATIONS_TABLE)

        # Use Attr() — avoids reserved word issues with "read"
        result = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
            FilterExpression=Attr("read").eq(False),
        )
        unread = result.get("Items", [])

        with table.batch_writer() as batch:
            for item in unread:
                batch.put_item(Item={**item, "read": True})

        logger.info(f"Marked {len(unread)} notifications read for {user_id}")
        return _resp(200, {"updated": len(unread)})

    except Exception as e:
        logger.error(f"Failed to mark all read for {user_id}: {e}")
        return _resp(500, {"error": str(e)})


# ─────────────────────────────────────────────
# PUT  /user/{sub}/notifications/{id}/read
# created_at comes from request body (not path param) to avoid
# URL encoding issues with ISO 8601 timestamps containing colons
# ─────────────────────────────────────────────

def handle_mark_one_read(user_id: str, event: dict):
    if not user_id:
        return _resp(400, {"error": "Missing user sub"})

    try:
        body       = json.loads(event.get("body") or "{}")
        created_at = body.get("created_at", "")
    except (json.JSONDecodeError, TypeError):
        return _resp(400, {"error": "Invalid request body"})

    if not created_at:
        return _resp(400, {"error": "Missing created_at in request body"})

    try:
        table = dynamo.Table(NOTIFICATIONS_TABLE)

        # ExpressionAttributeNames required — "read" is reserved in DynamoDB
        table.update_item(
            Key={"user_id": user_id, "created_at": created_at},
            UpdateExpression="SET #r = :true",
            ExpressionAttributeNames={"#r": "read"},
            ExpressionAttributeValues={":true": True},
        )
        return _resp(200, {"updated": True})

    except Exception as e:
        logger.error(f"Failed to mark notification read: {e}")
        return _resp(500, {"error": str(e)})


# ─────────────────────────────────────────────
# EMAIL SEND  (invoked directly by scheduler)
# ─────────────────────────────────────────────

def handle_send_email(event: dict):
    user_id    = event.get("user_id", "")
    email      = event.get("email", "")
    premiering = event.get("premiering", [])
    alert_date = event.get("alert_date", datetime.now().date().isoformat())

    if not email or not premiering:
        logger.warning("Missing email or premiering shows")
        return {"statusCode": 400, "body": "Missing required fields"}

    # ── DEDUPLICATION CHECK ───────────────────────────────────────────────────
    # Prevent duplicate alerts if the scheduler fires multiple times on same day
    if user_id:
        try:
            existing = dynamo.Table(NOTIFICATIONS_TABLE).query(
                KeyConditionExpression=Key("user_id").eq(user_id),
                FilterExpression=Attr("alert_date").eq(alert_date) & Attr("type").eq("premiere_alert"),
            )
            if existing.get("Count", 0) > 0:
                logger.info(f"Duplicate suppressed — {user_id} already alerted for {alert_date}")
                return {"statusCode": 200, "body": json.dumps({"skipped": True, "reason": "duplicate"})}
        except Exception as e:
            logger.warning(f"Dedup check failed (non-fatal): {e}")
    # ── END DEDUPLICATION ─────────────────────────────────────────────────────

    logger.info(f"Sending alert to {email} — {len(premiering)} shows")
    # ... rest of function unchanged

# ─────────────────────────────────────────────
# EMAIL BUILDER
# ─────────────────────────────────────────────

def build_email(premiering: List[Dict]) -> tuple:
    today_shows    = [s for s in premiering if s["days_until"] == 0]
    tomorrow_shows = [s for s in premiering if s["days_until"] == 1]

    count = len(premiering)
    if today_shows and tomorrow_shows:
        timing = f"{len(today_shows)} today · {len(tomorrow_shows)} tomorrow"
    elif today_shows:
        timing = "premiering today"
    else:
        timing = "premiering tomorrow"

    subject = f"🎬 {count} show{'s' if count > 1 else ''} from your watchlist {timing} — AirDate"

    def card(show):
        color = "#EF4444" if show["days_until"] == 0 else "#F59E0B"
        label = "🔴 PREMIERING TODAY" if show["days_until"] == 0 else "🟡 PREMIERES TOMORROW"
        net   = f'<div style="color:#94A3B8;font-size:13px;margin-top:2px;">{show["network"]}</div>' if show.get("network") else ""
        url   = f'https://airdate.tv/details?show_id={show["id"]}&title={show["title"].replace(" ", "+")}'
        return f"""
        <div style="background:#1E293B;border-radius:12px;padding:16px 20px;
                    margin-bottom:12px;border-left:4px solid {color};">
            <div style="color:{color};font-size:11px;font-weight:700;
                        letter-spacing:0.1em;margin-bottom:6px;">{label}</div>
            <div style="color:#FFFFFF;font-size:16px;font-weight:700;">{show["title"]}</div>
            {net}
            <div style="margin-top:10px;">
                <a href="{url}" style="display:inline-block;background:#0891B2;
                   color:#fff;font-size:11px;font-weight:700;text-decoration:none;
                   padding:6px 14px;border-radius:8px;">VIEW ON AIRDATE →</a>
            </div>
        </div>"""

    cards = "".join([card(s) for s in premiering])

    html = f"""<!DOCTYPE html><html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#020817;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="color:#06B6D4;font-size:22px;font-weight:900;letter-spacing:0.05em;">AirDate</div>
      <div style="color:#64748B;font-size:11px;letter-spacing:0.15em;margin-top:4px;">
        TRACK TV PREMIERES BEFORE THEY TREND</div>
    </div>
    <div style="background:#0F172A;border-radius:16px;padding:24px;margin-bottom:24px;
                text-align:center;border:1px solid rgba(6,182,212,0.2);">
      <div style="font-size:32px;margin-bottom:12px;">📺</div>
      <div style="color:#FFFFFF;font-size:20px;font-weight:900;margin-bottom:8px;">
        Your Watchlist Is Going Live</div>
      <div style="color:#94A3B8;font-size:14px;">{count} show{'s' if count > 1 else ''} {timing}.</div>
    </div>
    {cards}
    <div style="text-align:center;margin:28px 0;">
      <a href="https://airdate.tv/account"
         style="display:inline-block;background:linear-gradient(135deg,#0e7490,#06b6d4);
                color:#020817;font-size:12px;font-weight:900;text-decoration:none;
                padding:14px 32px;border-radius:12px;letter-spacing:0.1em;">
        ⚡ VIEW MY WATCHLIST</a>
    </div>
    <div style="text-align:center;margin-top:32px;padding-top:24px;
                border-top:1px solid rgba(255,255,255,0.05);">
      <div style="color:#475569;font-size:11px;line-height:1.8;">
        You're receiving this because you enabled premiere alerts in your AirDate account.<br>
        <a href="https://airdate.tv/account#preferences"
           style="color:#0891B2;text-decoration:none;">Manage notification preferences</a>
        &nbsp;·&nbsp;
        <a href="https://airdate.tv" style="color:#0891B2;text-decoration:none;">airdate.tv</a>
      </div>
    </div>
  </div>
</body></html>"""

    text = f"AirDate Premiere Alert\n{'='*40}\n{count} show{'s' if count > 1 else ''} {timing}:\n\n"
    for s in premiering:
        label = "TODAY" if s["days_until"] == 0 else "TOMORROW"
        text += f"• {s['title']} ({s.get('network','')}) — {label}\n"
        text += f"  https://airdate.tv/details?show_id={s['id']}\n\n"
    text += "View watchlist: https://airdate.tv/account\n"
    text += "Manage preferences: https://airdate.tv/account#preferences\n"

    return subject, html, text


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _resp(status: int, body: dict):
    return {
        "statusCode": status,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body, default=str),
    }