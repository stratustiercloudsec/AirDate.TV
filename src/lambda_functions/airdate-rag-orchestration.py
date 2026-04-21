# =============================================================================
# airdate-rag-orchestration — v2.33 CLEAN REWRITE
# Fixes: duplicate PassReturning block, orphan module-level code,
#        requests/TMDB_BASE_URL undefined, duplicate TMDB fallback
# =============================================================================

import json, logging, urllib3, os, re, boto3, calendar
import hashlib
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlencode
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
from fuzzy_search import fuzzy_search_handler

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table    = dynamodb.Table('tmdb-show-cache')

TMDB_API_KEY   = os.environ["TMDB_API_KEY"]
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
NEWS_API_KEY   = os.environ.get("NEWS_API_KEY", "")
OMDB_API_KEY   = os.environ.get("OMDB_KEY", "")
TMDB_BASE      = "https://api.themoviedb.org/3"
TMDB_BASE_URL  = TMDB_BASE
IMG_BASE       = "https://image.tmdb.org/t/p/w500"
LOGO_BASE      = "https://image.tmdb.org/t/p/w300"

http    = urllib3.PoolManager()
HEADERS = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}

# ── Date offset for inaccurate TMDB dates ────────────────────────────────────────────────────
def _offset_tmdb_date(date_str):
    """
    TMDB stores first_air_date and episode air_date as UTC midnight.
    For US streaming shows this means the stored date is 1 day behind
    the actual local premiere date. Add 1 day to correct it.
    """
    if not date_str or date_str in ("TBA", "TBD", ""):
        return date_str
    try:
        from datetime import datetime, timedelta
        d = datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)
        return d.strftime("%Y-%m-%d")
    except Exception:
        return date_str

# ── Homepage Response Cache ────────────────────────────────────────────────────
_rag_cache_table = None

def _get_rag_cache():
    global _rag_cache_table
    if _rag_cache_table is None:
        _rag_cache_table = boto3.resource("dynamodb", region_name="us-east-1").Table("airdate-cache")
    return _rag_cache_table

def _rag_cache_key(query: str, network: str, page: int) -> str:
    raw = f"rag:{query.strip().lower()}:{(network or 'all').lower()}:{page}"
    return hashlib.md5(raw.encode()).hexdigest()[:20]

def _rag_cache_ttl(query: str) -> int:
    """Shorter TTL for time-sensitive queries, longer for stable ones."""
    ql = (query or "").lower()
    if "this week"  in ql: return 3600        # 1 hour — week changes daily
    if "next week"  in ql: return 7200        # 2 hours
    if "next month" in ql: return 14400       # 4 hours
    if not query.strip():  return 7200        # homepage pool — 2 hours
    return 10800                              # general queries — 3 hours

def rag_cache_get(query: str, network: str, page: int) -> Optional[dict]:
    try:
        resp = _get_rag_cache().get_item(Key={
            "cache_key":    _rag_cache_key(query, network, page),
            "content_type": "rag_response",
        })
        item = resp.get("Item")
        if not item or item.get("ttl", 0) < int(datetime.now().timestamp()):
            return None
        logger.info(f"RAG cache HIT: '{query[:40]}' / {network}")
        return json.loads(item["payload"])
    except Exception as e:
        logger.warning(f"RAG cache GET error: {e}")
        return None

def rag_cache_put(query: str, network: str, page: int, payload: dict) -> None:
    try:
        ttl = int(datetime.now().timestamp()) + _rag_cache_ttl(query)
        _get_rag_cache().put_item(Item={
            "cache_key":    _rag_cache_key(query, network, page),
            "content_type": "rag_response",
            "payload":      json.dumps(payload, default=str),
            "ttl":          ttl,
            "cached_at":    datetime.now().isoformat(),
        })
        logger.info(f"RAG cache WRITE: '{query[:40]}' (TTL {_rag_cache_ttl(query)}s)")
    except Exception as e:
        logger.warning(f"RAG cache PUT error: {e}")

try:
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    BEDROCK_AVAILABLE = True
except Exception as e:
    BEDROCK_AVAILABLE = False
    logger.warning(f"Bedrock unavailable: {e}")

# =========================================================================
# DATA MAPPINGS
# =========================================================================

NETWORK_MAP = {
    "BET+": 3436, "Prime Video": 1024, "HBO": 49, "HBO Max": 3186,
    "Max": 3186, "Netflix": 213, "Disney+": 2739, "Paramount+": 4330,
    "Apple TV+": 2552, "Apple TV": 2552, "Peacock": 3353, "Tubi": 2503,
    "STARZ": 4406, "Hulu": 453, "The CW": 71, "CBS": 16, "NBC": 6,
    "ABC": 2, "FOX": 19, "FX": 88, "AMC": 174, "Showtime": 67,
    "USA Network": 30, "TNT": 41, "TBS": 68, "Bravo": 74,
    "Freeform": 1267, "A&E": 129, "History": 65, "Lifetime": 34,
    "Comedy Central": 47, "MTV": 33, "VH1": 158, "BET": 24,
    "OWN": 528, "WE tv": 136, "Syfy": 77, "National Geographic": 43,
    "Discovery": 64, "YouTube": 247, "YouTube Premium": 1436,
    "Epix": 4, "MGM+": 34, "Adult Swim": 80, "Crunchyroll": 283,
}

PROVIDER_MAP = {
    "Netflix": 8, "Hulu": 15, "Prime Video": 9, "Amazon Prime": 9,
    "Disney+": 337, "Disney Plus": 337, "HBO Max": 384, "Max": 1899,
    "Paramount+": 531, "Paramount Plus": 531, "Apple TV+": 350, "Apple TV": 350,
    "Peacock": 386, "Tubi": 596, "STARZ": 43, "Showtime": 37,
    "AMC+": 526, "BET+": 1759, "Discovery+": 520, "ESPN+": 531,
    "Crunchyroll": 283, "Funimation": 269, "HBO": 118, "Cinemax": 19,
    "The CW": 83, "Freeform": 211, "FX": 123, "FXX": 1035,
    "ABC": 2024, "NBC": 79, "CBS": 87, "FOX": 1071,
    "Showtime Amazon Channel": 1770, "STARZ Play Amazon Channel": 1855,
    "Paramount+ Amazon Channel": 582, "HBO Max Amazon Channel": 1825,
    "MGM Plus": 34, "MGM+ Amazon Channel": 1852, "Epix": 4,
    "Epix Amazon Channel": 1851, "Hallmark Movies Now": 259,
    "Shudder": 99, "Shudder Amazon Channel": 1849,
    "Sundance Now": 143, "Sundance Now Amazon Channel": 1848,
    "Acorn TV": 87, "Acorn TV Amazon Channel": 1847,
    "BritBox": 380, "BritBox Amazon Channel": 1853,
    "Lifetime": 252, "History": 253, "A&E": 254,
    "TLC": 1037, "Investigation Discovery": 1046,
    "Animal Planet": 2484, "Travel Channel": 1092,
    "Food Network": 1093, "HGTV": 1094, "TBS": 506,
    "TNT": 505, "truTV": 507, "Cartoon Network": 503,
    "Adult Swim": 80, "Boomerang": 504, "VH1": 158,
    "MTV": 33, "Comedy Central": 47, "Nickelodeon": 13,
    "Syfy": 77, "USA Network": 30, "E!": 1044,
    "Bravo": 74, "Oxygen": 1043, "WE tv": 136,
    "OWN": 528, "Freeform": 1267, "National Geographic": 43,
    "Smithsonian Channel": 246, "PBS": 209,
    "YouTube Premium": 235, "YouTube": 247,
    "Pluto TV": 300, "Plex": 538, "Roku Channel": 207,
    "Freevee": 613, "Vudu": 7, "Redbox": 279,
}

NETWORK_ALIASES = {
    "Prime Video":    ["amazon", "prime video", "amazon prime", "prime"],
    "BET+":           ["bet+", "bet plus"],
    "BET":            ["bet network", "bet"],
    "Apple TV+":      ["apple tv+", "apple tv", "appletv+", "appletv", "apple"],
    "Paramount+":     ["paramount+", "paramount plus", "paramount"],
    "Disney+":        ["disney+", "disney plus", "disney"],
    "HBO":            ["hbo"],
    "HBO Max":        ["hbo max", "max"],
    "Max":            ["max"],
    "Peacock":        ["peacock"],
    "NBC":            ["nbc"],
    "CBS":            ["cbs"],
    "ABC":            ["abc"],
    "FOX":            ["fox"],
    "FX":             ["fx"],
    "Netflix":        ["netflix"],
    "Tubi":           ["tubi"],
    "STARZ":          ["starz", "starz!", "starz entertainment"],
    "Hulu":           ["hulu", "hulu on disney+"],
    "The CW":         ["the cw", "cw"],
    "AMC":            ["amc"],
    "Showtime":       ["showtime", "sho"],
    "USA Network":    ["usa network", "usa"],
    "Syfy":           ["syfy", "sci fi channel"],
    "OWN":            ["own", "oprah winfrey network"],
    "Comedy Central": ["comedy central"],
    "Bravo":          ["bravo"],
    "Freeform":       ["freeform"],
    "YouTube":        ["youtube", "yt"],
    "YouTube Premium":["youtube premium", "youtube originals", "yt premium"],
}

