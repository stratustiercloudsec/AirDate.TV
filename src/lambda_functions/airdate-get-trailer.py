import json
import logging
import urllib3
import os
import hashlib
import time
import boto3
from typing import Optional
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TMDB_API_KEY   = os.environ["TMDB_API_KEY"]
TMDB_BASE      = "https://api.themoviedb.org/3"
CACHE_TABLE    = os.environ.get("CACHE_TABLE", "airdate-cache")
TRAILER_TTL    = 86400 * 7  # 7 days — trailers almost never change

http    = urllib3.PoolManager()
HEADERS = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}

# ── DynamoDB Cache ─────────────────────────────────────────────────────────────
_dynamo = None
def _get_cache_table():
    global _dynamo
    if _dynamo is None:
        _dynamo = boto3.resource("dynamodb", region_name="us-east-1")
    return _dynamo.Table(CACHE_TABLE)

def trailer_cache_get(tmdb_id: str) -> Optional[str]:
    try:
        key  = f"trailer#{tmdb_id}"
        resp = _get_cache_table().get_item(Key={"cache_key": key})
        item = resp.get("Item")
        if not item or item.get("ttl", 0) < int(time.time()):
            return None
        logger.info(f"[Cache] HIT trailer: {tmdb_id}")
        return item.get("trailer_url")
    except Exception as e:
        logger.warning(f"[Cache] trailer GET error: {e}")
        return None

def trailer_cache_put(tmdb_id: str, trailer_url: str) -> None:
    try:
        _get_cache_table().put_item(Item={
            "cache_key":   f"trailer#{tmdb_id}",
            "trailer_url": trailer_url,
            "tmdb_id":     tmdb_id,
            "ttl":         int(time.time()) + TRAILER_TTL,
            "cached_at":   datetime.now().isoformat(),
        })
        logger.info(f"[Cache] SET trailer: {tmdb_id} (TTL 7d)")
    except Exception as e:
        logger.warning(f"[Cache] trailer PUT error: {e}")

# ── TMDB helper ────────────────────────────────────────────────────────────────
def tmdb(path, params=None):
    from urllib.parse import urlencode
    base_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        base_params.update(params)
    url = f"{TMDB_BASE}{path}?{urlencode(base_params, doseq=True)}"
    r   = http.request("GET", url, timeout=5.0)
    return json.loads(r.data.decode()) if r.status == 200 else {}

def get_trailer_url(tmdb_id: str, title: str) -> Optional[str]:
    if not tmdb_id:
        logger.warning(f"No TMDB ID provided for {title}")
        return None
    try:
        videos = tmdb(f"/tv/{tmdb_id}/videos").get("results", [])
        logger.info(f"Found {len(videos)} videos for {title} (ID: {tmdb_id})")
        if not videos:
            return None

        yt = [v for v in videos if v.get("site") == "YouTube"]
        if not yt:
            return None

        for priority in [
            lambda v: v.get("type") == "Trailer" and v.get("official"),
            lambda v: v.get("type") == "Trailer",
            lambda v: v.get("type") == "Teaser",
            lambda v: True,
        ]:
            match = next((v for v in yt if priority(v)), None)
            if match:
                url = f"https://www.youtube.com/watch?v={match['key']}"
                logger.info(f"Found {match.get('type')} for {title}: {match.get('name')}")
                return url

        return None
    except Exception as e:
        logger.error(f"Error fetching trailer for {title} (ID: {tmdb_id}): {e}")
        return None

# ── Handler ────────────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    try:
        body    = json.loads(event.get("body", "{}"))
        tmdb_id = body.get("tmdb_id", "").strip()
        title   = body.get("title", "Unknown").strip()

        logger.info(f"Trailer request: {title} (TMDB ID: {tmdb_id})")

        if not tmdb_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({"error": "Missing tmdb_id", "trailer_url": None})
            }

        # ── Cache check ────────────────────────────────────────────────────────
        cached_url = trailer_cache_get(tmdb_id)
        if cached_url:
            return {
                "statusCode": 200,
                "headers": HEADERS,
                "body": json.dumps({
                    "trailer_url": cached_url,
                    "title":       title,
                    "tmdb_id":     tmdb_id,
                    "cache_hit":   True
                })
            }

        # ── Cache miss — fetch from TMDB ───────────────────────────────────────
        trailer_url = get_trailer_url(tmdb_id, title)

        if trailer_url:
            trailer_cache_put(tmdb_id, trailer_url)
            return {
                "statusCode": 200,
                "headers": HEADERS,
                "body": json.dumps({
                    "trailer_url": trailer_url,
                    "title":       title,
                    "tmdb_id":     tmdb_id,
                    "cache_hit":   False
                })
            }

        return {
            "statusCode": 404,
            "headers": HEADERS,
            "body": json.dumps({
                "trailer_url": None,
                "title":       title,
                "message":     "No trailer found"
            })
        }

    except Exception as e:
        logger.error(f"Handler error: {e}")
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": "Internal server error", "trailer_url": None})
        }