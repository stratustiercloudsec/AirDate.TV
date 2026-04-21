"""
airdate-story-generator v2.2 — On-demand RAG story synthesis
=============================================================
Deploy as:  airedate-story-generator
Runtime:    Python 3.12
Timeout:    60s
Memory:     512MB
Env vars:   TMDB_API_KEY, TAVILY_API_KEY, NEWS_API_KEY,
            GOOGLE_API_KEY (optional), GOOGLE_CSE_ID (optional),
            CLAUDE_MODEL_OVERRIDE (optional — defaults to amazon.nova-lite-v1:0)
Trigger:    API Gateway POST /get-story

v2.2 changes:
  - FIX: switched to Amazon Nova Lite (no 15-day expiry, always active)
  - FIX: synthesize_story now uses Nova Converse API format (not Anthropic format)
  - FIX: removed broken mixed Claude/Nova response parsing
  - KEEP: all v2.1 fixes (cache poisoning, existing_urls, domain in citations, TMDB context)
"""

import json
import logging
import os
import re
import time
import base64
import hashlib
from datetime import datetime
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import urllib3
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

http    = urllib3.PoolManager(maxsize=30, timeout=urllib3.Timeout(connect=5, read=12))
bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

# ── Env ────────────────────────────────────────────────────────────────────────
TMDB_API_KEY   = os.environ.get("TMDB_API_KEY", "")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
NEWS_API_KEY   = os.environ.get("NEWS_API_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GOOGLE_CSE_ID  = os.environ.get("GOOGLE_CSE_ID", "")
AWS_REGION     = os.environ.get("AWS_REGION", "us-east-1")

# Nova Lite — no 15-day expiry, always active, no cross-region profile needed
CLAUDE_MODEL       = os.environ.get("CLAUDE_MODEL_OVERRIDE", "amazon.nova-lite-v1:0")
TMDB_BASE          = "https://api.themoviedb.org/3"
TMDB_IMG_W500      = "https://image.tmdb.org/t/p/w500"
TMDB_IMG_W185      = "https://image.tmdb.org/t/p/w185"
CACHE_TABLE        = "airdate-cache"
CACHE_TTL          = 21600   # 6 hours
MAX_CHARS_PER_SRC  = 1200
MAX_SOURCES        = 12
MAX_STORY_TOKENS   = 1800

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
}

TRADE_DOMAINS = [
    "variety.com", "deadline.com", "hollywoodreporter.com",
    "ew.com", "tvline.com", "indiewire.com", "thewrap.com",
    "screenrant.com", "collider.com",
]
CULTURE_DOMAINS = [
    "vulture.com", "theatlantic.com", "nytimes.com",
    "theguardian.com", "rogerebert.com", "avclub.com",
]
GENERAL_DOMAINS = [
    "cnn.com", "bbc.com", "nbcnews.com",
    "usatoday.com", "rollingstone.com",
]
ALL_SOURCE_DOMAINS = TRADE_DOMAINS + CULTURE_DOMAINS + GENERAL_DOMAINS

SYNTHESIS_SYSTEM = """You are an entertainment journalist writing for AirDate, a TV industry intelligence platform.
You write sharp, informed, cited stories for entertainment insiders — writers, producers, executives.
Tone: authoritative, conversational, never tabloid. Think Variety meets The Atlantic.
You must respond with ONLY a valid JSON object. No preamble, no markdown fences, no explanation."""

# ── DynamoDB Cache ─────────────────────────────────────────────────────────────
_dynamo      = None
_cache_table = None

def _get_cache_table():
    global _dynamo, _cache_table
    if _cache_table is None:
        _dynamo      = boto3.resource("dynamodb", region_name=AWS_REGION)
        _cache_table = _dynamo.Table(CACHE_TABLE)
    return _cache_table

def _story_cache_key(show_title: str, headline: str) -> str:
    raw = f"story:{show_title.lower().strip()}:{headline.lower().strip()[:80]}"
    return hashlib.md5(raw.encode()).hexdigest()[:20]