GENRE_MAP = {
    "action": 10759, "action & adventure": 10759, "adventure": 10759,
    "animation": 16, "comedy": 35, "crime": 80, "documentary": 99,
    "drama": 18, "family": 10751, "fantasy": 10765, "horror": 27,
    "kids": 10762, "mystery": 9648, "news": 10763, "reality": 10764,
    "romance": 10749, "sci-fi": 10765, "science fiction": 10765,
    "scifi": 10765, "soap": 10766, "talk": 10767, "thriller": 53,
    "war": 10768, "war & politics": 10768, "western": 37,
}

KEYWORD_MAP = {
    "true crime": 33722, "true-crime": 33722, "serial killer": 34117,
    "murder": 35442, "heist": 10727, "survival": 10757,
    "time travel": 14663, "superhero": 9648, "vampire": 10749,
    "zombie": 10753, "post-apocalyptic": 34017, "space": 29834,
    "historical": 10595, "based on true story": 9673, "true story": 9673,
    "supernatural": 22928, "psychological": 34260,
}

EXCLUDED_GENRE_IDS      = {10767, 10766, 10763}
EXCLUDED_TITLE_KEYWORDS = {
    "tonight show", "late show", "late night show", "this morning",
    "good morning", "the view", "daily show",
    "awards", "award ceremony", "golden globes", "emmys", "oscars",
    "grammy", "sag awards", "critics choice",
}

VALID_PRODUCER_JOBS = {
    "executive producer", "co-executive producer", "producer",
    "creator", "showrunner", "supervising producer",
    "consulting producer", "co-producer",
}

EXCLUDED_JOBS = {
    "guest", "guest star", "self", "host", "panelist", "judge",
    "contestant", "himself", "herself", "narrator", "cameo",
    "thanks", "archive footage", "interviewee", "presenter",
    "actor", "voice", "cast member",
}

PERSON_NOISE_WORDS = {
    'Shows', 'Series', 'Produced', 'By', 'For', 'On', 'In', 'The',
    'List', 'Tv', 'All', 'Premiering', 'Created', 'Starring',
}

# =========================================================================
# SORT HELPERS
# =========================================================================

_TBD_SENTINEL_ASC  = "9999-99-99"
_TBD_SENTINEL_DESC = "0000-00-00"
_DESC_SIGNALS      = {"latest", "newest", "most recent", "recently", "last", "new"}
_TBD_VALUES        = {"", "tba", "tbd"}


def detect_sort_order(query: str) -> str:
    ql = (query or "").lower()
    return "desc" if any(sig in ql for sig in _DESC_SIGNALS) else "asc"


def sort_results(results: List[Dict], order: str = "asc") -> List[Dict]:
    sentinel = _TBD_SENTINEL_ASC if order == "asc" else _TBD_SENTINEL_DESC
    def _key(x):
        pd = x.get("premiereDate") or ""
        return sentinel if not pd or pd.lower() in _TBD_VALUES else pd
    return sorted(results, key=_key, reverse=(order == "desc"))


# =========================================================================
# CORE UTILITIES
# =========================================================================

def safe_int(value, default=0):
    try:
        if value is None: return default
        if isinstance(value, Decimal): return int(value)
        return int(float(value))
    except (ValueError, TypeError):
        return default


def tmdb(path, params=None):
    try:
        p = {"api_key": TMDB_API_KEY, "language": "en-US"}
        if params: p.update(params)
        r = http.request("GET", f"{TMDB_BASE}{path}?{urlencode(p, doseq=True)}", timeout=5.0)
        return json.loads(r.data.decode()) if r.status == 200 else {}
    except Exception as e:
        logger.error(f"TMDB error {path}: {e}")
        return {}


def network_matches(show_network: str, filter_network: str) -> bool:
    if not filter_network or filter_network.strip() in ("All", "All Networks", ""):
        return True
    if not show_network:
        return False
    s, f = show_network.lower().strip(), filter_network.lower().strip()
    if s == f or f in s:
        return True
    for canonical, aliases in NETWORK_ALIASES.items():
        cl = canonical.lower()
        if f == cl or f in [a.lower() for a in aliases]:
            if s == cl or any(a.lower() in s for a in aliases):
                return True
    return False


def is_excluded_genre(genre_ids):
    return bool(set(genre_ids or []) & EXCLUDED_GENRE_IDS)

def is_excluded_by_title(title):
    return any(kw in (title or "").lower() for kw in EXCLUDED_TITLE_KEYWORDS)

def is_significant_producer_credit(job: str) -> bool:
    if not job: return False
    j = job.lower().strip()
    if any(ex in j for ex in EXCLUDED_JOBS): return False
    if j in VALID_PRODUCER_JOBS: return True
    return any(kw in j for kw in ("producer","creator","showrunner","developer",
                                   "executive story editor","story editor"))

def is_significant_actor_credit(character: str) -> bool:
    if not character: return True
    c = character.lower().strip()
    return not any(ex in c for ex in ("self","himself","herself","host","presenter","narrator"))

def detect_person_role(name: str) -> str:
    if not name: return "unknown"
    try:
        res  = tmdb("/search/person", {"query": name}).get("results", [])
        dept = (res[0].get("known_for_department","") if res else "").lower()
        if any(k in dept for k in ("produc","writing","creat")): return "producer"
        if "acting" in dept: return "actor"
    except Exception:
        pass
    return "unknown"


# =========================================================================
# TITLE NORMALIZATION
# =========================================================================

_LEADING_ARTICLES = {"the", "a", "an"}

def normalize_title_query(query: str) -> str:
    words = query.strip().split()
    if words and words[0].lower() in _LEADING_ARTICLES:
        return " ".join(words[1:]) if len(words) > 1 else query
    return query

def title_search_with_fallback(query: str) -> List[Dict]:
    primary    = tmdb("/search/tv", {"query": query}).get("results", [])
    normalized = normalize_title_query(query)
    if normalized == query:
        return primary
    secondary = tmdb("/search/tv", {"query": normalized}).get("results", [])
    seen = {r["id"] for r in primary}
    return primary + [r for r in secondary if r["id"] not in seen]


# =========================================================================
# NETWORK LOGO CACHE
# =========================================================================

_logo_cache: Dict[int, Optional[str]] = {}

def fetch_network_logo(network_id: int) -> Optional[str]:
    if not network_id: return None
    if network_id in _logo_cache: return _logo_cache[network_id]
    try:
        item = table.get_item(Key={"pk": f"net_logo_{network_id}"}).get("Item")
        if item and int(item.get("ttl", 0)) > int(datetime.now().timestamp()):
            _logo_cache[network_id] = item.get("logo_url") or None
            return _logo_cache[network_id]
    except Exception:
        pass
    try:
        logos = tmdb(f"/network/{network_id}/images").get("logos", [])
        url = f"{LOGO_BASE}{logos[0]['file_path']}" if logos and logos[0].get("file_path") else None
        _logo_cache[network_id] = url
        try:
            ttl = int((datetime.now() + timedelta(days=7)).timestamp())
            table.put_item(Item={"pk": f"net_logo_{network_id}", "logo_url": url or "", "ttl": ttl})
        except Exception:
            pass
        return url
    except Exception as e:
        logger.warning(f"Logo fetch failed ({network_id}): {e}")
        _logo_cache[network_id] = None
        return None


# =========================================================================
# PROVIDER / STREAMING URLS
# =========================================================================

def build_provider_direct_link(tmdb_id, provider_id, provider_name, show_name, homepage=None):
    if not provider_name or not show_name: return None
    pl = provider_name.lower()
    slug = re.sub(r'[^a-z0-9-]', '', show_name.lower().replace(' ','-').replace("'",''))
    channel_keywords = ['amazon channel','apple tv channel','roku','fubo','spectrum','philo','channel']
    if any(kw in pl for kw in channel_keywords): return None
    if 'paramount' in pl: return f"https://www.paramountplus.com/shows/{slug}/"
    if 'netflix'   in pl: return homepage if homepage and 'netflix' in homepage else None
    if 'hulu'      in pl: return f"https://www.hulu.com/series/{slug}"
    if 'disney'    in pl: return f"https://www.disneyplus.com/series/{slug}"
    if 'max'       in pl or ('hbo' in pl and 'channel' not in pl): return f"https://www.max.com/shows/{slug}"
    if 'peacock'   in pl: return f"https://www.peacocktv.com/stream-tv/{slug}"
    if pl in ('apple tv+','apple tv'): return homepage if homepage and 'apple' in homepage else f"https://tv.apple.com/us/show/{slug}"
    if 'starz'     in pl and 'channel' not in pl: return f"https://www.starz.com/us/en/series/{slug}"
    if 'showtime'  in pl and 'channel' not in pl: return f"https://www.sho.com/{slug}"
    if pl in ('prime video','amazon prime'): return homepage if homepage and 'amazon' in homepage else None
    return None


