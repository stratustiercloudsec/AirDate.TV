# airdate-cancel-subscription — v2.1
# POST /user/{sub}/cancel
# v2.1: Added Stripe lookup fallback when subscription_id is missing from DynamoDB
#       (handles users who upgraded before webhook v2.2 stored the subscription_id)

import json
import os
import time
import base64
import boto3
import urllib3
from decimal import Decimal

http     = urllib3.PoolManager()
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

USERS_TABLE = os.environ.get("USERS_TABLE", "airdate-users")

ALLOWED_ORIGINS = {"https://airdate.tv", "https://dev.airdate.tv"}
DEV_ORIGINS     = {"https://dev.airdate.tv"}

HEADERS = {
    "Content-Type":                 "application/json",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

def get_cors_headers(event):
    origin  = (event.get("headers") or {}).get("origin", "https://airdate.tv")
    allowed = origin if origin in ALLOWED_ORIGINS else "https://airdate.tv"
    return {**HEADERS, "Access-Control-Allow-Origin": allowed}

def get_stripe_key(origin):
    if origin in DEV_ORIGINS:
        return os.environ["STRIPE_SECRET_KEY_TEST"]
    return os.environ["STRIPE_SECRET_KEY_LIVE"]

def stripe_request(method, path, key, body=None, params=None):
    url = f"https://api.stripe.com/v1{path}"
    if params:
        qs  = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/x-www-form-urlencoded",
    }
    encoded = None
    if body:
        encoded = "&".join(f"{k}={v}" for k, v in body.items()).encode()
    resp = http.request(method, url, body=encoded, headers=headers, timeout=10.0)
    return json.loads(resp.data.decode())

def extract_sub(event):
    try:
        auth = (event.get("headers") or {}).get("Authorization", "") or \
               (event.get("headers") or {}).get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        seg  = auth.split(" ", 1)[1].split(".")[1]
        seg += "=" * (4 - len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(seg)).get("sub")
    except Exception:
        return None

def lambda_handler(event, context):
    cors   = get_cors_headers(event)
    method = ((event.get("requestContext") or {}).get("http") or {}).get("method") \
             or event.get("httpMethod", "POST")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    token_sub = extract_sub(event)
    if not token_sub:
        return {"statusCode": 401, "headers": cors,
                "body": json.dumps({"error": "Unauthorized"})}

    params = event.get("pathParameters") or {}
    uid    = params.get("sub") or params.get("user_id", "")

    if uid != token_sub:
        return {"statusCode": 403, "headers": cors,
                "body": json.dumps({"error": "Forbidden"})}

    origin     = (event.get("headers") or {}).get("origin", "https://airdate.tv")
    stripe_key = get_stripe_key(origin)

    try:
        table = dynamodb.Table(USERS_TABLE)
        resp  = table.get_item(Key={"user_id": uid})
        user  = resp.get("Item")

        if not user:
            return {"statusCode": 404, "headers": cors,
                    "body": json.dumps({"error": "User not found"})}

        if user.get("tier") != "pro":
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": "No active Pro subscription to cancel"})}

        if user.get("cancel_at_period_end") is True:
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": "Subscription is already scheduled for cancellation"})}

        subscription_id = user.get("subscription_id") or user.get("stripe_subscription_id") or ""

        # ── v2.1: Fallback — look up subscription_id from Stripe if missing ──
        # This handles users who subscribed before webhook v2.2 stored it.
        if not subscription_id:
            customer_id = user.get("stripe_customer_id", "")
            if not customer_id:
                return {"statusCode": 400, "headers": cors,
                        "body": json.dumps({"error": "No billing record found. Please contact support."})}

            print(f"[cancel] subscription_id missing for {uid} — looking up via customer {customer_id}")

            stripe_resp = stripe_request(
                "GET",
                "/subscriptions",
                stripe_key,
                params={
                    "customer": customer_id,
                    "status":   "active",
                    "limit":    "1",
                }
            )

            subs = stripe_resp.get("data", [])
            if not subs:
                # Also try status=trialing just in case
                stripe_resp = stripe_request(
                    "GET",
                    "/subscriptions",
                    stripe_key,
                    params={
                        "customer": customer_id,
                        "status":   "trialing",
                        "limit":    "1",
                    }
                )
                subs = stripe_resp.get("data", [])

            if not subs:
                return {"statusCode": 400, "headers": cors,
                        "body": json.dumps({"error": "No active subscription found in Stripe. Please contact support."})}

            subscription_id = subs[0]["id"]
            print(f"[cancel] Found subscription via Stripe lookup: {subscription_id}")

            # Backfill subscription_id into DynamoDB so future calls don't need the lookup
            try:
                table.update_item(
                    Key={"user_id": uid},
                    UpdateExpression="SET subscription_id = :sid",
                    ExpressionAttributeValues={":sid": subscription_id},
                )
                print(f"[cancel] Backfilled subscription_id {subscription_id} for {uid}")
            except Exception as backfill_err:
                print(f"[cancel] Backfill write failed (non-fatal): {backfill_err}")

        # ── Cancel at period end (NOT immediately) ────────────────────────────
        stripe_resp = stripe_request(
            "POST",
            f"/subscriptions/{subscription_id}",
            stripe_key,
            body={"cancel_at_period_end": "true"}
        )

        if stripe_resp.get("error"):
            err_msg = stripe_resp["error"].get("message", "Stripe error")
            print(f"[cancel] Stripe error for {uid}: {err_msg}")
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": err_msg})}

        period_end = stripe_resp.get("current_period_end")

        # ── Update DynamoDB ───────────────────────────────────────────────────
        table.update_item(
            Key={"user_id": uid},
            UpdateExpression=(
                "SET cancel_at_period_end = :true, "
                "subscription_period_end = :pe, "
                "subscription_id = :sid, "
                "updated_at = :now"
            ),
            ExpressionAttributeValues={
                ":true": True,
                ":pe":   Decimal(str(period_end)) if period_end else Decimal("0"),
                ":sid":  subscription_id,
                ":now":  int(time.time()),
            },
        )

        print(f"[cancel] ⏳ {uid} — sub {subscription_id} cancels at {period_end}")

        return {
            "statusCode": 200,
            "headers":    cors,
            "body":       json.dumps({
                "message":         "Subscription will cancel at end of billing period",
                "cancel_at":       period_end,
                "subscription_id": subscription_id,
            }),
        }

    except Exception as e:
        print(f"[cancel] Unexpected error for {uid}: {e}")
        return {"statusCode": 500, "headers": cors,
                "body": json.dumps({"error": "Internal server error", "detail": str(e)})}