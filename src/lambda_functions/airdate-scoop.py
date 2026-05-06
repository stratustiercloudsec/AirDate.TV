"""
airdate-scoop v2.0 — TV industry intelligence aggregator
=========================================================
Deploy as:  airdate-scoop
Runtime:    Python 3.12
Timeout:    30s
Memory:     512MB
Env vars:   TMDB_API_KEY, TAVILY_API_KEY, NEWS_API_KEY,
            GOOGLE_API_KEY (optional), GOOGLE_CSE_ID (optional)
Trigger:    API Gateway POST /get-scoop

Request:
  { "category": "all", "max_items": 40, "cache_bust": false }

Response:
  { "success": true, "items": [...], "item_count": N,
    "cache_hit": true/false, "generated_at": "..." }

v2.0 changes:
  - DynamoDB caching layer (airdate-cache table, 1hr TTL)
  - Warmup ping support (EventBridge keep-alive)
  - Parallel Tavily + NewsAPI fetching
  - TMDB batch enrichment (non-blocking)
  - Tavily domain-free fallback
  - Base64 body decoding for Lambda Function URL
  - show_title null fallback (prevents 400 on roundup articles)
"""

import json
import logging
import os
import re
import time
import base64
import hashlib
from datetime import datetime
from urllib.parse import urlencode, quote_plus
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import urllib3
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

http = urllib3.PoolManager(maxsize=20, timeout=urllib3.Timeout(connect=5, read=10))