def get_network_streaming_url(tmdb_id: int, network_name: str) -> Optional[str]:
    if not network_name or not tmdb_id: return None
    nl = network_name.lower()
    try:
        details  = tmdb(f"/tv/{tmdb_id}")
        if not details: return None
        slug     = re.sub(r'[^a-z0-9-]', '', details.get("name","").lower().replace(" ","-").replace("'",""))
        homepage = details.get("homepage", "")
        def _hp(domain): return homepage if homepage and domain in homepage else None
        if "apple"    in nl: return _hp("apple.com")  or f"https://tv.apple.com/us/show/{slug}"
        if "bet"      in nl: return _hp("bet.com")    or f"https://www.bet.com/shows/{slug}"
        if "netflix"  in nl:
            if homepage and "netflix.com" in homepage: return homepage
            link = tmdb(f"/tv/{tmdb_id}/watch/providers").get("results",{}).get("US",{}).get("link")
            return link or "https://www.netflix.com"
        if "hulu"      in nl: return _hp("hulu.com")   or f"https://www.hulu.com/series/{slug}"
        if "paramount" in nl: return _hp("paramount")  or f"https://www.paramountplus.com/shows/{slug}"
        if "max"       in nl or "hbo" in nl: return _hp("max.com") or _hp("hbo.com") or f"https://www.max.com/shows/{slug}"
        if "disney"    in nl: return _hp("disneyplus.com") or f"https://www.disneyplus.com/series/{slug}"
        if "peacock"   in nl: return _hp("peacock") or f"https://www.peacocktv.com/stream-tv/{slug}"
        if "prime"     in nl or "amazon" in nl: return _hp("amazon.com") or _hp("primevideo.com") or "https://www.amazon.com/gp/video/storefront"
        if "starz"     in nl: return _hp("starz.com")  or f"https://www.starz.com/us/en/series/{slug}"
        if "showtime"  in nl: return _hp("showtime.com") or f"https://www.sho.com/{slug}"
        if nl.strip() == "amc": return _hp("amc")  or f"https://www.amc.com/shows/{slug}"
        if nl.strip() == "fx":  return _hp("fxnetworks.com") or f"https://www.fxnetworks.com/shows/{slug}"
        if nl.strip() == "nbc": return _hp("nbc.com") or f"https://www.nbc.com/{slug}"
        if nl.strip() == "cbs": return _hp("cbs.com") or f"https://www.cbs.com/shows/{slug}"
        if nl.strip() == "abc": return _hp("abc.com") or f"https://abc.com/shows/{slug}"
        if nl.strip() == "fox": return _hp("fox.com") or f"https://www.fox.com/{slug}"
        if "cw" in nl: return _hp("cwtv.com") or f"https://www.cwtv.com/shows/{slug}"
        if homepage: return homepage
        return tmdb(f"/tv/{tmdb_id}/watch/providers").get("results",{}).get("US",{}).get("link")
    except Exception as e:
        logger.error(f"Streaming URL error ({network_name}): {e}")
        return None


def get_watch_providers(tmdb_id, show_name=None, homepage=None):
    try:
        data = tmdb(f"/tv/{tmdb_id}/watch/providers")
        us   = data.get("results", {}).get("US", {})
        jw   = us.get("link") or f"https://www.justwatch.com/us/tv-series/{tmdb_id}"
        providers_list = []
        for p in us.get("flatrate", []):
            pname = p.get("provider_name", "")
            plink = build_provider_direct_link(tmdb_id, p.get("provider_id"), pname, show_name, homepage)
            providers_list.append({
                "provider_id":   p.get("provider_id"),
                "provider_name": pname,
                "logo_path":     p.get("logo_path"),
                "provider_link": plink or jw,
            })
        return {"providers": providers_list, "link": jw}
    except Exception as e:
        logger.warning(f"get_watch_providers error: {e}")
        return {"providers": [], "link": f"https://www.justwatch.com/us/tv-series/{tmdb_id}"}


# =========================================================================
# TRAILER / FAN TRACKING
# =========================================================================

def get_trailer_url(tmdb_id) -> Optional[str]:
    try:
        for v in tmdb(f"/tv/{tmdb_id}/videos").get("results", []):
            if v.get("type") in ("Trailer","Teaser") and v.get("site") == "YouTube":
                return f"https://www.youtube.com/watch?v={v['key']}"
    except Exception:
        pass
    return None


def get_youtube_id(tmdb_id) -> Optional[str]:
    try:
        videos = tmdb(f"/tv/{tmdb_id}/videos").get("results", [])
        for ptype in ("Trailer", "Teaser"):
            for v in videos:
                if v.get("type") == ptype and v.get("site") == "YouTube":
                    return v["key"]
        for v in videos:
            if v.get("site") == "YouTube": return v["key"]
    except Exception as e:
        logger.warning(f"get_youtube_id({tmdb_id}): {e}")
    return None


def extract_user_id_from_event(event: dict) -> Optional[str]:
    """Extract Cognito sub (user ID) from Authorization header JWT."""
    try:
        auth_header = (
            event.get("headers", {}).get("Authorization") or
            event.get("headers", {}).get("authorization") or ""
        )
        if not auth_header.startswith("Bearer "):
            return None
        token   = auth_header.split(" ")[1]
        # JWT payload is the middle segment, base64-encoded
        payload = token.split(".")[1]
        # Add padding if needed
        payload += "=" * (4 - len(payload) % 4)
        import base64
        decoded = json.loads(base64.b64decode(payload).decode("utf-8"))
        return decoded.get("sub")  # Cognito user UUID
    except Exception as e:
        logger.warning(f"Could not extract user ID from token: {e}")
        return None


def increment_fan_tracking(tmdb_id, user_id: Optional[str] = None) -> int:
    try:
        # ── User deduplication ─────────────────────────────────────────────
        # If we have a user ID, check if they've already tracked this show.
        # Anonymous users (no token) still increment — best effort.
        if user_id:
            track_key = f"track_{user_id}_{tmdb_id}"
            try:
                existing = table.get_item(Key={"pk": track_key}).get("Item")
                if existing:
                    # Already tracked — return current count without incrementing
                    logger.info(f"User {user_id[:8]}... already tracking {tmdb_id}")
                    return get_fan_tracking_count(tmdb_id)
                # Write deduplication record with 1-year TTL
                ttl = int((datetime.now() + timedelta(days=365)).timestamp())
                table.put_item(Item={
                    "pk":      track_key,
                    "tmdb_id": str(tmdb_id),
                    "user_id": user_id,
                    "ttl":     ttl,
                    "tracked_at": datetime.now().isoformat(),
                })
            except Exception as e:
                logger.warning(f"Dedup check failed (non-fatal): {e}")
                # Fall through and increment anyway if dedup check fails

        # ── Increment hype score ───────────────────────────────────────────
        resp = table.update_item(
            Key={"pk": str(tmdb_id)},
            UpdateExpression="ADD hype_score :inc",
            ExpressionAttributeValues={":inc": 1},
            ReturnValues="UPDATED_NEW",
        )
        new_score = safe_int(resp.get("Attributes", {}).get("hype_score", 0))
        logger.info(f"Hype score updated: tmdb_id={tmdb_id} score={new_score} user={user_id[:8] + '...' if user_id else 'anon'}")
        return new_score

    except Exception as e:
        logger.error(f"increment_fan_tracking error: {e}")
        return 0

def get_fan_tracking_count(tmdb_id) -> int:
    try:
        return safe_int(table.get_item(Key={"pk":str(tmdb_id)}).get("Item",{}).get("hype_score",0))
    except Exception:
        return 0

def calculate_trend_percentage(tmdb_id) -> int:
    h = get_fan_tracking_count(tmdb_id)
    if h > 500: return 18
    if h > 300: return 12
    if h > 100: return 8
    return 5


# =========================================================================
# RATINGS
# =========================================================================

def get_omdb_ratings(title: str, year: Optional[int] = None) -> Dict:
    if not OMDB_API_KEY: return {}
    cache_key = f"omdb_{title.lower().replace(' ','_')}_{year or 'any'}"
    try:
        cached = table.get_item(Key={"pk": cache_key}).get("Item")
        if cached and int(cached.get("ttl", 0)) > int(datetime.now().timestamp()):
            return {
                "rt_score":    safe_int(cached.get("rt_score")) if cached.get("rt_score") not in (None,"","N/A") else None,
                "imdb_rating": float(cached.get("imdb_rating")) if cached.get("imdb_rating") not in (None,"","N/A") else None,
                "imdb_votes":  cached.get("imdb_votes") if cached.get("imdb_votes") not in (None,"","N/A") else None,
            }
    except Exception:
        pass
    try:
        params = {"apikey": OMDB_API_KEY, "t": title, "type": "series"}
        if year: params["y"] = str(year)
        r = http.request("GET", f"http://www.omdbapi.com/?{urlencode(params)}", timeout=3.0)
        if r.status != 200: return {}
        data = json.loads(r.data.decode())
        if data.get("Response") == "False": return {}
        ratings   = data.get("Ratings", [])
        rt_raw    = next((x["Value"] for x in ratings if x["Source"] == "Rotten Tomatoes"), None)
        rt_score  = int(rt_raw.rstrip("%")) if rt_raw else None
        imdb_rating = None
        imdb_votes  = None
        if data.get("imdbRating") and data["imdbRating"] != "N/A":
            try: imdb_rating = float(data["imdbRating"])
            except: pass
        if data.get("imdbVotes") and data["imdbVotes"] != "N/A":
            imdb_votes = data["imdbVotes"]
        try:
            ttl = int((datetime.now() + timedelta(days=7)).timestamp())
            table.put_item(Item={"pk": cache_key,
                "rt_score": rt_score if rt_score is not None else "N/A",
                "imdb_rating": imdb_rating if imdb_rating is not None else "N/A",
                "imdb_votes": imdb_votes if imdb_votes else "N/A",
                "ttl": ttl})
        except Exception:
            pass
        return {"rt_score": rt_score, "imdb_rating": imdb_rating, "imdb_votes": imdb_votes}
    except Exception as e:
        logger.warning(f"OMDb error '{title}': {e}")
        return {}


# =========================================================================
# TAVILY
# =========================================================================

