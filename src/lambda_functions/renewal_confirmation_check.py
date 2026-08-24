"""
renewal_confirmation_check.py (v2 — matches real schema)

airdate-renewal-predictions items look like:
  {
    "show_id":             "1668",       # this IS the TMDB id
    "renewal_probability":  12,
    "label":                "cancelled",  # model's predicted class
    "updated_at":           "2026-04-30T02:53:29.130216",
    "model_version":        "heuristic-v1",
  }

No predicted_for_season field exists, so there's no way to know how many
seasons a show had at prediction time just from this table. This script
instead tracks a `last_known_season_count` baseline per show, set on first
run, and only flags `confirmed=True` when a later run sees that count go up
with a real air_date attached — i.e. it detects NEW confirmations from
whenever you start running it forward, not retroactively.

For renewals that already happened before you start running this
(Your Friends & Neighbors, Citadel, etc. — anything verified by hand),
use --mark-confirmed instead of waiting for the automated check to catch it.

Usage:
  python3 renewal_confirmation_check.py --backfill-baseline
      # First-ever run. Establishes last_known_season_count for every
      # prediction that doesn't have one yet. Does NOT mark anything
      # confirmed — there's nothing to compare against yet.

  python3 renewal_confirmation_check.py --check
      # Run this nightly (or fold check_and_update_all_predictions() into
      # an existing scheduled Lambda). Compares current TMDB season count
      # against last_known_season_count; flags confirmed=True on increase.

  python3 renewal_confirmation_check.py --mark-confirmed 1668 2026-02-14
      # Manually flag a specific show as confirmed, for renewals you've
      # already verified outside this script (news articles, the live
      # AirDate.TV dashboard, etc).

  python3 renewal_confirmation_check.py --check --dry-run
      # Preview what would change without writing to DynamoDB.
"""

import argparse
import time
from decimal import Decimal

import boto3
import requests
from boto3.dynamodb.conditions import Attr

TMDB_API_KEY = "d80b629f69e7c5393047c32a865ed697"  # valid key — never use 9e7202516e78494f2b18ec86d29a4309
TMDB_BASE = "https://api.themoviedb.org/3"

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
predictions_table = dynamodb.Table("airdate-renewal-predictions")


def get_show_details(tmdb_id: str) -> dict:
    """Full /tv/{id} response — includes status, number_of_seasons, seasons[]."""
    url = f"{TMDB_BASE}/tv/{tmdb_id}"
    resp = requests.get(url, params={"api_key": TMDB_API_KEY}, timeout=10)
    if resp.status_code != 200:
        return {}
    return resp.json()


def latest_real_season(details: dict):
    """
    Returns (season_count, latest_air_date) where season_count only counts
    seasons that have a real (non-null) air_date — i.e. actually scheduled,
    not just a placeholder "Season 3" entry with no date yet.
    """
    seasons = details.get("seasons", [])
    real_seasons = [s for s in seasons if s.get("season_number", 0) > 0 and s.get("air_date")]
    if not real_seasons:
        return 0, None
    latest = max(real_seasons, key=lambda s: s["season_number"])
    return len(real_seasons), latest.get("air_date")


def backfill_baseline(dry_run: bool = False) -> dict:
    """First-ever run: write last_known_season_count for every prediction
    that doesn't already have one. Establishes the starting point — does
    not mark anything confirmed."""
    results = {"checked": 0, "baseline_set": [], "errors": []}

    scan_kwargs = {"FilterExpression": Attr("last_known_season_count").not_exists()}
    done, start_key = False, None

    while not done:
        if start_key:
            scan_kwargs["ExclusiveStartKey"] = start_key
        response = predictions_table.scan(**scan_kwargs)

        for item in response.get("Items", []):
            results["checked"] += 1
            show_id = item.get("show_id")
            if not show_id:
                continue
            try:
                details = get_show_details(str(show_id))
                count, _ = latest_real_season(details)
                status = details.get("status", "")
            except Exception as e:
                results["errors"].append({"show_id": show_id, "error": str(e)})
                continue

            results["baseline_set"].append({"show_id": show_id, "season_count": count, "status": status})
            if not dry_run:
                predictions_table.update_item(
                    Key={"show_id": show_id},
                    UpdateExpression="SET last_known_season_count = :c, tmdb_status = :s, baseline_set_at = :t",
                    ExpressionAttributeValues={
                        ":c": count,
                        ":s": status,
                        ":t": Decimal(str(time.time())),
                    },
                )
            time.sleep(0.05)

        start_key = response.get("LastEvaluatedKey")
        done = start_key is None

    return results


