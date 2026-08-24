"""
airdate-renewal-get.py

Handles GET /renewal/{show_id}

This is the missing piece referenced in ShowDetailPage.jsx's RenewalBadge
comment block ("SageMaker renewal classifier is v2.37 roadmap — NOT YET
DEPLOYED"). airdate-renewal-inference.py only runs the batch SageMaker
transform and writes predictions into airdate-renewal-predictions — nothing
was reading a single show's prediction back out for the frontend, which is
why GET /renewal/{show_id} was 404ing.

Reads one item from airdate-renewal-predictions and returns it, including
the confirmed / confirmed_date fields written by renewal_confirmation_check.py.

Deploy notes:
  - Add a GET method on the existing /renewal/{show_id} resource in API
    Gateway (qg0x31ranc) and point its integration at this Lambda.
  - auth = NONE, matching the other read-only intelligence endpoints
    (e.g. /user/{sub}/persona).
  - Execution role needs dynamodb:GetItem on airdate-renewal-predictions —
    likely already covered by an existing shared read role, but confirm.
"""

import json
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
predictions_table = dynamodb.Table("airdate-renewal-predictions")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",  # tighten to airdate.tv / dev.airdate.tv if you want to restrict
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def decimal_default(obj):
    """json.dumps can't serialize Decimal — DynamoDB returns everything
    numeric as Decimal, so this handles the conversion on the way out."""
    if isinstance(obj, Decimal):
        return float(obj) if obj % 1 else int(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def lambda_handler(event, context):
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    path_params = event.get("pathParameters") or {}
    show_id = path_params.get("show_id")

    if not show_id:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "show_id is required"}),
        }

    try:
        response = predictions_table.get_item(Key={"show_id": str(show_id)})
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }

    item = response.get("Item")

    if not item:
        # No prediction on file for this show — badge simply won't render
        # client-side (existing frontend code already treats a non-ok
        # response as "no data").
        return {
            "statusCode": 404,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "No renewal prediction found for this show"}),
        }

    result = {
        "show_id": item.get("show_id"),
        "probability": item.get("renewal_probability"),
        "updated": item.get("updated_at"),
        "confirmed": item.get("confirmed", False),
        "confirmed_date": item.get("confirmed_date"),
    }

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(result, default=decimal_default),
    }
