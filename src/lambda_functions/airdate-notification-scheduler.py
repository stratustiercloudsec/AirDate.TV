import json
import logging
import boto3
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamo  = boto3.resource("dynamodb", region_name="us-east-1")
lambda_ = boto3.client("lambda",     region_name="us-east-1")

USERS_TABLE          = os.environ.get("USERS_TABLE", "airdate-users")
NOTIFICATIONS_LAMBDA = os.environ.get("NOTIFICATIONS_LAMBDA", "airdate-notifications")

# Valid alert day options — guards against bad data
VALID_ALERT_DAYS = {0, 1, 3, 7}

def lambda_handler(event, context):
    logger.info("=== AirDate Notification Scheduler ===")

    today = datetime.now(timezone.utc).date()
    logger.info(f"Today: {today.isoformat()}")

    table       = dynamo.Table(USERS_TABLE)
    users       = []
    scan_kwargs = {
        "FilterExpression":          "tier = :pro",
        "ExpressionAttributeValues": {":pro": "pro"},
        "ProjectionExpression":      "user_id, email, watchlist, preferences"
    }

    while True:
        resp = table.scan(**scan_kwargs)
        users.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        scan_kwargs["ExclusiveStartKey"] = last

    logger.info(f"Found {len(users)} Pro users")

    alerts_queued = 0

    for user in users:
        prefs = user.get("preferences", {})

        # Skip users who haven't enabled notifications
        if not prefs.get("notifications", False):
            continue

        user_id   = user.get("user_id", "")
        email     = user.get("email", "")
        watchlist = user.get("watchlist", [])

        if not email or not watchlist:
            continue

        # ── Per-user alert timing ─────────────────────────────────────────
        # alertDays = how many days BEFORE the premiere to notify
        # 0 = day-of, 1 = day-before (default), 3 = 3 days before, 7 = 1 week before
        raw_alert_days = prefs.get("alertDays", 1)
        alert_days     = int(raw_alert_days) if int(raw_alert_days) in VALID_ALERT_DAYS else 1
        target_date    = (today + timedelta(days=alert_days)).isoformat()

        logger.info(f"User {email} — alertDays={alert_days}, target={target_date}")

        # ── Check watchlist against this user's target date ───────────────
        premiering = []
        for show in watchlist:
            premiere_date = show.get("premiereDate") or show.get("premiere", "")
            if not premiere_date or premiere_date in ("TBA", "TBD", ""):
                continue

            normalized = None
            for fmt in ("%Y-%m-%d", "%m-%d-%Y", "%m/%d/%Y"):
                try:
                    normalized = datetime.strptime(premiere_date, fmt).date().isoformat()
                    break
                except ValueError:
                    continue

            if normalized == target_date:
                days_until = (datetime.fromisoformat(normalized).date() - today).days
                premiering.append({
                    "title":         show.get("title", "Unknown"),
                    "network":       show.get("network", ""),
                    "premiere_date": normalized,
                    "days_until":    days_until,
                    "poster":        show.get("poster", ""),
                    "id":            str(show.get("id", "")),
                })

        if not premiering:
            continue

       logger.info(f"Queueing alert for {email} — {len(premiering)} shows premiering in {alert_days} day(s)")

        payload = json.dumps({
            "user_id":    user_id,
            "email":      email,
            "premiering": premiering,
            "alert_date": today.isoformat(),
        })

        # ── Email notification ────────────────────────────────────────────
        try:
            lambda_.invoke(
                FunctionName   = NOTIFICATIONS_LAMBDA,
                InvocationType = "Event",
                Payload        = payload,
            )
            alerts_queued += 1
        except Exception as e:
            logger.error(f"Failed to invoke email notification for {email}: {e}")

        # ── Push notification ─────────────────────────────────────────────
        try:
            lambda_.invoke(
                FunctionName   = "airdate-push-notifications",
                InvocationType = "Event",
                Payload        = json.dumps({
                    "user_id":    user_id,
                    "premiering": premiering,
                    "alert_date": today.isoformat(),
                }),
            )
            logger.info(f"Push notification queued for {user_id}")
        except Exception as e:
            logger.error(f"Failed to invoke push notification for {user_id}: {e}")

    logger.info(f"Scheduler complete — {alerts_queued} alerts queued")
    return {
        "statusCode": 200,
        "body": json.dumps({
            "users_checked": len(users),
            "alerts_queued": alerts_queued,
            "date_today":    today.isoformat(),
        })
    }