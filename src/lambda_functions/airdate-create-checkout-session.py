import json
import os
import stripe

# ── Allowed origins ────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = {
    "https://airdate.tv",
    "https://dev.airdate.tv"
}

DEV_ORIGINS = {"https://dev.airdate.tv"}

def get_stripe_key(origin):
    if origin in DEV_ORIGINS:
        return os.environ['STRIPE_SECRET_KEY_TEST']
    return os.environ['STRIPE_SECRET_KEY_LIVE']

def get_cors_headers(event):
    request_origin = event.get("headers", {}).get("origin", "")
    origin = request_origin if request_origin in ALLOWED_ORIGINS else "https://airdate.tv"
    return {
        "Access-Control-Allow-Origin":  origin,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS"
    }

def get_allowed_price_ids(origin):
    """Return allowed price IDs based on environment."""
    if origin in DEV_ORIGINS:
        return {
            os.environ.get('STRIPE_PRICE_MONTHLY_TEST', ''),
            os.environ.get('STRIPE_PRICE_ANNUAL_TEST', ''),
        }
    return {
        os.environ.get('STRIPE_PRICE_MONTHLY_LIVE', ''),
        os.environ.get('STRIPE_PRICE_ANNUAL_LIVE', ''),
    }

def check_existing_subscription(email):
    if not email:
        print(f"check_existing_subscription: no email provided")
        return False
    try:
        print(f"Checking subscriptions for email: {email}")
        customers = stripe.Customer.list(email=email, limit=10)
        print(f"Found {len(customers.data)} customers for {email}")
        for customer in customers.data:
            subscriptions = stripe.Subscription.list(
                customer=customer.id,
                status="active",
                limit=1
            )
            print(f"Customer {customer.id} has {len(subscriptions.data)} active subscriptions")
            if subscriptions.data:
                print(f"Active subscription found for {email} — customer {customer.id}")
                return True
        return False
    except stripe.error.StripeError as e:
        print(f"Subscription check failed: {e}")
        return False

def lambda_handler(event, context):

    cors_headers = get_cors_headers(event)
    request_origin = event.get("headers", {}).get("origin", "https://airdate.tv")
    base_url = request_origin if request_origin in ALLOWED_ORIGINS else "https://airdate.tv"

    # ── Preflight ──────────────────────────────────────────────────────────────
    if event.get("httpMethod") == "OPTIONS":
        return { "statusCode": 200, "headers": cors_headers, "body": "" }

    # ── Checkout ───────────────────────────────────────────────────────────────
    try:
        stripe.api_key = get_stripe_key(base_url)

        body     = json.loads(event.get("body") or "{}")
        price_id = body.get("priceId")

        if not price_id:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "priceId is required"})
            }

        # ── Validate price ID belongs to this environment ──────────────────────
        allowed = get_allowed_price_ids(base_url)
        allowed.discard('')  # remove empty strings from missing env vars
        if allowed and price_id not in allowed:
            print(f"Invalid price ID attempted: {price_id}")
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Invalid price ID"})
            }

        # ── Get Cognito sub + email from JWT claims ────────────────────────────
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        sub    = claims.get("sub")   or body.get("sub", "unknown")
        email  = claims.get("email") or body.get("email", "")

        # ── Guard: block duplicate subscriptions ───────────────────────────────
        if check_existing_subscription(email):
            print(f"Blocked duplicate checkout for {email}")
            return {
                "statusCode": 200,
                "headers": cors_headers,
                "body": json.dumps({
                    "already_subscribed": True,
                    "message": "An active Pro subscription already exists for this account."
                })
            }

        # ── Determine billing label for session ────────────────────────────────
        is_annual = price_id in {
            os.environ.get('STRIPE_PRICE_ANNUAL_TEST', ''),
            os.environ.get('STRIPE_PRICE_ANNUAL_LIVE', '')
        }

        # ── Create Stripe checkout session ─────────────────────────────────────
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer_email=email if email else None,
            client_reference_id=sub,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{base_url}/upgrade-success.html",
            cancel_url=f"{base_url}/upgrade.html",
            metadata={
                "cognito_sub": sub,
                "billing_cycle": "annual" if is_annual else "monthly"
            }
        )

        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({"url": session.url})
        }

    except stripe.error.StripeError as e:
        print(f"Stripe error: {e}")
        return {
            "statusCode": 402,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e.user_message)})
        }

    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e)})
        }