def story_cache_get(show_title: str, headline: str) -> Optional[dict]:
    try:
        table = _get_cache_table()
        resp  = table.get_item(Key={
            "cache_key":    _story_cache_key(show_title, headline),
            "content_type": "story",
        })
        item = resp.get("Item")
        if not item:
            return None
        if item.get("ttl", 0) < int(time.time()):
            return None
        logger.info(f"Story cache HIT: '{show_title}'")
        return json.loads(item["payload"])
    except Exception as e:
        logger.warning(f"Story cache GET error (non-fatal): {e}")
        return None

def story_cache_put(show_title: str, headline: str, story: dict) -> None:
    # Never cache error fallback stories
    if story.get("_error") or \
       story.get("body", "").startswith("Unable to generate") or \
       story.get("body", "").startswith("Story synthesis"):
        logger.info(f"Skipping cache — error story for '{show_title}'")
        return
    try:
        table = _get_cache_table()
        table.put_item(Item={
            "cache_key":    _story_cache_key(show_title, headline),
            "content_type": "story",
            "payload":      json.dumps(story, default=str),
            "ttl":          int(time.time()) + CACHE_TTL,
            "show_title":   show_title,
            "cached_at":    datetime.now().isoformat(),
        })
        logger.info(f"Story cache WRITE: '{show_title}' (TTL {CACHE_TTL}s)")
    except Exception as e:
        logger.warning(f"Story cache PUT error (non-fatal): {e}")

