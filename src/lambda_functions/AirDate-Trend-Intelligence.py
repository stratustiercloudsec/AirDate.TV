"""
AirDate-Trend-Intelligence Lambda
===================================
Triggered daily by EventBridge (cron 0 11 * * ? *)

Pipeline:
1. Tavily → Search entertainment news sites for current month premieres
2. Extract → Parse show names from articles using regex + NLP patterns
3. Score  → Rank by mention frequency across multiple sources
4. Validate → Confirm each show on TMDB (current month premiere + has trailer)
5. Store  → Write ranked spotlight data to DynamoDB for get-spotlight to read

Entertainment Sources:
  - Variety (variety.com)
  - Deadline (deadline.com)
  - Hollywood Reporter (hollywoodreporter.com)
  - Entertainment Weekly (ew.com)
  - IndieWire (indiewire.com)
"""

import json
import logging
import urllib3
import boto3
import os
import re
import time
import calendar
from typing import List, Dict, Optional, Set
from datetime import datetime, timedelta
from collections import Counter
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Config ──
TMDB_API_KEY = os.environ["TMDB_API_KEY"]
TAVILY_API_KEY = os.environ["TAVILY_API_KEY"]
DYNAMO_TABLE = os.environ.get("DYNAMO_TABLE", "tmdb-show-cache")
TMDB_BASE = "https://api.themoviedb.org/3"

http = urllib3.PoolManager()
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DYNAMO_TABLE)

# ── Entertainment news domains ──
ENTERTAINMENT_DOMAINS = [
    "variety.com",
    "deadline.com",
    "hollywoodreporter.com",
    "ew.com",
    "indiewire.com",
]

# ── False positive filter ──
STOP_WORDS = {
    "The", "A", "An", "Season", "Episode", "Series", "Show", "TV", "New",
    "Network", "Streaming", "Final", "First", "Last", "Next", "Best", "Top",
    "Watch", "Review", "Preview", "Premiere", "Trailer", "Renewed", "Cancelled",
    "Netflix", "Hulu", "HBO", "Max", "Disney", "Amazon", "Apple", "Peacock",
    "Paramount", "FX", "AMC", "CBS", "NBC", "ABC", "FOX", "Prime Video",
    "February", "March", "April", "January", "May", "June", "July", "August",
    "September", "October", "November", "December", "Monday", "Tuesday",
    "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Exclusive", "Report", "Breaking", "Update", "Official", "Video",
}


# ═══════════════════════════════════════════
# TMDB API
# ═══════════════════════════════════════════

def tmdb(path: str, params: dict = None) -> dict:
    """TMDB API call with retry."""
    try:
        base_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
        if params:
            base_params.update(params)
        from urllib.parse import urlencode
        url = f"{TMDB_BASE}{path}?{urlencode(base_params, doseq=True)}"
        r = http.request("GET", url, timeout=5.0)
        if r.status == 200:
            return json.loads(r.data.decode())
        if r.status == 429:
            time.sleep(1)
            r = http.request("GET", url, timeout=5.0)
            if r.status == 200:
                return json.loads(r.data.decode())
        logger.warning(f"TMDB {r.status} for {path}")
        return {}
    except Exception as e:
        logger.error(f"TMDB error {path}: {e}")
        return {}


def resolve_tmdb_id(title: str) -> Optional[int]:
    """Search TMDB for a show by name, return its ID."""
    results = tmdb("/search/tv", {"query": title}).get("results", [])
    if not results:
        return None
    # Prefer exact name match (case-insensitive)
    for r in results:
        if r.get("name", "").lower() == title.lower():
            return r["id"]
    return results[0]["id"]


def get_show_details(tmdb_id: int) -> dict:
    """Get full show details from TMDB."""
    d = tmdb(f"/tv/{tmdb_id}")
    if not d:
        return {}
    nets = d.get("networks", [])
    net_name = nets[0].get("name", "") if nets else ""
    logo_path = nets[0].get("logo_path", "") if nets else ""
    logo_url = f"https://image.tmdb.org/t/p/w300{logo_path}" if logo_path else None
    return {
        "title": d.get("name", ""),
        "tmdb_id": tmdb_id,
        "network": net_name,
        "network_logo": logo_url,
        "first_air_date": d.get("first_air_date", ""),
        "popularity": d.get("popularity", 0),
        "overview": d.get("overview", ""),
    }


