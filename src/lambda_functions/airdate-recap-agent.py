"""
AirDate Recap Agent - Enhanced RAG Framework v2.2
- Fixed model request format — supports both Claude (Anthropic format)
  and Amazon Nova (Converse API format) based on MODEL_ID
- IAM note: role needs bedrock:InvokeModel + bedrock:Converse permissions
"""

import json
import logging
import urllib3
import os
import boto3
import time
import hashlib
from urllib.parse import urlencode, quote_plus
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# HTTP & AWS clients
http = urllib3.PoolManager(maxsize=20, block=False)
bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

# ============================================================================
# CONFIGURATION & ENVIRONMENT
# ============================================================================

def get_env(key: str, required: bool = True) -> Optional[str]:
    """Safely retrieve environment variables"""
    value = os.environ.get(key)
    if required and not value:
        raise ValueError(f"Missing required environment variable: {key}")
    return value

# API Keys
TMDB_API_KEY  = get_env("TMDB_API_KEY")
NEWS_API_KEY  = get_env("NEWS_API_KEY",  required=False)
TAVILY_API_KEY= get_env("TAVILY_API_KEY",required=False)
GOOGLE_API_KEY= get_env("GOOGLE_API_KEY",required=False)
GOOGLE_CX     = get_env("GOOGLE_CX",     required=False)

# Model — read CLAUDE_MODEL_OVERRIDE (matches existing env var name)
# Default to Claude Haiku via cross-region inference (cheap, fast, correct format)
MODEL_ID = os.environ.get("CLAUDE_MODEL_OVERRIDE",
                          "us.anthropic.claude-3-haiku-20240307-v1:0")

logger.info(f"Using model: {MODEL_ID}")

# API Endpoints
TMDB_BASE    = "https://api.themoviedb.org/3"
TAVILY_URL   = "https://api.tavily.com/search"
NEWS_API_URL = "https://newsapi.org/v2/everything"
GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
}
# ============================================================================
#  DynamoDB Response Cache 
# ============================================================================
CACHE_TABLE    = os.environ.get("CACHE_TABLE", "airdate-cache")
RECAP_CACHE_TTL = 86400  # 24 hours — recaps don't change daily

_cache_dynamo = None
def _get_cache_table():
    global _cache_dynamo
    if _cache_dynamo is None:
        _cache_dynamo = boto3.resource("dynamodb", region_name="us-east-1")
    return _cache_dynamo.Table(CACHE_TABLE)

def recap_cache_get(series_title: str) -> Optional[str]:
    try:
        key  = "recap#" + hashlib.md5(series_title.lower().strip().encode()).hexdigest()[:16]
        resp = _get_cache_table().get_item(Key={"cache_key": key})
        item = resp.get("Item")
        if not item or item.get("ttl", 0) < int(time.time()):
            return None
        logger.info(f"[Cache] HIT recap: {series_title}")
        return item["recap_text"]
    except Exception as e:
        logger.warning(f"[Cache] recap GET error: {e}")
        return None

def recap_cache_put(series_title: str, recap_text: str) -> None:
    try:
        key = "recap#" + hashlib.md5(series_title.lower().strip().encode()).hexdigest()[:16]
        _get_cache_table().put_item(Item={
            "cache_key":  key,
            "recap_text": recap_text,
            "title":      series_title,
            "ttl":        int(time.time()) + RECAP_CACHE_TTL,
            "cached_at":  datetime.now().isoformat(),
        })
        logger.info(f"[Cache] SET recap: {series_title} (TTL 24h)")
    except Exception as e:
        logger.warning(f"[Cache] recap PUT error: {e}")

# ============================================================================
# DATA RETRIEVAL LAYER  (unchanged from v2.1)
# ============================================================================