def search_tavily(query: str, max_results: int = 5, domains: Optional[List[str]] = None) -> List[Dict]:
    if not TAVILY_API_KEY: return []
    try:
        payload = {
            "api_key": TAVILY_API_KEY, "query": query, "search_depth": "basic",
            "include_domains": domains or ["variety.com","deadline.com","hollywoodreporter.com",
                                           "tvline.com","ew.com","thewrap.com","indiewire.com"],
            "max_results": max_results,
        }
        r = http.request("POST", "https://api.tavily.com/search",
                         body=json.dumps(payload), headers={"Content-Type":"application/json"}, timeout=4.0)
        return json.loads(r.data.decode()).get("results", []) if r.status == 200 else []
    except Exception:
        return []


def extract_show_names_from_articles(articles: List[Dict]) -> List[str]:
    names: set = set()
    for art in articles:
        text = f"{art.get('title','')} {art.get('content','')}"
        names.update(re.findall(r'"([A-Z][^"]{2,40})"', text))
        names.update(re.findall(r"'([A-Z][^']{2,40})'", text))
        names.update(m.strip() for m in re.findall(r'([A-Z][a-zA-Z\s]{2,40})\s+Season\s+\d+', text))
    stop = {'The','A','An','Season','Episode','Series','Show','TV','Network',
            'Streaming','New','Final','First','Last','Next'}
    return [n.strip() for n in names
            if n.strip() not in stop and len(n.strip()) > 3 and not n.strip().isdigit()][:15]


# =========================================================================
# RESOLVE: SERIES BY ID
# =========================================================================

def resolve_series_by_id(tmdb_id, include_all_seasons=True,
                         year_filter=None, month_filter=None) -> List[Dict]:
    try:
        d = tmdb(f"/tv/{tmdb_id}", {"append_to_response": "credits"})
        if not d or "name" not in d: return []
        name      = d["name"]
        genre_ids = [g["id"] for g in d.get("genres", [])]
        if is_excluded_genre(genre_ids) or is_excluded_by_title(name): return []

        nets     = d.get("networks", [])
        net_name = nets[0].get("name","Streaming") if nets else "Streaming"
        net_logo = None
        if nets:
            raw_logo = nets[0].get("logo_path")
            net_logo = f"{LOGO_BASE}{raw_logo}" if raw_logo else fetch_network_logo(nets[0].get("id"))

        network_url   = get_network_streaming_url(tmdb_id, net_name)
        _cached = table.get_item(Key={"pk": str(tmdb_id)}).get("Item", {})
        trailer = _cached.get("trailer_url") or get_trailer_url(tmdb_id)
        homepage      = d.get("homepage")
        watch         = get_watch_providers(tmdb_id, show_name=name, homepage=homepage)
        fan_ct        = get_fan_tracking_count(tmdb_id)
        trend         = calculate_trend_percentage(tmdb_id)
        genre_str     = ", ".join(g["name"] for g in d.get("genres",[])).upper() or "DRAMA"
        cast_str      = ", ".join(c["name"] for c in d.get("credits",{}).get("cast",[])[:4])
        creator_str   = ", ".join(c["name"] for c in d.get("created_by",[])[:2])
        premiere_year = int(d["first_air_date"][:4]) if d.get("first_air_date") and d["first_air_date"][:4].isdigit() else None
        omdb_data     = get_omdb_ratings(name, premiere_year)

        def _build(season_num, air_date, poster_path, overview):
            if month_filter and air_date and air_date != "TBA":
                try:
                    if int(air_date.split("-")[1]) != month_filter: return None
                except (ValueError, IndexError):
                    pass

            status   = d.get("status", "Unknown")
            trending = f"+{trend}%" if trend > 0 else None
            pp = poster_path or d.get("poster_path")

            return {
                "id":           tmdb_id,
                "title":        f"{name} Season {season_num}",
                "seriesTitle":  name,
                "premiereDate": _offset_tmdb_date(air_date) if air_date else "TBA",
                "poster":       f"{IMG_BASE}{pp}" if pp else None,
                "network":      net_name,
                "network_logo": net_logo,
                "network_url":  network_url,
                "description":  overview or d.get("overview",""),
                "genre":        genre_str,
                "cast":         cast_str,
                "creator":      creator_str,
                "year":         premiere_year,
                "status":       status,
                "trending":     trending,
                "user_score":   safe_int((d.get("vote_average") or 0) * 10),
                "hype_count":   safe_int(d.get("popularity",0)) + 120,
                "trailer_url":  trailer,
                "watch_providers": watch["providers"],
                "watch_link":   watch["link"],
                "fans_tracking": fan_ct,
                "trend_percentage": trend,
                "rt_score":     omdb_data.get("rt_score"),
                "imdb_rating":  omdb_data.get("imdb_rating"),
                "imdb_votes":   omdb_data.get("imdb_votes"),
            }

        seasons = d.get("seasons", [])
        if not seasons:
            result = _build(1, d.get("first_air_date"), None, None)
            return [result] if result else []

        out = []
        for s in seasons:
            sn = s.get("season_number", 0)
            if sn == 0: continue

            built = _build(sn, s.get("air_date"), s.get("poster_path"), s.get("overview"))
            if built: out.append(built)

        if not out: return []

        # ✅ FIXED SORT (from your notes)
        out.sort(key=lambda x: x.get("premiereDate") or "9999", reverse=True)

        if include_all_seasons:
            return out

        # ── Single-season selection ──
        today = datetime.now().strftime("%Y-%m-%d")

        aired = [s for s in out if s.get("premiereDate") and
                 s["premiereDate"] not in ("TBA","TBD","") and
                 s["premiereDate"] <= today]

        upcoming = [s for s in out if s.get("premiereDate") and
                    s["premiereDate"] not in ("TBA","TBD","") and
                    s["premiereDate"] > today]

        tba = [s for s in out if not s.get("premiereDate") or
               s["premiereDate"] in ("TBA","TBD","")]

        if aired:
            return [sorted(aired, key=lambda x: x["premiereDate"], reverse=True)[0]]
        if upcoming:
            return [sorted(upcoming, key=lambda x: x["premiereDate"])[0]]
        return [tba[0]] if tba else [out[0]]

    # ✅ FIXED INDENTATION (aligned with try)
    except Exception as e:
        logger.error(f"resolve_series_by_id({tmdb_id}): {e}", exc_info=True)
        return []

# =========================================================================
# PERSON LOOKUP
# =========================================================================

def _find_best_person_match(name: str, preferred_dept: str = "acting") -> Optional[Dict]:
    results = tmdb("/search/person", {"query": name}).get("results", [])
    if not results: return None
    ranked = sorted(results, key=lambda p: p.get("popularity",0) + (
        10 if p.get("known_for_department","").lower() == preferred_dept.lower() else 0
    ), reverse=True)
    best = ranked[0]
    logger.info(f"Person: '{name}' → '{best.get('name')}' (dept={best.get('known_for_department')}, id={best.get('id')})")
    return best


def _collect_producer_candidates(name: str, top_n: int = 3):
    results = tmdb("/search/person", {"query": name}).get("results", [])
    if not results: return set(), name, {}, {}, []
    ranked = sorted(results, key=lambda p: p.get("popularity",0), reverse=True)[:top_n]
    pids: set = set()
    all_shows: Dict[int,str] = {}
    crew_by_show: Dict[int,List[Dict]] = {}
    crew_credits: List[Dict] = []
    person_name = ranked[0].get("name", name)
    for person in ranked:
        pid = person.get("id")
        if not pid: continue
        pids.add(pid)
        creds = tmdb(f"/person/{pid}/tv_credits")
        for c in creds.get("crew",[]) + creds.get("cast",[]):
            sid = c.get("id")
            if sid and sid not in all_shows: all_shows[sid] = c.get("name","Unknown")
        for c in creds.get("crew",[]):
            sid = c.get("id")
            if sid:
                crew_by_show.setdefault(sid,[]).append(c)
                crew_credits.append(c)
    return pids, person_name, all_shows, crew_by_show, crew_credits


# =========================================================================
# RESOLVE: PRODUCER
# =========================================================================

_ACTIVE_STATUSES = {"returning series","in production","planned","pilot","in development"}

def _is_active_show(details: Dict) -> bool:
    return details.get("status","").lower().strip() in _ACTIVE_STATUSES


def resolve_person_producer(name, network_filter=None, year_filter=None, month_filter=None) -> List[Dict]:
    try:
        pids, person_name, all_shows, crew_by_show, _ = _collect_producer_candidates(name)
        if not pids:
            logger.warning(f"No TMDB person found for '{name}'")
            return []

        def _qualifies(sid, details):
            created_by = details.get("created_by",[])
            cb_ids  = {c.get("id") for c in created_by}
            cb_names = {c.get("name","").lower() for c in created_by}
            if pids & cb_ids: return True
            if person_name.lower() in cb_names: return True
            if any(is_significant_producer_credit(c.get("job","")) for c in crew_by_show.get(sid,[])): return True
            show_crew = tmdb(f"/tv/{sid}/credits").get("crew",[])
            return any(c.get("id") in pids and is_significant_producer_credit(c.get("job","")) for c in show_crew)

        def _resolve_show(sid, details, y_filter, m_filter):
            if network_filter and network_filter not in ("All","All Networks",""):
                nets = details.get("networks",[])
                show_network = nets[0].get("name","") if nets else ""
                if not network_matches(show_network, network_filter): return []
            data = resolve_series_by_id(sid, include_all_seasons=True, year_filter=y_filter, month_filter=m_filter)
            if network_filter and network_filter not in ("All","All Networks","") and data:
                data = [s for s in data if network_matches(s.get("network",""), network_filter)]
            return data

        all_hits: List[Dict] = []
        show_cache: Dict[int,Dict] = {}
        for sid, show_name in all_shows.items():
            details = tmdb(f"/tv/{sid}")
            if not details: continue
            show_cache[sid] = details
            if not _qualifies(sid, details): continue
            all_hits.extend(_resolve_show(sid, details, year_filter, month_filter))

        if not all_hits and year_filter:
            for sid, details in show_cache.items():
                if not _qualifies(sid, details): continue
                if not _is_active_show(details): continue
                all_hits.extend(_resolve_show(sid, details, None, None))

        return all_hits
    except Exception as e:
        logger.error(f"resolve_person_producer: {e}", exc_info=True)
        return []