def check_for_new_confirmations(dry_run: bool = False) -> dict:
    """Run on a schedule after baseline has been established. Flags
    confirmed=True when a show's real-season count has increased since
    the last check."""
    results = {"checked": 0, "newly_confirmed": [], "errors": []}

    scan_kwargs = {
        "FilterExpression": Attr("confirmed").ne(True) & Attr("last_known_season_count").exists()
    }
    done, start_key = False, None

    while not done:
        if start_key:
            scan_kwargs["ExclusiveStartKey"] = start_key
        response = predictions_table.scan(**scan_kwargs)

        for item in response.get("Items", []):
            results["checked"] += 1
            show_id = item.get("show_id")
            last_known = int(item.get("last_known_season_count", 0))

            try:
                details = get_show_details(str(show_id))
                count, air_date = latest_real_season(details)
                status = details.get("status", "")
            except Exception as e:
                results["errors"].append({"show_id": show_id, "error": str(e)})
                continue

            if count > last_known:
                results["newly_confirmed"].append(
                    {"show_id": show_id, "confirmed_date": air_date, "new_season_count": count}
                )
                if not dry_run:
                    predictions_table.update_item(
                        Key={"show_id": show_id},
                        UpdateExpression=(
                            "SET confirmed = :c, confirmed_date = :d, "
                            "last_known_season_count = :n, tmdb_status = :s, "
                            "confirmation_checked_at = :t"
                        ),
                        ExpressionAttributeValues={
                            ":c": True,
                            ":d": air_date,
                            ":n": count,
                            ":s": status,
                            ":t": Decimal(str(time.time())),
                        },
                    )
            else:
                # No change — just refresh the checked timestamp and status
                if not dry_run:
                    predictions_table.update_item(
                        Key={"show_id": show_id},
                        UpdateExpression="SET tmdb_status = :s, confirmation_checked_at = :t",
                        ExpressionAttributeValues={
                            ":s": status,
                            ":t": Decimal(str(time.time())),
                        },
                    )

            time.sleep(0.05)

        start_key = response.get("LastEvaluatedKey")
        done = start_key is None

    return results


def mark_confirmed_manually(show_id: str, confirmed_date: str):
    """For renewals you've already verified by hand — no TMDB round-trip needed."""
    predictions_table.update_item(
        Key={"show_id": show_id},
        UpdateExpression="SET confirmed = :c, confirmed_date = :d, confirmation_checked_at = :t",
        ExpressionAttributeValues={
            ":c": True,
            ":d": confirmed_date,
            ":t": Decimal(str(time.time())),
        },
    )
    print(f"Marked show_id={show_id} confirmed=True, confirmed_date={confirmed_date}")


def lambda_handler(event, context):
    """Drop into a nightly EventBridge schedule once baseline has already
    been established via a one-time --backfill-baseline run."""
    results = check_for_new_confirmations(dry_run=False)
    print(
        f"Checked {results['checked']}, "
        f"newly confirmed: {len(results['newly_confirmed'])}, "
        f"errors: {len(results['errors'])}"
    )
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill-baseline", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--mark-confirmed", nargs=2, metavar=("SHOW_ID", "DATE"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.mark_confirmed:
        show_id, date = args.mark_confirmed
        mark_confirmed_manually(show_id, date)
    elif args.backfill_baseline:
        out = backfill_baseline(dry_run=args.dry_run)
        print(f"Checked: {out['checked']}")
        print(f"Baseline set for: {len(out['baseline_set'])} shows")
        if out["errors"]:
            print(f"Errors: {out['errors']}")
    elif args.check:
        out = check_for_new_confirmations(dry_run=args.dry_run)
        print(f"Checked: {out['checked']}")
        print(f"Newly confirmed: {out['newly_confirmed']}")
        if out["errors"]:
            print(f"Errors: {out['errors']}")
    else:
        parser.print_help()