# ── Tavily ─────────────────────────────────────────────────────────────────────
def tavily_fetch(query: str, domains: Optional[list], max_results: int = 5) -> list:
    if not TAVILY_API_KEY:
        return []
    try:
        payload = {
            "api_key":        TAVILY_API_KEY,
            "query":          query,
            "search_depth":   "advanced",
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
            return []
        results = json.loads(resp.data.decode()).get("results", [])

        if not results and domains:
            logger.info(f"Tavily domain-free fallback for '{query}'")
            return tavily_fetch(query, None, max_results)

        return results
    except Exception as e:
        logger.warning(f"Tavily error: {e}")
        return []

# ── NewsAPI ────────────────────────────────────────────────────────────────────
def newsapi_fetch(query: str, domains: list, page_size: int = 20) -> list:
    if not NEWS_API_KEY:
        return []
    try:
        params = {
            "q":        query,
            "language": "en",
            "sortBy":   "relevancy",
            "pageSize": page_size,
            "domains":  ",".join(domains[:20]),
            "apiKey":   NEWS_API_KEY,
        }
        resp = http.request("GET", f"https://newsapi.org/v2/everything?{urlencode(params)}")
        if resp.status != 200:
            return []
        return json.loads(resp.data.decode()).get("articles", [])
    except Exception as e:
        logger.warning(f"NewsAPI error: {e}")
        return []

# ── Google CSE ─────────────────────────────────────────────────────────────────
def google_fetch(query: str, num: int = 5) -> list:
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID:
        return []
    try:
        params = {
            "key": GOOGLE_API_KEY,
            "cx":  GOOGLE_CSE_ID,
            "q":   query,
            "num": num,
        }
        resp = http.request("GET", f"https://www.googleapis.com/customsearch/v1?{urlencode(params)}")
        if resp.status != 200:
            return []
        items = json.loads(resp.data.decode()).get("items", [])
        return [{"url": i.get("link",""), "title": i.get("title",""),
                 "content": i.get("snippet","")} for i in items]
    except Exception as e:
        logger.warning(f"Google CSE error: {e}")
        return []

# ── TMDB ───────────────────────────────────────────────────────────────────────
def tmdb_get_show_meta(tmdb_id: Optional[int], show_title: str) -> dict:
    meta = {
        "poster_url":   None,
        "backdrop_url": None,
        "overview":     "",
        "networks":     [],
        "cast":         [],
        "seasons":      0,
        "episodes":     0,
        "vote_average": None,
        "status":       "",
        "genres":       [],
    }
    if not TMDB_API_KEY:
        return meta

    try:
        if not tmdb_id and show_title:
            params = {"api_key": TMDB_API_KEY, "query": show_title, "language": "en-US"}
            r = http.request("GET", f"{TMDB_BASE}/search/tv?{urlencode(params)}")
            if r.status == 200:
                results = json.loads(r.data.decode()).get("results", [])
                if results:
                    tmdb_id = results[0]["id"]

        if not tmdb_id:
            return meta

        params = {"api_key": TMDB_API_KEY, "language": "en-US", "append_to_response": "credits"}
        r = http.request("GET", f"{TMDB_BASE}/tv/{tmdb_id}?{urlencode(params)}")
        if r.status != 200:
            return meta

        d = json.loads(r.data.decode())

        meta["poster_url"]   = f"{TMDB_IMG_W500}{d['poster_path']}"   if d.get("poster_path")   else None
        meta["backdrop_url"] = f"{TMDB_IMG_W500}{d['backdrop_path']}" if d.get("backdrop_path") else None
        meta["overview"]     = d.get("overview", "")
        meta["networks"]     = [n.get("name") for n in d.get("networks", []) if n.get("name")]
        meta["seasons"]      = d.get("number_of_seasons", 0)
        meta["episodes"]     = d.get("number_of_episodes", 0)
        meta["vote_average"] = d.get("vote_average")
        meta["status"]       = d.get("status", "")
        meta["genres"]       = [g.get("name") for g in d.get("genres", []) if g.get("name")]

        credits = d.get("credits", {})
        meta["cast"] = [
            {
                "name":        p.get("name", ""),
                "character":   p.get("character", ""),
                "profile_url": f"{TMDB_IMG_W185}{p['profile_path']}" if p.get("profile_path") else None,
            }
            for p in credits.get("cast", [])[:5]
        ]

    except Exception as e:
        logger.warning(f"TMDB meta error: {e}")

    return meta

# ── Source retrieval ───────────────────────────────────────────────────────────
def retrieve_all_sources(show_title: str, headline: str, existing_urls: list) -> list:
    query = f"{show_title} {headline}"

    tasks = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        tasks["trade_tavily"]   = ex.submit(tavily_fetch, query, TRADE_DOMAINS, 5)
        tasks["culture_tavily"] = ex.submit(tavily_fetch, query, CULTURE_DOMAINS, 4)
        tasks["general_tavily"] = ex.submit(tavily_fetch, query, GENERAL_DOMAINS, 3)
        tasks["newsapi"]        = ex.submit(newsapi_fetch, query, ALL_SOURCE_DOMAINS, 20)
        tasks["google"]         = ex.submit(google_fetch, query, 5)

        results = {}
        for key, fut in tasks.items():
            try:
                results[key] = fut.result(timeout=15)
            except Exception as e:
                logger.warning(f"Retrieval task '{key}' failed: {e}")
                results[key] = []

    sources   = []
    seen_urls = set()

    def _add(items, source_type="tavily"):
        for item in (items or []):
            url = item.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            if source_type == "newsapi":
                title   = item.get("title", "")
                content = (item.get("description") or "")[:MAX_CHARS_PER_SRC]
                dm      = re.search(r"https?://(?:www\.)?([^/]+)", url)
                domain  = item.get("source", {}).get("name", "") or (dm.group(1) if dm else "")
            else:
                title   = item.get("title", "")
                content = (item.get("content") or item.get("snippet") or "")[:MAX_CHARS_PER_SRC]
                dm      = re.search(r"https?://(?:www\.)?([^/]+)", url)
                domain  = dm.group(1) if dm else ""

            if not title or "[Removed]" in title:
                continue
            sources.append({"title": title, "url": url, "domain": domain, "content": content})

    # Existing card URLs added as priority sources first
    for url in existing_urls[:5]:
        if url and url not in seen_urls:
            seen_urls.add(url)
            dm = re.search(r"https?://(?:www\.)?([^/]+)", url)
            sources.append({
                "title": url, "url": url,
                "domain": dm.group(1) if dm else "", "content": "",
            })

    _add(results.get("trade_tavily",   []), "tavily")
    _add(results.get("culture_tavily", []), "tavily")
    _add(results.get("general_tavily", []), "tavily")
    _add(results.get("newsapi",        []), "newsapi")
    _add(results.get("google",         []), "tavily")

    return sources

# ── Ranking ────────────────────────────────────────────────────────────────────
def rank_sources(sources: list, show_title: str, headline: str) -> list:
    title_lower      = show_title.lower()
    keywords         = set(re.findall(r'\b\w{4,}\b', headline.lower()))
    priority_domains = set(TRADE_DOMAINS)

    def score(s):
        txt    = (s.get("title","") + " " + s.get("content","")).lower()
        domain = s.get("domain","").lower()
        sc     = 0
        if title_lower and title_lower in txt:
            sc += 10
        sc += sum(1 for kw in keywords if kw in txt) * 2
        if any(d in domain for d in priority_domains):
            sc += 5
        if s.get("content"):
            sc += min(len(s["content"]) // 100, 5)
        return sc

    return sorted(sources, key=score, reverse=True)[:MAX_SOURCES]

# ── Prompt builder ─────────────────────────────────────────────────────────────
def build_prompt(show_title: str, headline: str, category: str,
                 sources: list, show_meta: dict) -> str:
    parts = [
        f"SHOW: {show_title}",
        f"HEADLINE: {headline}",
        f"CATEGORY: {category}",
        f"NETWORK(S): {', '.join(show_meta.get('networks', [])) or 'Unknown'}",
        f"GENRES: {', '.join(show_meta.get('genres', [])) or 'Unknown'}",
        f"STATUS: {show_meta.get('status', 'Unknown')}",
        f"SEASONS: {show_meta.get('seasons', 'Unknown')} | EPISODES: {show_meta.get('episodes', 'Unknown')}",
        f"TMDB SCORE: {show_meta.get('vote_average') or 'N/A'}",
    ]

    if show_meta.get("overview"):
        parts.append(f"SHOW OVERVIEW: {show_meta['overview'][:300]}")

    if show_meta.get("cast"):
        cast_str = ", ".join(
            f"{c['name']} as {c['character']}" if c.get("character") else c["name"]
            for c in show_meta["cast"][:5]
        )
        parts.append(f"CAST: {cast_str}")

    parts += ["", "SOURCES:"]
    for i, s in enumerate(sources[:8], 1):
        parts.append(f"[{i}] {s['domain']} — {s['title']}")
        if s.get("content"):
            parts.append(f"    {s['content'][:400]}")

    parts += [
        "",
        "TASK: Write a short entertainment news story based on the sources and show context above.",
        "Return ONLY this JSON structure — no markdown, no preamble, no trailing text:",
        '{',
        '  "headline": "compelling rewritten headline",',
        '  "lede": "one punchy opening sentence (25-40 words)",',
        '  "body": "2-3 paragraph story with inline [1] citation markers",',
        '  "key_facts": ["fact 1", "fact 2", "fact 3"],',
        '  "citations": [{"index": 1, "title": "...", "url": "...", "domain": "variety.com"}]',
        '}',
        "No other text.",
    ]
    return "\n".join(parts)

# ── Bedrock synthesis — Amazon Nova Converse format ────────────────────────────
def synthesize_story(show_title: str, headline: str, category: str,
                     sources: list, show_meta: dict) -> dict:
    prompt = build_prompt(show_title, headline, category, sources, show_meta)
    text   = ""
    try:
        # Nova Lite uses the Converse-style body format
        response = bedrock.invoke_model(
            modelId=CLAUDE_MODEL,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": SYNTHESIS_SYSTEM + "\n\n" + prompt}]
                    }
                ],
                "inferenceConfig": {
                    "maxTokens":   MAX_STORY_TOKENS,
                    "temperature": 0.7,
                }
            }),
        )
        raw  = json.loads(response["body"].read())

        # Nova response shape: output.message.content[0].text
        text = (
            raw.get("output", {})
               .get("message", {})
               .get("content", [{}])[0]
               .get("text", "")
               .strip()
        )

        if not text:
            raise ValueError(f"Empty response from model. Raw keys: {list(raw.keys())}")

        # Strip markdown fences and control chars
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```\s*$",       "", text)
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

        # Extract outermost JSON object
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)

        story = json.loads(text)
        logger.info(f"Synthesized via {CLAUDE_MODEL}: '{story.get('headline','')[:60]}'")
        return story

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | text[:300]: {text[:300]}")
        return {
            "headline":  headline,
            "lede":      f"Coverage of {show_title} is developing.",
            "body":      "Story synthesis encountered a formatting error. Please try again.",
            "key_facts": [], "citations": [], "_error": True,
        }
    except Exception as e:
        logger.error(f"Bedrock error: {e}", exc_info=True)
        return {
            "headline":  headline,
            "lede":      f"Coverage of {show_title} is developing.",
            "body":      f"Unable to generate story at this time: {str(e)}",
            "key_facts": [], "citations": [], "_error": True,
        }

# ── Handler ────────────────────────────────────────────────────────────────────
def lambda_handler(event, context):
    start = time.time()

    if event.get("warmup"):
        logger.info("Warmup ping received")
        return {"statusCode": 200, "headers": HEADERS, "body": json.dumps({"status": "warm"})}

    method = (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method", "")
    ).upper()
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": HEADERS, "body": ""}

    try:
        raw_body = event.get("body") or "{}"
        if event.get("isBase64Encoded") and raw_body:
            raw_body = base64.b64decode(raw_body).decode("utf-8")
        body = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or {})

        headline   = (body.get("headline") or "").strip()
        show_title = (body.get("show_title") or "").strip()
        cache_bust = bool(body.get("cache_bust", False))

        if not headline:
            return {
                "statusCode": 400,
                "headers":    HEADERS,
                "body":       json.dumps({"success": False, "error": "headline is required"}),
            }

        if not show_title:
            show_title = " ".join(headline.split()[:6])
            logger.info(f"show_title fallback: '{show_title}'")

        category      = body.get("category", "general")
        existing_urls = body.get("urls", [])[:5]
        tmdb_id       = body.get("tmdb_id")

        # Cache check
        if not cache_bust:
            cached_story = story_cache_get(show_title, headline)
            if cached_story:
                cached_story["cache_hit"] = True
                return {
                    "statusCode": 200,
                    "headers":    HEADERS,
                    "body":       json.dumps({
                        "success":         True,
                        "cache_hit":       True,
                        "generated_at":    cached_story.get("generated_at", datetime.now().isoformat()),
                        "elapsed_seconds": round(time.time() - start, 2),
                        "source_count":    cached_story.get("source_count", 0),
                        "story":           cached_story,
                    }, default=str),
                }

        logger.info(f"Cache MISS — generating: '{show_title}' | '{headline[:60]}'")

        with ThreadPoolExecutor(max_workers=2) as ex:
            retrieval_future = ex.submit(retrieve_all_sources, show_title, headline, existing_urls)
            tmdb_future      = ex.submit(tmdb_get_show_meta, tmdb_id, show_title)
            sources   = retrieval_future.result(timeout=22)
            show_meta = tmdb_future.result(timeout=10)

        ranked_sources = rank_sources(sources, show_title, headline)
        story          = synthesize_story(show_title, headline, category, ranked_sources, show_meta)

        story["show_meta"]    = show_meta
        story["cache_hit"]    = False
        story["source_count"] = len(ranked_sources)
        story["generated_at"] = datetime.now().isoformat()

        story_cache_put(show_title, headline, story)

        elapsed = round(time.time() - start, 2)
        logger.info(f"Story generated in {elapsed}s from {len(ranked_sources)} sources")

        return {
            "statusCode": 200,
            "headers":    HEADERS,
            "body":       json.dumps({
                "success":         True,
                "cache_hit":       False,
                "generated_at":    story["generated_at"],
                "elapsed_seconds": elapsed,
                "source_count":    len(ranked_sources),
                "story":           story,
            }, default=str),
        }

    except Exception as e:
        logger.error(f"Handler error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers":    HEADERS,
            "body":       json.dumps({"success": False, "error": str(e)}),
        }