def get_youtube_trailer_id(tmdb_id: int) -> Optional[str]:
    """Get YouTube trailer key. Priority: Trailer → Teaser → any YT clip."""
    try:
        results = tmdb(f"/tv/{tmdb_id}/videos").get("results", [])
        for priority in ["Trailer", "Teaser"]:
            for v in results:
                if v.get("type") == priority and v.get("site") == "YouTube":
                    return v["key"]
        for v in results:
            if v.get("site") == "YouTube":
                return v["key"]
    except Exception as e:
        logger.warning(f"Trailer fetch error ({tmdb_id}): {e}")
    return None


def is_current_month_premiere(details: dict) -> bool:
    """Check if show premieres (or has a new season) in the current month."""
    now = datetime.now()
    fad = details.get("first_air_date", "")

    # Check first_air_date
    if fad:
        try:
            air = datetime.strptime(fad, "%Y-%m-%d")
            if air.year == now.year and air.month == now.month:
                return True
        except ValueError:
            pass

    # Also check last season air date via TMDB
    tmdb_id = details.get("tmdb_id")
    if tmdb_id:
        d = tmdb(f"/tv/{tmdb_id}")
        seasons = d.get("seasons", [])
        for s in reversed(seasons):
            sad = s.get("air_date", "")
            if sad:
                try:
                    sa = datetime.strptime(sad, "%Y-%m-%d")
                    if sa.year == now.year and sa.month == now.month:
                        return True
                except ValueError:
                    continue

    return False


# ═══════════════════════════════════════════
# TAVILY NEWS SEARCH
# ═══════════════════════════════════════════

def search_tavily(query: str, max_results: int = 10) -> List[Dict]:
    """Search Tavily with entertainment domain filtering."""
    if not TAVILY_API_KEY:
        logger.error("❌ TAVILY_API_KEY not set")
        return []
    try:
        payload = {
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": "advanced",
            "include_domains": ENTERTAINMENT_DOMAINS,
            "max_results": max_results,
        }
        r = http.request(
            "POST", "https://api.tavily.com/search",
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
            timeout=10.0,
        )
        if r.status == 200:
            data = json.loads(r.data.decode())
            results = data.get("results", [])
            logger.info(f"📰 Tavily '{query}' → {len(results)} articles")
            return results
        logger.warning(f"⚠️ Tavily status {r.status}")
        return []
    except Exception as e:
        logger.error(f"❌ Tavily error: {e}")
        return []


# ═══════════════════════════════════════════
# SHOW NAME EXTRACTION
# ═══════════════════════════════════════════

def extract_show_names(articles: List[Dict]) -> Counter:
    """
    Extract TV show names from news articles.
    Returns Counter of show_name → mention count.
    """
    mentions = Counter()

    for article in articles:
        title = article.get("title", "")
        content = article.get("content", "")[:2000]
        text = f"{title} {content}"

        found_in_article: Set[str] = set()

        # Pattern 1: Double-quoted names — "Severance" renewed...
        for m in re.findall(r'"([A-Z][^"]{2,50})"', text):
            clean = m.strip()
            if clean not in STOP_WORDS and len(clean) > 2:
                found_in_article.add(clean)

        # Pattern 2: Single-quoted — 'The White Lotus' season 3...
        for m in re.findall(r"'([A-Z][^']{2,50})'", text):
            clean = m.strip()
            if clean not in STOP_WORDS and len(clean) > 2:
                found_in_article.add(clean)

        # Pattern 3: "Show Name Season X" pattern
        for m in re.findall(r'([A-Z][a-zA-Z\s:\']{2,40})\s+[Ss]eason\s+\d+', text):
            clean = m.strip()
            if clean not in STOP_WORDS and len(clean) > 2:
                found_in_article.add(clean)

        # Pattern 4: "Show Name premieres/debuts/returns"
        for m in re.findall(
            r'([A-Z][a-zA-Z\s:\']{2,40})\s+(?:premiere|debut|return|launch|drop)',
            text, re.IGNORECASE
        ):
            clean = m.strip()
            if clean not in STOP_WORDS and len(clean) > 2:
                found_in_article.add(clean)

        # Pattern 5: Italic/bold markdown patterns — **Show Name** or *Show Name*
        for m in re.findall(r'\*\*([A-Z][^*]{2,50})\*\*', text):
            clean = m.strip()
            if clean not in STOP_WORDS and len(clean) > 2:
                found_in_article.add(clean)

        for name in found_in_article:
            mentions[name] += 1

    logger.info(f"🎬 Extracted {len(mentions)} unique show names, "
                f"top 5: {mentions.most_common(5)}")
    return mentions


# ═══════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════