class TMDBRetriever:
    @staticmethod
    def search_series(title: str) -> Dict:
        try:
            params = {"api_key": TMDB_API_KEY, "language": "en-US",
                      "query": title, "include_adult": "false"}
            r = http.request("GET", f"{TMDB_BASE}/search/tv?{urlencode(params)}", timeout=5.0)
            if r.status == 200:
                data = json.loads(r.data.decode())
                return data.get("results", [{}])[0] if data.get("results") else {}
            return {}
        except Exception as e:
            logger.error(f"TMDB search error: {e}")
            return {}

    @staticmethod
    def get_series_details(series_id: int) -> Dict:
        try:
            params = {"api_key": TMDB_API_KEY, "language": "en-US",
                      "append_to_response": "credits,keywords,external_ids,content_ratings,videos"}
            r = http.request("GET", f"{TMDB_BASE}/tv/{series_id}?{urlencode(params)}", timeout=5.0)
            if r.status == 200:
                return json.loads(r.data.decode())
            return {}
        except Exception as e:
            logger.error(f"TMDB details error: {e}")
            return {}

    @staticmethod
    def get_latest_season(series_id: int) -> Dict:
        try:
            details = TMDBRetriever.get_series_details(series_id)
            if details and details.get("seasons"):
                regular_seasons = [s for s in details["seasons"] if s.get("season_number", 0) > 0]
                if regular_seasons:
                    return max(regular_seasons, key=lambda x: x.get("season_number", 0))
            return {}
        except Exception as e:
            logger.error(f"Latest season error: {e}")
            return {}


class NewsAPIRetriever:
    @staticmethod
    def fetch_news(query: str, days_back: int = 30) -> List[Dict]:
        if not NEWS_API_KEY:
            return []
        try:
            from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
            params = {"apiKey": NEWS_API_KEY,
                      "q": f'"{query}" AND (production OR premiere OR delay OR renewal OR canceled)',
                      "from": from_date, "sortBy": "relevancy",
                      "language": "en", "pageSize": 10}
            r = http.request("GET", f"{NEWS_API_URL}?{urlencode(params)}", timeout=5.0)
            if r.status == 200:
                data = json.loads(r.data.decode())
                articles = data.get("articles", [])
                return [{"title": a.get("title",""), "source": a.get("source",{}).get("name","Unknown"),
                         "description": a.get("description",""), "url": a.get("url",""),
                         "publishedAt": a.get("publishedAt","")} for a in articles[:5]]
            return []
        except Exception as e:
            logger.error(f"NewsAPI error: {e}")
            return []


class TavilyRetriever:
    @staticmethod
    def search(query: str, search_type: str = "general") -> List[Dict]:
        if not TAVILY_API_KEY:
            return []
        try:
            query_templates = {
                "general":    f"{query} TV series 2026 news updates",
                "production": f"{query} production status behind scenes filming delay",
                "review":     f"{query} Rotten Tomatoes critic reviews ratings",
                "premiere":   f"{query} premiere date release schedule TBD announcement"
            }
            enhanced_query = query_templates.get(search_type, query)
            payload = {"api_key": TAVILY_API_KEY, "query": enhanced_query,
                       "search_depth": "advanced", "max_results": 5,
                       "include_domains": ["variety.com","deadline.com",
                                           "hollywoodreporter.com","ew.com",
                                           "indiewire.com","rottentomatoes.com"]}
            r = http.request("POST", TAVILY_URL, body=json.dumps(payload),
                             headers={"Content-Type": "application/json"}, timeout=6.0)
            if r.status == 200:
                data = json.loads(r.data.decode())
                return [{"title": res.get("title",""), "url": res.get("url",""),
                         "content": res.get("content","")[:500],
                         "score": res.get("score",0),
                         "published_date": res.get("published_date","")}
                        for res in data.get("results",[])]
            return []
        except Exception as e:
            logger.error(f"Tavily error: {e}")
            return []


