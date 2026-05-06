# airdate-reactivate-subscription
# POST /user/{sub}/reactivate
# Reverses a cancel_at_period_end — user changed their mind before period ends

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

def stripe_request(method, path, key, body=None):
    url     = f"https://api.stripe.com/v1{path}"
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

        if user.get("tier_status") != "canceling":
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": "Subscription is not pending cancellation"})}

        subscription_id = user.get("stripe_subscription_id")
        if not subscription_id:
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": "No subscription ID on record"})}

        # ── Remove the cancellation from Stripe ───────────────────────────────
        stripe_resp = stripe_request(
            "POST",
            f"/subscriptions/{subscription_id}",
            stripe_key,
            body={"cancel_at_period_end": "false"}
        )

        if stripe_resp.get("error"):
            err_msg = stripe_resp["error"].get("message", "Stripe error")
            return {"statusCode": 400, "headers": cors,
                    "body": json.dumps({"error": err_msg})}

        # ── Update DynamoDB: back to active ───────────────────────────────────
        table.update_item(
            Key={"user_id": uid},
            UpdateExpression="SET tier_status = :status, updated_at = :now",
            ExpressionAttributeValues={
                ":status": "active",
                ":now":    int(time.time()),
            },
        )

        print(f"[reactivate] ✅ {uid} — sub {subscription_id} reactivated")

        return {
            "statusCode": 200,
            "headers":    cors,
            "body":       json.dumps({
                "message":         "Subscription reactivated successfully",
                "subscription_id": subscription_id,
            }),
        }

    except Exception as e:
        print(f"[reactivate] Unexpected error for {uid}: {e}")
        return {"statusCode": 500, "headers": cors,
                "body": json.dumps({"error": "Internal server error", "detail": str(e)})}