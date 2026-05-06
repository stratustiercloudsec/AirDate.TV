#!/usr/bin/env python3
"""
collect_tmdb_data.py — AirDate v2.37
Pulls 10,000+ TV shows from TMDB, extracts renewal features,
and saves a training CSV to S3.

Run once on your EC2 instance:
  pip install requests boto3
  python3 collect_tmdb_data.py

Output: s3://YOUR_BUCKET/airdate-ml/training/training.csv
"""

import os, json, time, csv, boto3, requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
TMDB_API_KEY = "9e7202516e78494f2b18ec86d29a4309"
S3_BUCKET    = os.environ.get("S3_BUCKET", "airdate-ml-data")     # create this bucket
S3_PREFIX    = "airdate-ml/training"
OUTPUT_FILE  = "/tmp/training.csv"
REQUEST_DELAY = 0.26   # TMDB rate limit: ~40 req/sec, stay safe at 4/sec

# ── TMDB status codes → label ─────────────────────────────────────────────────
# 0 = Returning Series  → renewed = 1
# 1 = Planned           → skip (no outcome yet)
# 2 = In Production     → skip
# 3 = Ended             → renewed = 0 (natural end, still counts as "not renewed")
# 4 = Cancelled         → renewed = 0
# 5 = Pilot             → skip
LABEL_MAP = {
    "Returning Series": 1,
    "Ended":            0,
    "Canceled":         0,
}

# ── Top networks to include (TMDB network IDs) ────────────────────────────────
# Keeps dataset focused on major platforms where renewal decisions are meaningful
TARGET_NETWORK_IDS = [
    213,   # Netflix
    1024,  # Amazon Prime
    453,   # Hulu
    2739,  # Disney+
    2552,  # Apple TV+
    49,    # HBO
    174,   # AMC
    6,     # NBC
    2,     # ABC
    16,    # CBS
    19,    # FOX
    67,    # Showtime
    318,   # Starz
    4330,  # Peacock
    3353,  # Paramount+
]

# ── Genre encoding (TMDB genre IDs) ──────────────────────────────────────────
GENRE_MAP = {
    10759: "action_adventure",
    16:    "animation",
    35:    "comedy",
    80:    "crime",
    99:    "documentary",
    18:    "drama",
    10751: "family",
    10762: "kids",
    9648:  "mystery",
    10763: "news",
    10764: "reality",
    10765: "sci_fi_fantasy",
    10766: "soap",
    10767: "talk",
    10768: "war_politics",
    37:    "western",
}

# ── Network encoding ──────────────────────────────────────────────────────────
NETWORK_MAP = {
    213:   0,   # Netflix
    1024:  1,   # Prime Video
    453:   2,   # Hulu
    2739:  3,   # Disney+
    2552:  4,   # Apple TV+
    49:    5,   # HBO
    174:   6,   # AMC
    6:     7,   # NBC
    2:     8,   # ABC
    16:    9,   # CBS
    19:    10,  # FOX
    67:    11,  # Showtime
    318:   12,  # Starz
    4330:  13,  # Peacock
    3353:  14,  # Paramount+
    999:   15,  # Other
}

FEATURE_COLS = [
    "renewed",           # label (target)
    "network_encoded",
    "vote_average",
    "vote_count_log",    # log-scaled to reduce skew
    "popularity_log",
    "first_air_year",
    "number_of_seasons",
    "number_of_episodes",
    "is_english",
    "genre_action_adventure",
    "genre_animation",
    "genre_comedy",
    "genre_crime",
    "genre_documentary",
    "genre_drama",
    "genre_family",
    "genre_kids",
    "genre_mystery",
    "genre_reality",
    "genre_sci_fi_fantasy",
    "genre_western",
]

def tmdb_get(path, params=None):
    """Make a TMDB API call with retry logic."""
    base_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        base_params.update(params)
    for attempt in range(3):
        try:
            r = requests.get(f"https://api.themoviedb.org/3{path}",
                             params=base_params, timeout=10)
            if r.status_code == 429:
                print("Rate limited — sleeping 5s")
                time.sleep(5)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}")
            time.sleep(2)
    return None

def get_show_ids_by_status(status_code, pages=25):
    """Discover shows by status code. Returns list of TMDB show IDs."""
    ids = []
    for network_id in TARGET_NETWORK_IDS:
        for page in range(1, pages + 1):
            data = tmdb_get("/discover/tv", {
                "with_status":   status_code,
                "with_networks": network_id,
                "sort_by":       "vote_count.desc",
                "page":          page,
            })
            if not data or not data.get("results"):
                break
            ids.extend([s["id"] for s in data["results"]])
            time.sleep(REQUEST_DELAY)
            if page >= data.get("total_pages", 1):
                break
    return list(set(ids))  # deduplicate