class RottenTomatoesRetriever:
    @staticmethod
    def get_score(series_title: str, season: Optional[int] = None) -> Dict:
        try:
            if TAVILY_API_KEY:
                query = f"{series_title} season {season} Rotten Tomatoes" if season else f"{series_title} Rotten Tomatoes"
                results = TavilyRetriever.search(query, "review")
                for result in results:
                    if "rottentomatoes.com" in result.get("url",""):
                        return {"score": "Available on RT", "url": result.get("url",""),
                                "found": True, "excerpt": result.get("content","")[:200]}
            return {"score": None, "url": None, "found": False}
        except Exception as e:
            logger.error(f"RT error: {e}")
            return {"score": None, "url": None, "found": False}


class SimpleTrailerFetcher:
    @staticmethod
    def get_trailer(series_id: int) -> Dict:
        try:
            details = TMDBRetriever.get_series_details(series_id)
            if not details:
                return {"available": False}
            videos = details.get("videos", {}).get("results", [])
            trailers = [v for v in videos
                        if v.get("site") == "YouTube" and v.get("type") in ["Trailer","Teaser"]]
            if not trailers:
                return {"available": False}
            trailer = trailers[0]
            video_id = trailer.get("key")
            return {"available": True, "url": f"https://www.youtube.com/watch?v={video_id}",
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "title": trailer.get("name","Trailer"), "type": trailer.get("type","Trailer")}
        except Exception as e:
            logger.error(f"Trailer fetch error: {e}")
            return {"available": False}


# ============================================================================
# RAG ORCHESTRATION LAYER  (unchanged from v2.1)
# ============================================================================

class RecapRAGOrchestrator:
    def __init__(self, series_title: str):
        self.series_title = series_title
        self.context = {
            "tmdb": {}, "news": [], "tavily_general": [],
            "tavily_production": [], "tavily_premiere": [],
            "trade_intel": [], "rt_score": {},
            "metadata": {"retrieved_at": datetime.now().isoformat(),
                         "series_title": series_title}
        }

    def retrieve_all(self) -> Dict:
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {
                executor.submit(self._retrieve_tmdb):              "tmdb",
                executor.submit(self._retrieve_news):              "news",
                executor.submit(self._retrieve_tavily_general):    "tavily_general",
                executor.submit(self._retrieve_tavily_production): "tavily_production",
                executor.submit(self._retrieve_tavily_premiere):   "tavily_premiere",
                executor.submit(self._retrieve_rt_score):          "rt_score",
            }
            for future in as_completed(futures):
                source = futures[future]
                try:
                    self.context[source] = future.result(timeout=10)
                except Exception as e:
                    logger.error(f"Error retrieving {source}: {e}")
        return self.context

    def _retrieve_tmdb(self) -> Dict:
        search_result = TMDBRetriever.search_series(self.series_title)
        if search_result and search_result.get("id"):
            details = TMDBRetriever.get_series_details(search_result["id"])
            latest_season = TMDBRetriever.get_latest_season(search_result["id"])
            return {"basic": search_result, "details": details, "latest_season": latest_season}
        return {}

    def _retrieve_news(self)             -> List[Dict]: return NewsAPIRetriever.fetch_news(self.series_title)
    def _retrieve_tavily_general(self)   -> List[Dict]: return TavilyRetriever.search(self.series_title, "general")
    def _retrieve_tavily_production(self)-> List[Dict]: return TavilyRetriever.search(self.series_title, "production")
    def _retrieve_tavily_premiere(self)  -> List[Dict]: return TavilyRetriever.search(self.series_title, "premiere")

    def _retrieve_rt_score(self) -> Dict:
        season_num = None
        if self.context.get("tmdb",{}).get("latest_season"):
            season_num = self.context["tmdb"]["latest_season"].get("season_number")
        return RottenTomatoesRetriever.get_score(self.series_title, season_num)

    def build_rag_context(self) -> str:
        sections = []
        tmdb = self.context.get("tmdb",{})
        if tmdb:
            details = tmdb.get("details",{})
            latest_season = tmdb.get("latest_season",{})
            sections.append(f"""
=== SERIES METADATA (TMDB) ===
Title: {details.get('name','Unknown')}
Status: {details.get('status','Unknown')}
Overview: {details.get('overview','N/A')}
Genres: {', '.join([g['name'] for g in details.get('genres',[])])}
First Air Date: {details.get('first_air_date','N/A')}
Latest Season: {latest_season.get('season_number','N/A')} - {latest_season.get('name','N/A')}
Latest Season Air Date: {latest_season.get('air_date','TBD')}
Networks: {', '.join([n['name'] for n in details.get('networks',[])])}
Number of Seasons: {details.get('number_of_seasons','N/A')}
Number of Episodes: {details.get('number_of_episodes','N/A')}
""")
        news = self.context.get("news",[])
        if news:
            sections.append("=== RECENT NEWS ===\n" + "\n".join(
                [f"- [{n['source']}] {n['title']}: {n['description'][:150]}..." for n in news[:3]]))
        production = self.context.get("tavily_production",[])
        if production:
            sections.append("=== PRODUCTION INSIGHTS ===\n" + "\n".join(
                [f"- {p['title']}: {p['content'][:200]}..." for p in production[:3]]))
        premiere = self.context.get("tavily_premiere",[])
        if premiere:
            sections.append("=== PREMIERE & RELEASE INTELLIGENCE ===\n" + "\n".join(
                [f"- {p['title']}: {p['content'][:200]}..." for p in premiere[:3]]))
        general = self.context.get("tavily_general",[])
        if general:
            sections.append("=== GENERAL UPDATES ===\n" + "\n".join(
                [f"- {g['title']}: {g['content'][:150]}..." for g in general[:3]]))
        rt = self.context.get("rt_score",{})
        if rt.get("found"):
            sections.append(f"=== ROTTEN TOMATOES ===\nURL: {rt.get('url','N/A')}\nExcerpt: {rt.get('excerpt','N/A')}")
        return "\n".join(sections)