# =========================================================================
# RESOLVE: ACTOR
# =========================================================================

def resolve_person_actor(name, network_filter=None, year_filter=None, month_filter=None) -> List[Dict]:
    try:
        person = _find_best_person_match(name, preferred_dept="acting")
        if not person: return []
        pid  = person["id"]
        cast = tmdb(f"/person/{pid}/tv_credits").get("cast",[])
        if year_filter:
            cast = [c for c in cast if not c.get("first_air_date") or
                    (c["first_air_date"][:4].isdigit() and int(c["first_air_date"][:4]) >= year_filter)]
        all_hits, seen = [], set()
        for c in cast:
            if not is_significant_actor_credit(c.get("character","")): continue
            sid = c.get("id")
            if sid in seen: continue
            seen.add(sid)
            data = resolve_series_by_id(sid, include_all_seasons=True, year_filter=year_filter, month_filter=month_filter)
            if network_filter and network_filter not in ("All","All Networks",""):
                data = [s for s in data if network_matches(s.get("network",""), network_filter)]
            all_hits.extend(data)
            if len(all_hits) >= 100: break
        return all_hits[:100]
    except Exception as e:
        logger.error(f"resolve_person_actor: {e}", exc_info=True)
        return []


# =========================================================================
# DISCOVER: SINGLE SHOW VALIDATION
# =========================================================================

def _resolve_and_validate(sid, year_filter, month_filter, network_filter_name, seen_ids,
                          week_start=None, week_end=None):
    if sid in seen_ids: return []
    seen_ids.add(sid)
    data = resolve_series_by_id(sid, include_all_seasons=False, year_filter=year_filter, month_filter=month_filter)
    if not data: return []

    if week_start and week_end:
        data = [s for s in data if s.get("premiereDate","") not in ("TBA","TBD") and
                week_start <= s.get("premiereDate","") <= week_end]

    if year_filter and month_filter and data:
        validated = []
        for show in data:
            pd = show.get("premiereDate","")
            if pd and pd not in ("TBA","TBD"):
                try:
                    parts = pd.split("-")
                    if int(parts[0]) == year_filter and int(parts[1]) == month_filter:
                        validated.append(show)
                except (ValueError, IndexError):
                    pass
        data = validated

    if network_filter_name and data:
        data = [s for s in data if network_matches(s.get("network",""), network_filter_name)]

    return data


# =========================================================================
# DISCOVER: MULTI-PASS
# =========================================================================

_NETWORK_SWEEP_IDS: List[tuple] = [
    ("Apple TV+",2552),("Hulu",453),("Peacock",3353),("AMC",174),
    ("STARZ",4406),("Syfy",77),("FX",88),("Disney+",2739),
    ("Paramount+",4330),("HBO",49),("Netflix",213),("Prime Video",1024),
    ("CBS",16),("NBC",6),("ABC",2),("FOX",19),("The CW",71),
    ("Showtime",67),("BET+",3436),("OWN",528),("Max",3186),
    ("Epix",4),("Adult Swim",80),("MGM+",34),("Crunchyroll",283),
    ("YouTube Premium",1436),("A&E",129),("Discovery",64),
]


def _build_date_params(base: dict, year_filter, month_filter, week_start=None, week_end=None) -> dict:
    p = dict(base)
    if week_start and week_end:
        p["first_air_date.gte"] = week_start
        p["first_air_date.lte"] = week_end
        return p
    if not year_filter: return p
    if month_filter:
        last = calendar.monthrange(year_filter, month_filter)[1]
        p["first_air_date.gte"] = f"{year_filter}-{month_filter:02d}-01"
        p["first_air_date.lte"] = f"{year_filter}-{month_filter:02d}-{last}"
    elif year_filter >= datetime.now().year:
        p["first_air_date.gte"] = f"{year_filter}-01-01"
        p["first_air_date.lte"] = f"{year_filter}-12-31"
    else:
        p["first_air_date_year"] = str(year_filter)
    return p