# ── Env ────────────────────────────────────────────────────────────────────────
TMDB_API_KEY   = os.environ.get("TMDB_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
NEWS_API_KEY   = os.environ.get("NEWS_API_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_CSE_ID  = os.environ.get("GOOGLE_CSE_ID", "")
AWS_REGION     = os.environ.get("AWS_REGION", "us-east-1")

TMDB_BASE      = "https://api.themoviedb.org/3"
TMDB_IMG       = "https://image.tmdb.org/t/p/w185"
CACHE_TABLE    = "airdate-cache"
CACHE_TTL      = 1800  # 1 hour for scoop feed

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

TRADE_DOMAINS = [
    "variety.com", "deadline.com", "hollywoodreporter.com",
    "ew.com", "tvline.com", "indiewire.com", "thewrap.com",
    "screenrant.com", "collider.com"
]
CULTURE_DOMAINS = [
    "blexmedia.com", "vibe.com", "essence.com",
    "ebony.com", "blavity.com", "blackenterprise.com",
]
CATEGORY_QUERIES = {
    "premieres":     ["new TV show premieres 2026", "TV series premiere dates 2026", "new season premiere TV"],
    "renewals":      ["TV show renewed 2026", "series renewal pickup order", "renewed for another season"],
    "cancellations": ["TV show cancelled 2026", "series cancelled axed", "show not returning cancelled"],
    "casting":       ["TV show casting news 2026", "actor cast series role", "stars joins TV show"],
    "production":    ["TV production news 2026", "filming begins series", "show greenlit production"],
    "all":           ["TV industry news 2026", "television series news today", "streaming show news 2026",
                      "new TV show premiere 2026", "TV show renewed cancelled 2026"],
}

# ── DynamoDB Cache ─────────────────────────────────────────────────────────────
_dynamo      = None
_cache_table = None

def _get_cache_table():
    global _dynamo, _cache_table
    if _cache_table is None:
        _dynamo      = boto3.resource("dynamodb", region_name=AWS_REGION)
        _cache_table = _dynamo.Table(CACHE_TABLE)
    return _cache_table

def _make_cache_key(category: str, max_items: int) -> str:
    raw = f"scoop:{category}:{max_items}"
    return hashlib.md5(raw.encode()).hexdigest()[:20]

def cache_get(category: str, max_items: int) -> Optional[dict]:
    try:
        table = _get_cache_table()
        resp  = table.get_item(Key={
            "cache_key": _make_cache_key(category, max_items)
        })
        item = resp.get("Item")
        if not item:
            return None
        if item.get("ttl", 0) < int(time.time()):
            logger.info("Cache item found but TTL expired")
            return None
        logger.info(f"Cache HIT — scoop/{category}")
        return json.loads(item["payload"])
    except Exception as e:
        logger.warning(f"Cache GET error (non-fatal): {e}")
        return None

def cache_put(category: str, max_items: int, payload: dict) -> None:
    try:
        table = _get_cache_table()
        table.put_item(Item={
            "cache_key": _make_cache_key(category, max_items),
            "payload":   json.dumps(payload, default=str),
            "ttl":       int(time.time()) + CACHE_TTL,
            "cached_at": datetime.now().isoformat(),
        })
        logger.info(f"Cache WRITE — scoop/{category} (TTL {CACHE_TTL}s)")
    except Exception as e:
        logger.warning(f"Cache PUT error (non-fatal): {e}")

# ── Tavily ─────────────────────────────────────────────────────────────────────
def tavily_search(query: str, domains: Optional[list] = None, max_results: int = 5) -> list:
    if not TAVILY_API_KEY:
        return []
    try:
        payload = {
            "api_key":        TAVILY_API_KEY,
            "query":          query,
            "search_depth":   "basic",
            "max_results":    max_results,
            "include_answer": False,
        }
        if domains:
            payload["include_domains"] = domains

        resp = http.request(
            "POST",
            "https://api.tavily.com/search",
            body=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        if resp.status != 200:
            logger.warning(f"Tavily {resp.status} for '{query}'")
            return []
        data    = json.loads(resp.data.decode())
        results = data.get("results", [])

        # Domain-free fallback if restricted search returned nothing
        if not results and domains:
            logger.info(f"Tavily domain fallback for '{query}'")
            return tavily_search(query, domains=None, max_results=max_results)

        return results
    except Exception as e:
        logger.warning(f"Tavily error: {e}")
        return []

# ── NewsAPI ────────────────────────────────────────────────────────────────────
def newsapi_search(query: str, page_size: int = 20) -> list:
    if not NEWS_API_KEY:
        return []
    try:
        params = {
            "q":        query,
            "language": "en",
            "sortBy":   "publishedAt",
            "pageSize": page_size,
            "apiKey":   NEWS_API_KEY,
        }
        resp = http.request("GET", f"https://newsapi.org/v2/everything?{urlencode(params)}")
        if resp.status != 200:
            logger.warning(f"NewsAPI {resp.status} for '{query}'")
            return []
        data = json.loads(resp.data.decode())
        return data.get("articles", [])
    except Exception as e:
        logger.warning(f"NewsAPI error: {e}")
        return []

# ── TMDB ───────────────────────────────────────────────────────────────────────
def tmdb_search_show(title: str) -> Optional[dict]:
    if not TMDB_API_KEY or not title:
        return None
    try:
        params = {"api_key": TMDB_API_KEY, "query": title, "language": "en-US"}
        resp   = http.request("GET", f"{TMDB_BASE}/search/tv?{urlencode(params)}")
        if resp.status != 200:
            return None
        results = json.loads(resp.data.decode()).get("results", [])
        if not results:
            return None
        show = results[0]
        return {
            "tmdb_id":      show.get("id"),
            "poster_url":   f"{TMDB_IMG}{show['poster_path']}" if show.get("poster_path") else None,
            "vote_average": show.get("vote_average"),
            "overview":     show.get("overview", ""),
            "networks":     [],
        }
    except Exception as e:
        logger.warning(f"TMDB search error for '{title}': {e}")
        return None

# ── Item normalisation ─────────────────────────────────────────────────────────
_SEEN_URLS: set = set()

_TITLE_BLOCKLIST = {"NBA", "NFL", "MLB", "NHL", "CNN", "BBC", "CBS", "NBC", "ABC", "HBO", "ESPN"}

def _extract_show_title(text: str) -> str:
    patterns = [
        r"'([^']{3,40})'",
        r'"([^"]{3,40})"',
        r'\b([A-Z][a-zA-Z\s&:]{3,35})\s+(?:renewed|cancelled|canceled|premiere|cast|season)',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            candidate = m.group(1).strip()
            if len(candidate) >= 3 and candidate not in _TITLE_BLOCKLIST:
                return candidate
    return ""

def normalize_tavily_item(item: dict, category: str) -> Optional[dict]:
    url   = item.get("url", "")
    title = (item.get("title") or "").strip()
    if not url or not title or url in _SEEN_URLS:
        return None
    _SEEN_URLS.add(url)

    snippet    = (item.get("content") or item.get("snippet") or "")[:300]
    show_title = _extract_show_title(title) or _extract_show_title(snippet)
    domain_m   = re.search(r"https?://(?:www\.)?([^/]+)", url)

    return {
        "id":          hashlib.md5(url.encode()).hexdigest()[:10],
        "headline":    title,
        "summary":     snippet,
        "url":         url,
        "domain":      domain_m.group(1) if domain_m else "",
        "show_title":  show_title,
        "category":    category,
        "published_at": item.get("published_date", ""),
        "poster_url":  None,
        "tmdb_id":     None,
    }

def normalize_newsapi_item(article: dict, category: str) -> Optional[dict]:
    url   = article.get("url", "")
    title = (article.get("title") or "").strip()
    if not url or not title or url in _SEEN_URLS or "[Removed]" in title:
        return None
    _SEEN_URLS.add(url)

    snippet    = (article.get("description") or "")[:300]
    show_title = _extract_show_title(title) or _extract_show_title(snippet)

    return {
        "id":           hashlib.md5(url.encode()).hexdigest()[:10],
        "headline":     title,
        "summary":      snippet,
        "url":          url,
        "domain":       article.get("source", {}).get("name", ""),
        "show_title":   show_title,
        "category":     category,
        "published_at": article.get("publishedAt", ""),
        "poster_url":   None,
        "tmdb_id":      None,
    }

# ── TMDB batch enrichment ──────────────────────────────────────────────────────
def enrich_with_tmdb(items: list) -> list:
    """Batch TMDB lookups for items that have a show_title but no poster."""
    to_enrich = [i for i in items if i.get("show_title") and not i.get("poster_url")][:20]

    def fetch_one(item):
        meta = tmdb_search_show(item["show_title"])
        if meta:
            item["poster_url"] = meta.get("poster_url")
            item["tmdb_id"]    = meta.get("tmdb_id")
        return item

    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_one, i): i for i in to_enrich}
        for fut in as_completed(futures, timeout=10):
            try:
                fut.result()
            except Exception:
                pass

    return items

# ── Feed builder ───────────────────────────────────────────────────────────────
def build_feed(category: str, max_items: int) -> list:
    global _SEEN_URLS
    _SEEN_URLS = set()

    if category == "all":
        query_map = {k: v for k, v in CATEGORY_QUERIES.items() if k != "all"}
    else:
        query_map = {category: CATEGORY_QUERIES.get(category, CATEGORY_QUERIES["all"])}

    raw_items = []
    futures   = {}

    with ThreadPoolExecutor(max_workers=20) as ex:

        # ── Trade + NewsAPI pass (2 queries per category) ──────────────────
        for cat_name, queries in query_map.items():
            for q in queries[:2]:
                tf = ex.submit(tavily_search, q, TRADE_DOMAINS, 6)
                nf = ex.submit(newsapi_search, q, 8)
                futures[tf] = (q, cat_name, "tavily")
                futures[nf] = (q, cat_name, "newsapi")

        # ── Culture/Black media pass (1 dedicated query per category) ──────
        for cat_name, queries in query_map.items():
            for q in queries[:1]:
                cf = ex.submit(tavily_search, q, CULTURE_DOMAINS, 4)
                futures[cf] = (q, cat_name, "tavily")

        # ── Collect all results ─────────────────────────────────────────────
        for fut in as_completed(futures, timeout=22):
            q, cat_name, source = futures[fut]
            try:
                results = fut.result()
                for r in results:
                    norm = (normalize_tavily_item(r, cat_name)
                            if source == "tavily"
                            else normalize_newsapi_item(r, cat_name))
                    if norm:
                        raw_items.append(norm)
            except Exception as e:
                logger.warning(f"Feed fetch error '{q}': {e}")

    # Deduplicate
    seen_ids = set()
    deduped  = []
    for item in raw_items:
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            deduped.append(item)

    deduped = deduped[:max_items * 2]
    deduped = enrich_with_tmdb(deduped)
    return deduped[:max_items]   # ✅ inside build_feed, not orphaned

# ── Handler ────────────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    start = time.time()

    # Warmup ping (EventBridge keep-alive — no work needed)
    if event.get("warmup"):
        logger.info("Warmup ping received")
        return {"statusCode": 200, "headers": HEADERS, "body": json.dumps({"status": "warm"})}

    # OPTIONS preflight
    method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method", "")
    ).upper()
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}

    try:
        # Parse body
        raw_body = event.get("body") or "{}"
        if event.get("isBase64Encoded") and raw_body:
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        body      = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or {})
        category  = body.get("category", "all")
        max_items = min(int(body.get("max_items", 40)), 80)
        cache_bust = bool(body.get("cache_bust", False))

        # ── Cache check ──
        if not cache_bust:
            cached = cache_get(category, max_items)
            if cached:
                cached["cache_hit"] = True
                return {
                    "statusCode": 200,
                    "headers":    HEADERS,
                    "body":       json.dumps(cached, default=str),
                }

        logger.info(f"Cache MISS — building feed: category={category}, max={max_items}")

        # ── Build feed ──
        items = build_feed(category, max_items)

        response_payload = {
            "success":      True,
            "cache_hit":    False,
            "generated_at": datetime.now().isoformat(),
            "item_count":   len(items),
            "items":        items,
        }

        # ── Write to cache (non-blocking best-effort) ──
        cache_put(category, max_items, response_payload)

        elapsed = round(time.time() - start, 2)
        logger.info(f"Feed built in {elapsed}s — {len(items)} items")

        return {
            "statusCode": 200,
            "headers":    HEADERS,
            "body":       json.dumps(response_payload, default=str),
        }

    except Exception as e:
        logger.error(f"Handler error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers":    HEADERS,
            "body":       json.dumps({"success": False, "error": str(e)}),
        }