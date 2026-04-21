
import json
import boto3
import os
import csv
import io
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal
import math

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamo    = boto3.resource("dynamodb", region_name="us-east-1")
s3        = boto3.client("s3",         region_name="us-east-1")
sagemaker = boto3.client("sagemaker",  region_name="us-east-1")

S3_BUCKET         = os.environ.get("S3_BUCKET",         "airdate-ml-data")
MODEL_NAME        = os.environ.get("MODEL_NAME",         "airdate-renewal-classifier-v1")
PREDICTIONS_TABLE = os.environ.get("PREDICTIONS_TABLE",  "airdate-renewal-predictions")
USERS_TABLE       = os.environ.get("USERS_TABLE",        "airdate-users")
CACHE_TABLE       = os.environ.get("CACHE_TABLE",        "airdate-cache")

NETWORK_MAP = {
    "netflix": 0, "hbo": 1, "max": 1, "hbo max": 1,
    "apple tv+": 2, "apple tv": 2, "disney+": 3, "disney plus": 3,
    "hulu": 4, "amazon": 5, "prime video": 5, "peacock": 6,
    "paramount+": 7, "paramount plus": 7, "abc": 8, "nbc": 9,
    "cbs": 10, "fox": 11, "fx": 12, "amc": 13, "showtime": 14, "starz": 15,
}

GENRE_COLS = [
    "genre_action_adventure","genre_animation","genre_comedy","genre_crime",
    "genre_documentary","genre_drama","genre_family","genre_kids",
    "genre_mystery","genre_reality","genre_sci_fi_fantasy","genre_western"
]

GENRE_MAP = {
    "action & adventure":"genre_action_adventure","action":"genre_action_adventure",
    "adventure":"genre_action_adventure","animation":"genre_animation",
    "comedy":"genre_comedy","crime":"genre_crime","documentary":"genre_documentary",
    "drama":"genre_drama","family":"genre_family","kids":"genre_kids",
    "mystery":"genre_mystery","reality":"genre_reality",
    "sci-fi & fantasy":"genre_sci_fi_fantasy","science fiction":"genre_sci_fi_fantasy",
    "fantasy":"genre_sci_fi_fantasy","western":"genre_western",
}

def build_feature_row(show):
    network_raw    = (show.get("network") or "").lower().strip()
    network_enc    = NETWORK_MAP.get(network_raw, 0)
    vote_avg       = float(show.get("vote_average") or 0)
    vote_count     = float(show.get("vote_count") or 0)
    popularity     = float(show.get("popularity") or 0)
    vote_count_log = math.log(vote_count + 1)
    popularity_log = math.log(popularity + 1)
    year           = int(str(show.get("first_air_date", "2020"))[:4] or 2020)
    num_seasons    = int(show.get("number_of_seasons") or 1)
    num_episodes   = int(show.get("number_of_episodes") or 1)
    is_english     = 1 if (show.get("original_language") or "en") == "en" else 0
    genres_raw     = show.get("genres") or []
    if isinstance(genres_raw, str):
        try: genres_raw = json.loads(genres_raw)
        except: genres_raw = []
    genre_flags = {col: 0 for col in GENRE_COLS}
    for g in genres_raw:
        name = (g.get("name") if isinstance(g, dict) else str(g)).lower()
        col  = GENRE_MAP.get(name)
        if col: genre_flags[col] = 1
    return [network_enc, vote_avg, vote_count_log, popularity_log,
            year, num_seasons, num_episodes, is_english] + \
           [genre_flags[col] for col in GENRE_COLS]

def get_shows_from_watchlists():
    table  = dynamo.Table(USERS_TABLE)
    shows  = {}
    kwargs = {
        "FilterExpression":          "tier = :pro",
        "ExpressionAttributeValues": {":pro": "pro"},
        "ProjectionExpression":      "watchlist",
    }
    while True:
        resp = table.scan(**kwargs)
        for user in resp.get("Items", []):
            for show in user.get("watchlist", []):
                sid = str(show.get("id", ""))
                if sid and sid not in shows:
                    shows[sid] = show
        last = resp.get("LastEvaluatedKey")
        if not last: break
        kwargs["ExclusiveStartKey"] = last
    logger.info(f"Found {len(shows)} unique shows")
    return shows