def discover_shows(genre_id=None, keyword_id=None, network_id=None,
                   year_filter=None, month_filter=None, network_filter_name=None,
                   max_pages=3, week_start=None, week_end=None, provider_id=None) -> List[Dict]:
    import time as _time
    _start  = _time.monotonic()
    _budget = 22.0

    def _time_ok(label=""):
        if _time.monotonic() - _start > _budget:
            if label: logger.warning(f"Time budget hit at: {label}")
            return False
        return True

    base = {"sort_by": "popularity.desc", "with_original_language": "en"}
    if genre_id:   base["with_genres"]   = str(genre_id)
    if keyword_id: base["with_keywords"] = str(keyword_id)
    if provider_id:
        base["with_watch_providers"] = str(provider_id)
        base["watch_region"] = "US"
    elif network_id:
        base["with_networks"] = str(network_id)

    raw_ids: List[int] = []

    def _collect(params, max_pg, label):
        for pg in range(1, max_pg + 1):
            if not _time_ok(label): return
            params["page"] = str(pg)
            rows = tmdb("/discover/tv", params).get("results", [])
            if not rows: return
            raw_ids.extend(r["id"] for r in rows if r.get("id"))

    def _collect_parallel(params, max_pg, label):
        ids = []
        try:
            for pg in range(1, max_pg + 1):
                pc = dict(params); pc["page"] = str(pg)
                rows = tmdb("/discover/tv", pc).get("results", [])
                if not rows: break
                ids.extend(r["id"] for r in rows if r.get("id"))
            logger.info(f"{label}: {len(ids)} IDs")
            return ids
        except Exception as e:
            logger.warning(f"{label} failed: {e}")
            return []

    # ── STAGE 1: parallel passes ───────────────────────────────────────────
    pass_futures = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        p1 = _build_date_params(base, year_filter, month_filter, week_start, week_end)
        pages_1a = 5 if (provider_id or network_id or network_filter_name) and month_filter else \
                   10 if (provider_id or network_id or network_filter_name) else \
                   2 if month_filter else 5
        pass_futures.append(executor.submit(_collect_parallel, p1, pages_1a, "Pass1a"))

        if year_filter and month_filter:
            p1b = _build_date_params({**base,"sort_by":"first_air_date.asc"}, year_filter, month_filter, week_start, week_end)
            pass_futures.append(executor.submit(_collect_parallel, p1b, 1, "Pass1b"))

        if year_filter and not month_filter:
            p1c = _build_date_params({**base,"sort_by":"first_air_date.asc"}, year_filter, None, week_start, week_end)
            pass_futures.append(executor.submit(_collect_parallel, p1c, 2, "Pass1c"))

        if year_filter and month_filter:
            pass_futures.append(executor.submit(_collect_parallel, dict(base), 3, "Pass2"))
            on_air = {"with_original_language":"en","sort_by":"popularity.desc"}
            if genre_id: on_air["with_genres"] = str(genre_id)
            if provider_id: on_air["with_watch_providers"] = str(provider_id); on_air["watch_region"] = "US"
            elif network_id: on_air["with_networks"] = str(network_id)
            pass_futures.append(executor.submit(_collect_parallel, on_air, 1, "Pass3"))

        for future in as_completed(pass_futures):
            if not _time_ok("Stage1-Parallel"): break
            try: raw_ids.extend(future.result(timeout=5.0))
            except Exception as e: logger.warning(f"Parallel pass failed: {e}")

    logger.info(f"Passes 1-3 complete: {len(raw_ids)} IDs")

    # ── Pass 5: network sweep ──────────────────────────────────────────────
    if year_filter and _time_ok("Pass5"):
        before_p5 = len(raw_ids)
        sweep_pages = 2
        if provider_id or network_id or network_filter_name:
            sweep_list = [(network_filter_name or "Filtered", provider_id if provider_id else network_id, bool(provider_id))]
        else:
            sweep_list = [(name, nid, False) for name, nid in _NETWORK_SWEEP_IDS]
            sweep_pages = 1

        def _sweep_network(net_name, net_or_prov_id, is_provider):
            try:
                np = {"sort_by":"popularity.desc","with_original_language":"en"}
                if is_provider: np["with_watch_providers"] = str(net_or_prov_id); np["watch_region"] = "US"
                else: np["with_networks"] = str(net_or_prov_id)
                if genre_id:   np["with_genres"]   = str(genre_id)
                if keyword_id: np["with_keywords"]  = str(keyword_id)
                np = _build_date_params(np, year_filter, month_filter, week_start, week_end)
                ids = []
                for pg in range(1, sweep_pages + 1):
                    np["page"] = str(pg)
                    rows = tmdb("/discover/tv", np).get("results",[])
                    if not rows: break
                    ids.extend(r["id"] for r in rows if r.get("id"))
                logger.info(f"Pass5/{net_name}: {len(ids)} IDs")
                return ids
            except Exception as e:
                logger.warning(f"Pass5/{net_name} failed: {e}")
                return []

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(_sweep_network, t[0], t[1], t[2]): t[0] for t in sweep_list}
            for future in as_completed(futures):
                if not _time_ok("Pass5"): break
                try: raw_ids.extend(future.result(timeout=3.0))
                except Exception as e: logger.warning(f"Pass5 future failed: {e}")
        logger.info(f"Pass 5: +{len(raw_ids) - before_p5} IDs")

    # ── Pass 6: year-only sweep ────────────────────────────────────────────
    if year_filter and not month_filter and _time_ok("Pass6"):
        before_p6 = len(raw_ids)
        p6 = {"sort_by":"popularity.desc","with_original_language":"en"}
        if genre_id:   p6["with_genres"]   = str(genre_id)
        if keyword_id: p6["with_keywords"]  = str(keyword_id)
        if network_id: p6["with_networks"]  = str(network_id)
        p6 = _build_date_params(p6, year_filter, None, week_start, week_end)
        pages_p6 = 5 if (network_id or network_filter_name) else 3
        _collect(p6, pages_p6, "Pass6")
        logger.info(f"Pass 6: +{len(raw_ids) - before_p6} IDs")

    # ── PassReturning: catches Season 2+ via air_date filter ──────────────
    if year_filter and month_filter and _time_ok("PassReturning"):
        before_ret = len(raw_ids)
        last_day   = calendar.monthrange(year_filter, month_filter)[1]

        def _sweep_returning(net_name, net_or_prov_id, is_provider):
            try:
                rp = {
                    "sort_by": "popularity.desc",
                    "with_original_language": "en",
                    "air_date.gte": f"{year_filter}-{month_filter:02d}-01",
                    "air_date.lte": f"{year_filter}-{month_filter:02d}-{last_day:02d}",
                }
                if is_provider: rp["with_watch_providers"] = str(net_or_prov_id); rp["watch_region"] = "US"
                else: rp["with_networks"] = str(net_or_prov_id)
                if genre_id: rp["with_genres"] = str(genre_id)
                ids = []
                for pg in range(1, 3):
                    rp["page"] = str(pg)
                    rows = tmdb("/discover/tv", rp).get("results",[])
                    if not rows: break
                    ids.extend(r["id"] for r in rows if r.get("id"))
                return ids
            except Exception as e:
                logger.warning(f"PassReturning/{net_name}: {e}")
                return []

        if network_id:
            ret_sweep = [(network_filter_name or "Filtered", network_id, False)]
        else:
            ret_sweep = [(name, nid, False) for name, nid in _NETWORK_SWEEP_IDS]

        with ThreadPoolExecutor(max_workers=10) as ex:
            futs = {ex.submit(_sweep_returning, t[0], t[1], t[2]): t[0] for t in ret_sweep}
            for fut in as_completed(futs):
                if not _time_ok("PassReturning"): break
                try: raw_ids.extend(fut.result(timeout=3.0))
                except Exception as e: logger.warning(f"PassReturning future: {e}")
        logger.info(f"PassReturning: +{len(raw_ids) - before_ret} IDs")
    # ── END PassReturning ──────────────────────────────────────────────────

    logger.info(f"Stage 1 complete: {len(raw_ids)} raw IDs in {_time.monotonic()-_start:.1f}s")

    # ── STAGE 2: deduplicate + resolve ─────────────────────────────────────
    seen_set: set = set()
    unique_ids: List[int] = []
    for sid in raw_ids:
        if sid not in seen_set:
            seen_set.add(sid)
            unique_ids.append(sid)

    RESOLVE_CAP = 200
    logger.info(f"Stage 2: resolving up to {RESOLVE_CAP} of {len(unique_ids)} unique IDs")

    results: List[Dict] = []
    resolved_seen: set  = set()
    for sid in unique_ids[:RESOLVE_CAP]:
        if not _time_ok("Stage2"): break
        hits = _resolve_and_validate(sid, year_filter, month_filter, network_filter_name, resolved_seen,
                                     week_start=week_start, week_end=week_end)
        results.extend(hits)

    # ── Pass 4: Tavily enrichment ──────────────────────────────────────────
    if year_filter and month_filter and TAVILY_API_KEY and network_filter_name and _time_ok("Pass4"):
        mname = calendar.month_name[month_filter]
        arts  = search_tavily(f"{network_filter_name} new series premiering {mname} {year_filter}", max_results=5)
        added = 0
        for sn in extract_show_names_from_articles(arts):
            try:
                hits_raw = title_search_with_fallback(sn)
                if not hits_raw: continue
                hits = _resolve_and_validate(hits_raw[0]["id"], year_filter, month_filter,
                                             network_filter_name, resolved_seen)
                results.extend(hits); added += len(hits)
            except Exception:
                continue
        logger.info(f"Pass 4 (Tavily): +{added}")

    # ── Hard date gate ─────────────────────────────────────────────────────
    if year_filter and month_filter:
        target  = f"{year_filter}-{month_filter:02d}"
        before  = len(results)
        results = [r for r in results if r.get("premiereDate","")[:7] == target]
        if len(results) < before:
            logger.info(f"Hard gate: -{before - len(results)}")

    logger.info(f"discover_shows total: {len(results)} ({_time.monotonic()-_start:.1f}s)")
    return results


# =========================================================================
# SIDEBAR ASSETS
# =========================================================================

def get_hype_leaderboard() -> List[Dict]:
    try:
        items = table.scan(Limit=20).get("Items",[])
        lb = []
        for itm in items:
            tid = itm.get("pk")
            if not tid or str(tid).startswith("net_logo_"): continue
            sd = resolve_series_by_id(tid, include_all_seasons=False)
            if not sd: continue
            lb.append({"title":sd[0].get("seriesTitle","Unknown"),
                       "hype":safe_int(itm.get("hype_score",0)),
                       "poster":sd[0].get("poster"),"id":tid})
        return sorted(lb, key=lambda x: x["hype"], reverse=True)[:5]
    except Exception as e:
        logger.error(f"get_hype_leaderboard: {e}")
        return []


def get_upcoming_premieres() -> List[Dict]:
    try:
        now = datetime.now()
        raw = tmdb("/discover/tv", {
            "sort_by":"popularity.desc",
            "first_air_date.gte": now.strftime("%Y-%m-%d"),
            "first_air_date.lte": (now + timedelta(days=90)).strftime("%Y-%m-%d"),
            "with_original_language":"en","page":"1",
        }).get("results",[])
        out = []
        for s in raw[:20]:
            sd = resolve_series_by_id(s["id"], include_all_seasons=False)
            if not sd: continue
            out.append({"title":sd[0].get("seriesTitle",s.get("name","Unknown")),
                        "premiere":sd[0].get("premiereDate",s.get("first_air_date")),
                        "poster":sd[0].get("poster"),"id":s["id"]})
        out.sort(key=lambda x: x.get("premiere") or "9999-99-99")
        return out[:6]
    except Exception as e:
        logger.error(f"get_upcoming_premieres: {e}")
        return []


def get_spotlight_trailers() -> List[Dict]:
    try:
        now         = datetime.now()
        month_start = now.strftime("%Y-%m-01")
        month_end   = f"{now.year}-{now.month:02d}-{28 if now.month==2 else 30}"
        raw = tmdb("/discover/tv",{"sort_by":"popularity.desc","with_original_language":"en",
                                   "first_air_date.gte":month_start,"first_air_date.lte":month_end}).get("results",[])
        if len(raw) < 6:
            upcoming = tmdb("/discover/tv",{"sort_by":"popularity.desc",
                            "first_air_date.gte":now.strftime("%Y-%m-%d"),"with_original_language":"en"}).get("results",[])
            seen = {s["id"] for s in raw}
            for u in upcoming:
                if u["id"] not in seen: raw.append(u); seen.add(u["id"])
        spotlight = []
        for s in raw[:20]:
            yt_id = get_youtube_id(s["id"])
            if not yt_id: continue
            d = tmdb(f"/tv/{s['id']}")
            if not d: continue
            nets     = d.get("networks",[])
            net_name = nets[0].get("name","") if nets else ""
            net_logo = None
            if nets:
                rl = nets[0].get("logo_path")
                net_logo = f"{LOGO_BASE}{rl}" if rl else fetch_network_logo(nets[0].get("id"))
            spotlight.append({"title":d.get("name",s.get("name","Unknown")),"network":net_name,
                              "network_logo":net_logo,"youtube_id":yt_id,"tmdb_id":s["id"]})
            if len(spotlight) >= 6: break
        return spotlight
    except Exception as e:
        logger.error(f"get_spotlight_trailers: {e}", exc_info=True)
        return []


# =========================================================================
# QUERY PARSING
# =========================================================================