# ============================================================================
# LLM GENERATION LAYER  ✅ v2.2 — multi-model format support
# ============================================================================

def _is_claude_model(model_id: str) -> bool:
    """True for Anthropic Claude models, False for Amazon Nova / others."""
    return "anthropic" in model_id.lower() or "claude" in model_id.lower()


class RecapGenerator:
    """Generate engaging recaps — supports Claude (Anthropic format) and
    Amazon Nova (Converse API format) based on MODEL_ID."""

    @staticmethod
    def generate(series_title: str, rag_context: str) -> Dict:
        prompt = f"""You are an entertainment columnist for Variety and Deadline writing an engaging TV series recap.

Context Information:
{rag_context}

Task: Write a comprehensive, insider-style recap for "{series_title}" that includes:

1. **Current Status** - Production state, renewal status, or cancellation
2. **Behind-the-Scenes Insights** - Production details, filming updates, any delays
3. **Latest Developments** - Recent news, cast changes, creative updates
4. **Premiere/Release Intel** - Confirmed or rumored dates if available
5. **Critical Reception** - Rotten Tomatoes score if available, critic buzz
6. **What's Next** - Upcoming episodes, seasons, or developments

Style: Engaging insider voice (like Variety/Deadline). Factual but conversational.
Keep it concise but informative (300-400 words)."""

        try:
            if _is_claude_model(MODEL_ID):
                # ── Anthropic / Claude format ─────────────────────────────────
                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2000,
                    "temperature": 0.7,
                    "messages": [{"role": "user", "content": prompt}]
                }
                response      = bedrock.invoke_model(modelId=MODEL_ID, body=json.dumps(request_body))
                response_body = json.loads(response["body"].read())
                recap_text    = response_body["content"][0]["text"]

            else:
                # ── Amazon Nova / Titan — Converse API format ─────────────────
                response   = bedrock.converse(
                    modelId=MODEL_ID,
                    messages=[{"role": "user", "content": [{"text": prompt}]}],
                    inferenceConfig={"maxTokens": 2000, "temperature": 0.7}
                )
                recap_text = response["output"]["message"]["content"][0]["text"]

            return {"recap": recap_text, "model": MODEL_ID,
                    "generated_at": datetime.now().isoformat()}

        except Exception as e:
            logger.error(f"Recap generation error: {e}")
            return {"recap": f"Unable to generate recap at this time. Error: {str(e)}",
                    "model": MODEL_ID, "generated_at": datetime.now().isoformat(),
                    "error": str(e)}