def enrich_from_cache(shows):
    table    = dynamo.Table(CACHE_TABLE)
    enriched = {}
    for show_id, show_data in shows.items():
        try:
            resp = table.get_item(Key={"cache_key": show_id, "content_type": "show_details"})
            item = resp.get("Item", {})
            if item:
                cached = json.loads(item.get("data", "{}")) if isinstance(item.get("data"), str) else item
                enriched[show_id] = {**show_data, **cached}
            else:
                enriched[show_id] = show_data
        except:
            enriched[show_id] = show_data
    return enriched

def lambda_handler(event, context):

    # Check if a transform job is already running
    running = sagemaker.list_transform_jobs(
        StatusEquals='InProgress',
        NameContains='airdate-renewal-batch'
    )
    if running.get('TransformJobSummaries'):
        logger.warning("Transform job already in progress — skipping")
        return {"statusCode": 200, "body": "Already running"}

    logger.info("=== AirDate Renewal Inference ===")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    shows = get_shows_from_watchlists()
    if not shows:
        return {"statusCode": 200, "body": "No shows"}

    shows = enrich_from_cache(shows)

    csv_buffer = io.StringIO()
    writer     = csv.writer(csv_buffer)
    valid_ids  = []
    for show_id, show_data in shows.items():
        try:
            row = build_feature_row(show_data)
            writer.writerow(row)
            valid_ids.append(show_id)
        except Exception as e:
            logger.warning(f"Skipping {show_id}: {e}")

    if not valid_ids:
        return {"statusCode": 200, "body": "No valid shows"}

    s3.put_object(Bucket=S3_BUCKET,
        Key=f"airdate-ml/inference/batch/show_ids_{timestamp}.json",
        Body=json.dumps(valid_ids))

    input_key = f"airdate-ml/inference/batch/input_{timestamp}.csv"
    s3.put_object(Bucket=S3_BUCKET, Key=input_key, Body=csv_buffer.getvalue())
    logger.info(f"Uploaded {len(valid_ids)} rows")

    job_name   = f"airdate-renewal-batch-{timestamp}"
    output_prefix = f"airdate-ml/inference/batch/output_{timestamp}/"

    sagemaker.create_transform_job(
        TransformJobName=job_name,
        ModelName=MODEL_NAME,
        TransformInput={
            "DataSource": {"S3DataSource": {
                "S3DataType": "S3Prefix",
                "S3Uri": f"s3://{S3_BUCKET}/{input_key}",
            }},
            "ContentType": "text/csv",
            "SplitType":   "Line",
        },
        TransformOutput={
            "S3OutputPath": f"s3://{S3_BUCKET}/{output_prefix}",
            "AssembleWith": "Line",
        },
        TransformResources={"InstanceType": "ml.m5.large", "InstanceCount": 1},
    )
    logger.info(f"Transform job: {job_name}")

    max_wait = 900
    waited   = 0
    while waited < max_wait:
        resp   = sagemaker.describe_transform_job(TransformJobName=job_name)
        status = resp["TransformJobStatus"]
        if status == "Completed": break
        if status == "Failed":
            return {"statusCode": 500, "body": resp.get("FailureReason", "Failed")}
        time.sleep(30)
        waited += 30

    # filename in output matches input filename
    input_filename = input_key.split("/")[-1]
    output_s3_key  = f"{output_prefix}{input_filename}.out"
    obj    = s3.get_object(Bucket=S3_BUCKET, Key=output_s3_key)
    scores = [float(line.strip()) for line in
              obj["Body"].read().decode("utf-8").strip().split("\n") if line.strip()]

    table      = dynamo.Table(PREDICTIONS_TABLE)
    updated_at = datetime.now(timezone.utc).isoformat()
    with table.batch_writer() as batch:
        for show_id, score in zip(valid_ids, scores):
            pct = round(score * 100, 1)
            batch.put_item(Item={
                "show_id":             show_id,
                "renewal_probability": Decimal(str(pct)),
                "label":               "renewed" if pct >= 50 else "cancelled",
                "updated_at":          updated_at,
                "model_version":       MODEL_NAME,
            })

    logger.info(f"Stored {len(scores)} predictions")
    return {"statusCode": 200, "body": json.dumps({
        "shows_processed": len(scores),
        "job_name":        job_name,
        "updated_at":      updated_at,
    })}