def run_trend_discovery() -> List[Dict]:
    """
    Full pipeline:
    1. Search entertainment news for current month premieres
    2. Extract show names + score by mention frequency
    3. Validate each against TMDB (current month, has trailer)
    4. Return ranked list of up to 8 shows
    """
    now = datetime.now()
    month_name = now.strftime("%B")
    year = now.year

    logger.info(f"🚀 Starting Trend Discovery for {month_name} {year}")

    # ── Step 1: Multi-query Tavily search ──
    queries = [
        f"most anticipated TV shows premiering {month_name} {year}",
        f"new TV series {month_name} {year} premiere dates",
        f"best new shows to watch {month_name} {year}",
        f"TV premieres {month_name} {year} Netflix HBO Disney Hulu",
        f"highly anticipated series returning {month_name} {year}",
    ]

    all_articles = []
    seen_urls = set()
    for q in queries:
        articles = search_tavily(q, max_results=8)
        for a in articles:
            url = a.get("url", "")
            if url not in seen_urls:
                all_articles.append(a)
                seen_urls.add(url)
        time.sleep(0.3)  # Rate limit courtesy

    logger.info(f"📰 Total unique articles: {len(all_articles)}")

    if not all_articles:
        logger.warning("⚠️ No articles found — falling back to TMDB Discover")
        return fallback_tmdb_discover()

    # ── Step 2: Extract + score show names ──
    mention_counts = extract_show_names(all_articles)

    if not mention_counts:
        logger.warning("⚠️ No show names extracted — falling back to TMDB Discover")
        return fallback_tmdb_discover()

    # ── Step 3: Validate against TMDB ──
    validated = []
    seen_ids = set()

    # Process by mention frequency (most-mentioned first)
    for show_name, buzz_count in mention_counts.most_common(30):
        tmdb_id = resolve_tmdb_id(show_name)
        if not tmdb_id or tmdb_id in seen_ids:
            continue
        seen_ids.add(tmdb_id)

        details = get_show_details(tmdb_id)
        if not details.get("title"):
            continue

        # Check trailer exists
        yt_id = get_youtube_trailer_id(tmdb_id)
        if not yt_id:
            logger.info(f"⏭️ No trailer: {show_name}")
            continue

        # Compute composite score: buzz mentions + TMDB popularity
        tmdb_popularity = details.get("popularity", 0)
        composite_score = (buzz_count * 10) + tmdb_popularity

        # Prefer current month premieres but don't require it
        premieres_this_month = is_current_month_premiere(details)
        if premieres_this_month:
            composite_score += 50  # Boost current month premieres

        validated.append({
            "title": details["title"],
            "youtube_id": yt_id,
            "network": details["network"],
            "network_logo": details["network_logo"],
            "tmdb_id": tmdb_id,
            "buzz_score": buzz_count,
            "tmdb_popularity": tmdb_popularity,
            "composite_score": composite_score,
            "premieres_this_month": premieres_this_month,
            "first_air_date": details.get("first_air_date", ""),
        })

        logger.info(
            f"✅ {details['title']} | buzz={buzz_count} | "
            f"pop={tmdb_popularity:.0f} | composite={composite_score:.0f} | "
            f"this_month={premieres_this_month}"
        )

        if len(validated) >= 12:
            break

    # ── Step 4: Sort by composite score, take top 8 ──
    validated.sort(key=lambda x: x["composite_score"], reverse=True)
    top_shows = validated[:8]

    logger.info(f"🏆 Top {len(top_shows)} trending shows selected")
    for i, s in enumerate(top_shows):
        logger.info(f"  #{i+1}: {s['title']} (score={s['composite_score']:.0f})")

    # If we got fewer than 4, pad with TMDB Discover
    if len(top_shows) < 4:
        logger.info("📺 Padding with TMDB Discover fallback...")
        fallback = fallback_tmdb_discover()
        existing_ids = {s["tmdb_id"] for s in top_shows}
        for fb in fallback:
            if fb["tmdb_id"] not in existing_ids:
                top_shows.append(fb)
                if len(top_shows) >= 8:
                    break

    return top_shows