def extract_features(detail):
    """Extract and encode features from a TMDB show detail response."""
    import math

    # ── Label ─────────────────────────────────────────────────────────────────
    status  = detail.get("status", "")
    label   = LABEL_MAP.get(status)
    if label is None:
        return None   # skip planned/in-production/pilot

    # ── Network ───────────────────────────────────────────────────────────────
    networks    = detail.get("networks", [])
    network_id  = networks[0]["id"] if networks else 999
    network_enc = NETWORK_MAP.get(network_id, 15)

    # ── Ratings ───────────────────────────────────────────────────────────────
    vote_avg   = float(detail.get("vote_average", 0) or 0)
    vote_count = int(detail.get("vote_count", 0) or 0)
    popularity = float(detail.get("popularity", 0) or 0)

    vote_count_log = math.log1p(vote_count)
    popularity_log = math.log1p(popularity)

    # ── Temporal ──────────────────────────────────────────────────────────────
    first_air = detail.get("first_air_date", "") or ""
    try:
        first_air_year = int(first_air[:4]) if first_air else 2000
    except ValueError:
        first_air_year = 2000

    # Only include shows from 2000+ (streaming era) for relevance
    if first_air_year < 2000:
        return None

    # ── Seasons / Episodes ────────────────────────────────────────────────────
    num_seasons  = int(detail.get("number_of_seasons", 1) or 1)
    num_episodes = int(detail.get("number_of_episodes", 0) or 0)

    # ── Language ──────────────────────────────────────────────────────────────
    is_english = 1 if detail.get("original_language") == "en" else 0

    # ── Genres (multi-hot) ────────────────────────────────────────────────────
    genre_ids  = {g["id"] for g in detail.get("genres", [])}
    genre_feats = {
        "genre_action_adventure": int(10759 in genre_ids),
        "genre_animation":        int(16    in genre_ids),
        "genre_comedy":           int(35    in genre_ids),
        "genre_crime":            int(80    in genre_ids),
        "genre_documentary":      int(99    in genre_ids),
        "genre_drama":            int(18    in genre_ids),
        "genre_family":           int(10751 in genre_ids),
        "genre_kids":             int(10762 in genre_ids),
        "genre_mystery":          int(9648  in genre_ids),
        "genre_reality":          int(10764 in genre_ids),
        "genre_sci_fi_fantasy":   int(10765 in genre_ids),
        "genre_western":          int(37    in genre_ids),
    }

    return {
        "renewed":              label,
        "network_encoded":      network_enc,
        "vote_average":         round(vote_avg, 2),
        "vote_count_log":       round(vote_count_log, 4),
        "popularity_log":       round(popularity_log, 4),
        "first_air_year":       first_air_year,
        "number_of_seasons":    num_seasons,
        "number_of_episodes":   num_episodes,
        "is_english":           is_english,
        **genre_feats,
    }

def collect_and_write():
    print("=" * 60)
    print("AirDate v2.37 — TMDB Data Collection")
    print("=" * 60)

    # ── Collect show IDs by status ────────────────────────────────────────────
    print("\n[1/4] Discovering show IDs...")

    # Returning Series (status=0) → label 1
    print("  → Fetching Returning Series...")
    returning_ids = get_show_ids_by_status(0, pages=20)
    print(f"     Found {len(returning_ids)} returning shows")

    # Cancelled (status=4) → label 0
    print("  → Fetching Cancelled shows...")
    cancelled_ids = get_show_ids_by_status(4, pages=20)
    print(f"     Found {len(cancelled_ids)} cancelled shows")

    # Ended (status=3) → label 0
    print("  → Fetching Ended shows...")
    ended_ids = get_show_ids_by_status(3, pages=15)
    print(f"     Found {len(ended_ids)} ended shows")

    all_ids = list(set(returning_ids + cancelled_ids + ended_ids))
    print(f"\n  Total unique show IDs: {len(all_ids)}")

    # ── Fetch details and extract features ────────────────────────────────────
    print("\n[2/4] Fetching show details and extracting features...")
    rows = []
    skipped = 0

    for i, show_id in enumerate(all_ids):
        if i % 200 == 0:
            print(f"  Progress: {i}/{len(all_ids)} — {len(rows)} valid rows so far")

        detail = tmdb_get(f"/tv/{show_id}")
        if not detail:
            skipped += 1
            continue

        features = extract_features(detail)
        if features:
            rows.append(features)
        else:
            skipped += 1

        time.sleep(REQUEST_DELAY)

    print(f"\n  Extracted {len(rows)} valid training samples ({skipped} skipped)")

    # ── Class balance check ───────────────────────────────────────────────────
    renewed_count   = sum(1 for r in rows if r["renewed"] == 1)
    cancelled_count = sum(1 for r in rows if r["renewed"] == 0)
    print(f"  Class balance: {renewed_count} renewed / {cancelled_count} cancelled")

    # ── Write CSV ─────────────────────────────────────────────────────────────
    print(f"\n[3/4] Writing CSV to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FEATURE_COLS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  ✅ Written {len(rows)} rows")

    # ── Upload to S3 ──────────────────────────────────────────────────────────
    print(f"\n[4/4] Uploading to S3...")
    s3 = boto3.client("s3", region_name="us-east-1")

    # Create bucket if it doesn't exist
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
    except Exception:
        print(f"  Creating bucket s3://{S3_BUCKET}...")
        s3.create_bucket(Bucket=S3_BUCKET)

    timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
    s3_key     = f"{S3_PREFIX}/training_{timestamp}.csv"
    latest_key = f"{S3_PREFIX}/training_latest.csv"

    s3.upload_file(OUTPUT_FILE, S3_BUCKET, s3_key)
    s3.upload_file(OUTPUT_FILE, S3_BUCKET, latest_key)

    print(f"  ✅ s3://{S3_BUCKET}/{s3_key}")
    print(f"  ✅ s3://{S3_BUCKET}/{latest_key}  ← used by training job")
    print(f"\n{'=' * 60}")
    print(f"Data collection complete! {len(rows)} training samples ready.")
    print(f"Next step: run train_sagemaker.py")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    collect_and_write()