def extract_network_from_query(query: str) -> Optional[str]:
    if not query: return None
    ql = query.lower()
    all_aliases = sorted([(alias, canonical) for canonical, aliases in NETWORK_ALIASES.items() for alias in aliases],
                         key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in all_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', ql):
            return canonical
    return None


def extract_genre_from_query(query: str) -> Optional[Tuple]:
    ql = query.lower()
    for label, gid in sorted(GENRE_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if re.search(r'\b' + re.escape(label) + r'\b', ql):
            return (label, gid)
    for plural, pair in {"comedies":("comedy",35),"documentaries":("documentary",99),
                         "dramas":("drama",18),"thrillers":("thriller",53),
                         "mysteries":("mystery",9648),"westerns":("western",37)}.items():
        if plural in ql: return pair
    return None


def extract_keyword_from_query(query: str) -> Optional[Tuple]:
    ql = query.lower()
    for label, kid in sorted(KEYWORD_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        if label in ql: return (label, kid)
    return None


def extract_month_from_query(query: str) -> Optional[int]:
    if not query: return None
    ql = query.lower()
    months = {"january":1,"jan":1,"february":2,"feb":2,"march":3,"mar":3,
              "april":4,"apr":4,"may":5,"june":6,"jun":6,"july":7,"jul":7,
              "august":8,"aug":8,"september":9,"sep":9,"sept":9,
              "october":10,"oct":10,"november":11,"nov":11,"december":12,"dec":12}
    for mname, mnum in months.items():
        if re.search(r'\b' + re.escape(mname) + r'\b', ql): return mnum
    m = re.search(r'\b(0?[1-9]|1[0-2])[/-]20[2-3]\d\b', query)
    return int(m.group(1)) if m else None


def extract_temporal_context(query: str) -> Dict:
    if not query: return {}
    ql  = query.lower()
    now = datetime.now()
    if re.search(r'\bthis\s+week\b', ql):
        start = now - timedelta(days=now.weekday())
        end   = start + timedelta(days=6)
        return {"week_start":start.strftime("%Y-%m-%d"),"week_end":end.strftime("%Y-%m-%d")}
    if re.search(r'\bnext\s+week\b', ql):
        start = now - timedelta(days=now.weekday()) + timedelta(days=7)
        end   = start + timedelta(days=6)
        return {"week_start":start.strftime("%Y-%m-%d"),"week_end":end.strftime("%Y-%m-%d")}
    if re.search(r'\bthis\s+month\b', ql): return {"year":now.year,"month":now.month}
    if re.search(r'\bnext\s+month\b', ql):
        return {"year":now.year+1,"month":1} if now.month==12 else {"year":now.year,"month":now.month+1}
    if re.search(r'\bthis\s+year\b',  ql): return {"year":now.year}
    if re.search(r'\bnext\s+year\b',  ql): return {"year":now.year+1}
    return {}


def extract_rt_threshold(query: str) -> Optional[int]:
    if not query: return None
    ql = query.lower()
    for pattern in [r'(?:above|over|greater\s+than|>\s*)\s*(\d{1,3})%?',
                    r'(?:at\s+least|minimum\s+of)\s+(\d{1,3})%?',
                    r'rt\s+score\s*[>≥]\s*(\d{1,3})',
                    r'rotten\s+tomatoes\s*[>≥]\s*(\d{1,3})',]:
        m = re.search(pattern, ql)
        if m:
            t = int(m.group(1))
            return t if 0 <= t <= 100 else None
    return None


def extract_person_name(query: str) -> Optional[str]:
    if not query: return None
    name_tok  = r"[A-Z][a-z]+(?:-[A-Z][a-z]+)*"
    roman_tok = r"(?:II{0,2}|IV|V?I{1,3}|VI{0,3}|IX)"
    pattern   = rf"({name_tok}(?:\s+(?:{name_tok}|{roman_tok}))+)"
    for m in re.findall(pattern, query):
        clean = [w for w in m.split() if w not in PERSON_NOISE_WORDS]
        if len(clean) >= 2: return " ".join(clean)
    return None


def detect_producer_intent(query: str) -> bool:
    ql = query.lower()
    phrases = ("produced by","producer","executive producer","created by","creator",
               "showrunner","produced shows","produced series")
    if any(kw in ql for kw in phrases): return True
    return bool(re.search(r'\bproduced\b', ql))

def detect_actor_intent(query: str) -> bool:
    return any(kw in query.lower() for kw in ("starring","stars in","acted in","actor"))

def detect_tbd_intent(query: str) -> bool:
    return any(sig in (query or "").lower() for sig in
               ("tbd","tba","no date","no premiere date","coming soon",
                "unscheduled","unannounced","to be determined","to be announced"))


# =========================================================================
# BEDROCK QUERY PARSING
# =========================================================================

def parse_query_with_bedrock(query: str) -> Optional[Dict]:
    if not BEDROCK_AVAILABLE or not query: return None
    try:
        prompt = f"""Parse this TV show search query and extract structured information.
Return ONLY valid JSON (no markdown, no explanation).

Query: "{query}"

Extract these fields (use null if not mentioned):
{{
  "person_name": "Full name if searching for shows by a person",
  "person_role": "producer|actor|creator|null",
  "networks": ["List of streaming services/networks mentioned"],
  "genres": ["List of genres"],
  "keywords": ["thematic keywords"],
  "year": <integer year or null>,
  "month": <1-12 or null>,
  "temporal": "this week|this month|next week|next month|null",
  "rt_threshold": <minimum RT score 0-100 or null>,
  "imdb_threshold": <minimum IMDb score 0-10 or null>,
  "tbd_only": <true if asking for undated shows>,
  "sort_preference": "newest|latest|oldest|earliest|null",
  "negations": []
}}

Current date: {datetime.now().strftime("%Y-%m-%d")}"""
        response = bedrock.invoke_model(
            modelId="us.anthropic.claude-sonnet-4-20250514-v1:0",
            body=json.dumps({"anthropic_version":"bedrock-2023-05-31","max_tokens":1000,
                             "temperature":0,"messages":[{"role":"user","content":prompt}]})
        )
        result  = json.loads(response['body'].read())
        content = result['content'][0]['text'].strip()
        content = re.sub(r'^```json\s*|\s*```$','',content,flags=re.MULTILINE).strip()
        parsed  = json.loads(content)
        logger.info(f"Bedrock parse: {parsed}")
        return parsed
    except Exception as e:
        logger.warning(f"Bedrock query parse failed: {e}")
        return None


def parse_query(query: str, network_filter_ui: Optional[str] = None) -> Dict:
    bedrock_result = parse_query_with_bedrock(query)
    if bedrock_result:
        temporal_map = {
            "this week": extract_temporal_context("this week"),
            "this month":extract_temporal_context("this month"),
            "next week": extract_temporal_context("next week"),
            "next month":extract_temporal_context("next month"),
        }
        temporal_data = temporal_map.get(bedrock_result.get("temporal"), {})
        genre_tuple   = None
        if bedrock_result.get("genres"):
            for g in bedrock_result["genres"]:
                genre_tuple = extract_genre_from_query(g)
                if genre_tuple: break
        network_name = None
        if bedrock_result.get("networks"):
            for net in bedrock_result["networks"]:
                network_name = extract_network_from_query(net)
                if network_name: break
        keyword_tuple = None
        if bedrock_result.get("keywords"):
            for kw in bedrock_result["keywords"]:
                keyword_tuple = extract_keyword_from_query(kw)
                if keyword_tuple: break
        return {
            "person_name":    bedrock_result.get("person_name"),
            "network":        network_name,
            "year":           bedrock_result.get("year") or temporal_data.get("year"),
            "month":          bedrock_result.get("month") or temporal_data.get("month"),
            "week_start":     temporal_data.get("week_start"),
            "week_end":       temporal_data.get("week_end"),
            "genre":          genre_tuple,
            "keyword":        keyword_tuple,
            "rt_threshold":   bedrock_result.get("rt_threshold"),
            "imdb_threshold": bedrock_result.get("imdb_threshold"),
            "is_trending":    any(k in query.lower() for k in ("trending","popular","hot","renewed","cancelled")),
            "producer_intent":bedrock_result.get("person_role") == "producer",
            "actor_intent":   bedrock_result.get("person_role") == "actor",
            "tbd_only":       bedrock_result.get("tbd_only", False),
            "sort_order":     "desc" if bedrock_result.get("sort_preference") in ("newest","latest") else "asc",
        }

    ql   = query.lower()
    year = None
    m    = re.search(r'\b(20[2-3]\d)\b', query)
    if m: year = int(m.group(1))
    elif "premiering" in ql:
        now  = datetime.now().year
        year = now if now >= 2026 else 2026
    temporal = extract_temporal_context(query)
    if temporal.get("year"): year = temporal["year"]
    month = temporal.get("month") or extract_month_from_query(query)
    return {
        "person_name":    extract_person_name(query),
        "network":        extract_network_from_query(query),
        "year":           year,
        "month":          month,
        "week_start":     temporal.get("week_start"),
        "week_end":       temporal.get("week_end"),
        "genre":          extract_genre_from_query(query),
        "keyword":        extract_keyword_from_query(query),
        "rt_threshold":   extract_rt_threshold(query),
        "imdb_threshold": None,
        "is_trending":    any(k in ql for k in ("trending","popular","hot","renewed","cancelled")),
        "producer_intent":detect_producer_intent(query),
        "actor_intent":   detect_actor_intent(query),
        "tbd_only":       detect_tbd_intent(query),
        "sort_order":     detect_sort_order(query),
    }


# =========================================================================
# ROUTER
# =========================================================================

def route_query(parsed: Dict) -> Tuple[str, float]:
    scores: Dict[str, float] = {}
    has_person  = bool(parsed.get("person_name"))
    has_genre   = bool(parsed.get("genre"))
    has_network = bool(parsed.get("network"))
    has_year    = bool(parsed.get("year"))
    has_keyword = bool(parsed.get("keyword"))
    if has_person:
        if parsed.get("producer_intent"):   scores["producer"] = 0.90
        elif parsed.get("actor_intent"):    scores["actor"]    = 0.90
        else:
            role = detect_person_role(parsed["person_name"])
            scores["producer" if role=="producer" else "actor"] = 0.80
    if (has_genre or has_network or has_year) and not has_person: scores["discover"] = 0.85
    if has_keyword and not has_person: scores["keyword"] = 0.75
    if parsed.get("is_trending"):           scores["trend"]    = 0.70
    scores["fallback"] = 0.30
    route = max(scores, key=scores.get)
    logger.info(f"ROUTE={route} ({scores[route]:.2f})")
    return route, scores[route]


def validate_query_feasibility(query_network, ui_network) -> bool:
    if not ui_network or ui_network in ("All","All Networks",""): return True
    if not query_network: return True
    if not network_matches(query_network, ui_network):
        logger.warning(f"Impossible query: '{query_network}' vs UI '{ui_network}'")
        return False
    return True


# =========================================================================
# V2.0 GET HELPERS  (use existing tmdb() — no requests library needed)
# =========================================================================

def get_show_details(show_id):
    d = tmdb(f"/tv/{show_id}", {"append_to_response": "content_ratings,external_ids"})
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}

def get_show_providers(show_id):
    d = tmdb(f"/tv/{show_id}/watch/providers")
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}

def get_show_credits(show_id):
    d = tmdb(f"/tv/{show_id}/credits")
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}