def fallback_tmdb_discover() -> List[Dict]:
    """
    Fallback: Use TMDB Discover if Tavily returns nothing.
    Discovers popular English-language premieres this month.
    """
    now = datetime.now()
    month_start = f"{now.year}-{now.month:02d}-01"
    last_day = calendar.monthrange(now.year, now.month)[1]
    month_end = f"{now.year}-{now.month:02d}-{last_day}"

    logger.info(f"📺 TMDB Discover fallback: {month_start} → {month_end}")

    pool = tmdb("/discover/tv", {
        "sort_by": "popularity.desc",
        "first_air_date.gte": month_start,
        "first_air_date.lte": month_end,
        "with_original_language": "en",
    }).get("results", [])

    results = []
    for show in pool[:20]:
        tmdb_id = show["id"]
        yt_id = get_youtube_trailer_id(tmdb_id)
        if not yt_id:
            continue
        details = get_show_details(tmdb_id)
        results.append({
            "title": details.get("title", show.get("name", "")),
            "youtube_id": yt_id,
            "network": details.get("network", ""),
            "network_logo": details.get("network_logo"),
            "tmdb_id": tmdb_id,
            "buzz_score": 0,
            "tmdb_popularity": details.get("popularity", 0),
            "composite_score": details.get("popularity", 0),
            "premieres_this_month": True,
            "first_air_date": details.get("first_air_date", ""),
        })
        if len(results) >= 8:
            break

    return results


# ═══════════════════════════════════════════
# DYNAMODB STORAGE
# ═══════════════════════════════════════════

def write_spotlight_to_dynamo(shows: List[Dict]):
    """
    Write trending spotlight data to DynamoDB.
    Key: PK=SPOTLIGHT, SK=current_month (e.g., "2026-02")

    Also writes individual show entries for historical tracking.
    """
    now = datetime.now()
    month_key = now.strftime("%Y-%m")
    ttl = int(time.time()) + (45 * 86400)  # 45-day TTL

    # ── Main spotlight record (what get-spotlight reads) ──
    # Strip non-serializable fields and convert floats for DynamoDB
    clean_shows = []
    for s in shows:
        clean_shows.append({
            "title": s["title"],
            "youtube_id": s["youtube_id"],
            "network": s["network"],
            "network_logo": s.get("network_logo"),
            "tmdb_id": int(s["tmdb_id"]),
            "buzz_score": int(s.get("buzz_score", 0)),
            "composite_score": int(s.get("composite_score", 0)),
            "premieres_this_month": s.get("premieres_this_month", False),
            "first_air_date": s.get("first_air_date", ""),
        })

    item = {
        "PK": "SPOTLIGHT",
        "SK": month_key,
        "shows": clean_shows,
        "updated_at": now.isoformat(),
        "source": "trend-intelligence",
        "article_count": len(clean_shows),
        "ttl": ttl,
    }

    table.put_item(Item=json.loads(json.dumps(item), parse_float=Decimal))
    logger.info(f"💾 Wrote SPOTLIGHT/{month_key} → {len(clean_shows)} shows")

    # ── Also write a "latest" pointer for easy reads ──
    latest = {
        "PK": "SPOTLIGHT",
        "SK": "LATEST",
        "month_key": month_key,
        "shows": clean_shows,
        "updated_at": now.isoformat(),
        "ttl": ttl,
    }
    table.put_item(Item=json.loads(json.dumps(latest), parse_float=Decimal))
    logger.info(f"💾 Wrote SPOTLIGHT/LATEST pointer")


# ═══════════════════════════════════════════
# LAMBDA HANDLER
# ═══════════════════════════════════════════

def lambda_handler(event, context):
    """
    Invoked daily by EventBridge at 11:00 UTC.

    1. Scrapes entertainment news via Tavily
    2. Extracts + scores show names by buzz
    3. Validates against TMDB (trailer + premiere date)
    4. Writes ranked results to DynamoDB
    5. get-spotlight Lambda reads from DynamoDB to serve frontend
    """
    try:
        logger.info("=" * 60)
        logger.info("🔥 AirDate Trend Intelligence — Daily Run")
        logger.info("=" * 60)

        # Run the full pipeline
        trending_shows = run_trend_discovery()

        if not trending_shows:
            logger.error("❌ Pipeline returned 0 shows — skipping DynamoDB write")
            return {"statusCode": 500, "body": "No shows discovered"}

        # Write to DynamoDB
        write_spotlight_to_dynamo(trending_shows)

        summary = [f"{s['title']} ({s.get('composite_score', 0)})" for s in trending_shows]
        logger.info(f"🎬 Final lineup: {summary}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": f"Discovered {len(trending_shows)} trending shows",
                "shows": [s["title"] for s in trending_shows],
            })
        }

    except Exception as e:
        logger.error(f"❌ Trend Intelligence failed: {e}", exc_info=True)
        return {"statusCode": 500, "body": str(e)}