# ============================================================================
# LAMBDA HANDLER  (unchanged from v2.1)
# ============================================================================

def lambda_handler(event, context):
    start_time = time.time()
    try:
        body_raw     = event.get("body", "{}")
        body         = json.loads(body_raw) if isinstance(body_raw, str) else body_raw
        series_title = body.get("series_title", body.get("seriesTitle", "Unknown Series"))
        cache_bust   = bool(body.get("cache_bust", False))

        logger.info(f"Processing recap for: {series_title} (model={MODEL_ID})")

        # ── Cache check — skip Bedrock if recap already generated today ────────
        if not cache_bust:
            cached_recap = recap_cache_get(series_title)
            if cached_recap:
                return {
                    "statusCode": 200,
                    "headers": HEADERS,
                    "body": json.dumps({
                        "success":          True,
                        "seriesTitle":      series_title,
                        "recap":            cached_recap,
                        "trailerUrl":       "",
                        "trailerAvailable": False,
                        "cache_hit":        True,
                        "metadata": {
                            "model":       MODEL_ID,
                            "generated_at": datetime.now().isoformat(),
                            "processing_time_seconds": 0,
                            "cache_hit":   True,
                        }
                    })
                }

        # ── Cache miss — run full RAG + Bedrock pipeline ───────────────────────
        orchestrator     = RecapRAGOrchestrator(series_title)
        rag_context_data = orchestrator.retrieve_all()
        rag_context_str  = orchestrator.build_rag_context()
        recap_result     = RecapGenerator.generate(series_title, rag_context_str)

        # ── Cache the generated recap ──────────────────────────────────────────
        if recap_result.get("recap") and not recap_result.get("error"):
            recap_cache_put(series_title, recap_result["recap"])

        trailer_info = {"available": False}
        if rag_context_data.get("tmdb", {}).get("basic", {}).get("id"):
            try:
                trailer_info = SimpleTrailerFetcher.get_trailer(
                    rag_context_data["tmdb"]["basic"]["id"])
            except Exception as e:
                logger.error(f"Trailer error: {e}")

        processing_time = time.time() - start_time

        response_body = {
            "success":          True,
            "seriesTitle":      series_title,
            "recap":            recap_result.get("recap", ""),
            "trailerUrl":       trailer_info.get("url", "") if trailer_info.get("available") else "",
            "trailerAvailable": trailer_info.get("available", False),
            "cache_hit":        False,
            "metadata": {
                "model":                    recap_result.get("model"),
                "generated_at":             recap_result.get("generated_at"),
                "processing_time_seconds":  round(processing_time, 2),
                "sources_retrieved": {
                    "tmdb":             bool(rag_context_data.get("tmdb")),
                    "news_articles":    len(rag_context_data.get("news", [])),
                    "tavily_results":   len(rag_context_data.get("tavily_general", [])),
                    "production_intel": len(rag_context_data.get("tavily_production", [])),
                    "premiere_intel":   len(rag_context_data.get("tavily_premiere", [])),
                    "rotten_tomatoes":  rag_context_data.get("rt_score", {}).get("found", False),
                    "trailer":          trailer_info.get("available", False)
                }
            }
        }

        if body.get("include_trailer_details"):
            response_body["trailer_details"] = trailer_info
        if body.get("include_raw_context"):
            response_body["raw_context"] = rag_context_data

        return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(response_body)}

    except Exception as e:
        logger.error(f"Lambda handler error: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({
                "success": False, "error": str(e),
                "recap": "", "trailerUrl": "", "trailerAvailable": False
            })
        }