def get_show_videos(show_id):
    d = tmdb(f"/tv/{show_id}/videos")
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}

def get_show_images(show_id):
    d = tmdb(f"/tv/{show_id}/images")
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}

def get_show_recommendations(show_id):
    d = tmdb(f"/tv/{show_id}/recommendations", {"page": 1})
    return {"statusCode": 200, "headers": HEADERS, "body": json.dumps(d)}


# =========================================================================
# LAMBDA HANDLER — Updated with fuzzySearch route in correct position
# =========================================================================

def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    http_method = event.get('httpMethod', 'POST')
    path        = event.get('path', '')

    # ── GET: v2.0 endpoints ───────────────────────────────────────────────
    if http_method == 'GET':
        path_parts = path.split('/')
        if 'show' in path_parts:
            show_index = path_parts.index('show')
            if len(path_parts) > show_index + 1:
                show_id = path_parts[show_index + 1]
                if path.endswith('/providers'):      return get_show_providers(show_id)
                if path.endswith('/credits'):        return get_show_credits(show_id)
                if path.endswith('/videos'):         return get_show_videos(show_id)
                if path.endswith('/images'):         return get_show_images(show_id)
                if path.endswith('/recommendations'): return get_show_recommendations(show_id)
                return get_show_details(show_id)
        return {"statusCode": 400, "headers": HEADERS, "body": json.dumps({"error": "Invalid GET request"})}

    # ── POST: v1.0 search ─────────────────────────────────────────────────
    if http_method == 'POST':
        try:
            body = json.loads(event.get("body") or "{}")

            # ✅ NEW — fuzzySearch must be checked FIRST, before any other routing
            action = body.get("action", "")
            if action == "fuzzySearch":
                return fuzzy_search_handler(event, body)

            # ── existing fields ────────────────────────────────────────────
            query             = body.get("query", "").strip()
            network_filter_ui = body.get("network", "All")
            page              = body.get("page", 1)
            per_page          = body.get("per_page", 20)
            tmdb_id_req       = body.get("tmdb_id")
            cache_bust        = bool(body.get("cache_bust", False))

            # ── Cache check (skip for tmdb_id lookups and cache_bust) ──────
            if not tmdb_id_req and not cache_bust:
                cached = rag_cache_get(query, network_filter_ui, page)
                if cached:
                    cached["cache_hit"] = True
                    return {
                        "statusCode": 200,
                        "headers":    HEADERS,
                        "body":       json.dumps(cached, default=str),
                    }

            logger.info(f"Query='{query}' Network='{network_filter_ui}' Page={page}")

            if not query and not tmdb_id_req:
                return _response([], page=page, per_page=per_page)

            if tmdb_id_req and not query:
                results = resolve_series_by_id(tmdb_id_req, include_all_seasons=True)
                return _response(results, page=page, per_page=per_page)

            parsed = parse_query(query, network_filter_ui)
            logger.info(f"Parsed: {parsed}")

            if not validate_query_feasibility(parsed.get("network"), network_filter_ui):
                return _response([], error="Conflicting network filters", page=page, per_page=per_page)

            network_final = network_filter_ui if network_filter_ui not in ("All", "All Networks", "") else parsed.get("network")

            route, confidence = route_query(parsed)
            logger.info(f"Route: {route} (confidence={confidence:.2f})")

            results = []

            if route == "producer" and parsed.get("person_name"):
                results = resolve_person_producer(parsed["person_name"],
                    network_filter=network_final,
                    year_filter=parsed.get("year"), month_filter=parsed.get("month"))

            elif route == "actor" and parsed.get("person_name"):
                results = resolve_person_actor(parsed["person_name"],
                    network_filter=network_final,
                    year_filter=parsed.get("year"), month_filter=parsed.get("month"))

            elif route == "discover":
                genre_label, genre_id     = parsed.get("genre") or (None, None)
                keyword_label, keyword_id = parsed.get("keyword") or (None, None)
                network_id  = NETWORK_MAP.get(network_final) if network_final else None
                provider_id = None
                if network_final and not network_id:
                    provider_id = PROVIDER_MAP.get(network_final)
                    if provider_id: logger.info(f"Using provider_id={provider_id} for '{network_final}'")
                results = discover_shows(
                    genre_id=genre_id, keyword_id=keyword_id,
                    network_id=network_id, provider_id=provider_id,
                    year_filter=parsed.get("year"), month_filter=parsed.get("month"),
                    network_filter_name=network_final,
                    week_start=parsed.get("week_start"), week_end=parsed.get("week_end"))

            else:  # fallback: title search
                hits = title_search_with_fallback(query)
                for h in hits[:20]:
                    sid = h.get("id")
                    if sid:
                        data = resolve_series_by_id(sid, include_all_seasons=True,
                                                    year_filter=parsed.get("year"),
                                                    month_filter=parsed.get("month"))
                        if network_final and network_final not in ("All", "All Networks", ""):
                            data = [s for s in data if network_matches(s.get("network", ""), network_final)]
                        results.extend(data)

            # ── TMDB direct fallback ───────────────────────────────────────
            if not results and query:
                logger.info(f"RAG 0 results for '{query}' — TMDB direct fallback")
                try:
                    tmdb_hits = tmdb("/search/tv", {"query": query}).get("results", [])
                    seen_fb   = set()
                    for h in tmdb_hits[:10]:
                        sid = h.get("id")
                        if sid and sid not in seen_fb:
                            seen_fb.add(sid)
                            data = resolve_series_by_id(sid, include_all_seasons=False,
                                                        year_filter=parsed.get("year"),
                                                        month_filter=parsed.get("month"))
                            if network_final and network_final not in ("All", "All Networks", ""):
                                data = [s for s in data if network_matches(s.get("network", ""), network_final)]
                            results.extend(data)
                    logger.info(f"TMDB fallback: {len(results)} results for '{query}'")
                except Exception as e:
                    logger.error(f"TMDB fallback failed: {e}")

            results = _deduplicate(results)

            if parsed.get("rt_threshold"):
                results = [r for r in results if r.get("rt_score") and r["rt_score"] >= parsed["rt_threshold"]]
            if parsed.get("imdb_threshold"):
                results = [r for r in results if r.get("imdb_rating") and r["imdb_rating"] >= parsed["imdb_threshold"]]
            if parsed.get("tbd_only"):
                results = [r for r in results if r.get("premiereDate", "").lower() in ("tba", "tbd", "")]

            results = sort_results(results, order=parsed.get("sort_order", "asc"))
            logger.info(f"Final results: {len(results)}")

            # ── Build response and cache it ───────────────────────────────
            response_body = _response(results, page=page, per_page=per_page)
            if not tmdb_id_req:
                try:
                    rb = json.loads(response_body["body"])
                    rb["cache_hit"] = False
                    rag_cache_put(query, network_filter_ui, page, rb)
                except Exception as e:
                    logger.warning(f"Cache write failed: {e}")

            return response_body

        except Exception as e:
            logger.error(f"Lambda error: {e}", exc_info=True)
            return _response([], error=str(e), page=1, per_page=20)

    # ── OPTIONS: CORS preflight ───────────────────────────────────────────
    if http_method == 'OPTIONS':
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin":  "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": json.dumps({"message": "CORS preflight"}),
        }

    return {"statusCode": 405, "headers": HEADERS, "body": json.dumps({"error": "Method not allowed"})}

# =========================================================================
# RESPONSE HELPERS
# =========================================================================

def _deduplicate(results: List[Dict]) -> List[Dict]:
    seen, out = set(), []
    for r in results:
        key = (r.get("id"), r.get("title"))
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def _featured_subtitle() -> str:
    now = datetime.now()
    end = now + timedelta(days=30)
    label = now.strftime("%B %Y").upper() if now.month == end.month else \
            f"{now.strftime('%B')} – {end.strftime('%B %Y')}".upper()
    return f"NEXT 30 DAYS · {label}"


def _response(results: List[Dict], error: Optional[str] = None,
              page: int = 1, per_page: int = 20) -> Dict:
    all_results = results or []
    total  = len(all_results)
    pages  = max(1, -(-total // per_page))
    page   = max(1, min(page, pages))
    start  = (page - 1) * per_page
    body = {
        "results":          all_results[start: start + per_page],
        "pagination":       {"total":total,"page":page,"per_page":per_page,"pages":pages},
        "featured":         get_upcoming_premieres(),
        "featured_subtitle":_featured_subtitle(),
        "leaderboard":      get_hype_leaderboard(),
    }
    if error: body["error"] = error
    return {"statusCode":200,"headers":HEADERS,"body":json.dumps(body, default=str)}