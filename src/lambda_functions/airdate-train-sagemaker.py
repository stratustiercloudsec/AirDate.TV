#!/usr/bin/env python3
"""
train_sagemaker.py — AirDate v2.37
Launches a SageMaker XGBoost Training Job using the CSV from S3.
Run after collect_tmdb_data.py completes.

  pip install boto3 sagemaker
  python3 train_sagemaker.py

The training job takes ~5-10 minutes and costs ~$0.10.
Model artifact saved to: s3://YOUR_BUCKET/airdate-ml/model/
"""

import boto3, sagemaker, time
from sagemaker.inputs import TrainingInput
from sagemaker.estimator import Estimator

# ── Config — update these ─────────────────────────────────────────────────────
S3_BUCKET   = "airdate-ml-data"           # same bucket from collect_tmdb_data.py
S3_PREFIX   = "airdate-ml"
AWS_REGION  = "us-east-1"
ACCOUNT_ID  = "775443380425"

# IAM role that SageMaker will assume — needs S3 + CloudWatch access
# Create this in IAM if it doesn't exist (see DEPLOYMENT.md)
SAGEMAKER_ROLE = f"arn:aws:iam::{ACCOUNT_ID}:role/airdate-sagemaker-role"

def launch_training():
    print("=" * 60)
    print("AirDate v2.37 — SageMaker Training Job")
    print("=" * 60)

    session    = sagemaker.Session(boto_session=boto3.Session(region_name=AWS_REGION))
    boto_sm    = boto3.client("sagemaker", region_name=AWS_REGION)

    # ── XGBoost built-in container ────────────────────────────────────────────
    # SageMaker provides a managed XGBoost image — no Docker needed
    xgboost_image = sagemaker.image_uris.retrieve(
        framework="xgboost",
        region=AWS_REGION,
        version="1.7-1",
    )
    print(f"\n  Using XGBoost image: {xgboost_image}")

    # ── Hyperparameters ───────────────────────────────────────────────────────
    # Tuned for binary classification on tabular show data
    hyperparams = {
        "objective":        "binary:logistic",  # output probability 0-1
        "num_round":        200,                # boosting rounds
        "max_depth":        5,                  # tree depth
        "eta":              0.1,                # learning rate
        "min_child_weight": 3,
        "subsample":        0.8,
        "colsample_bytree": 0.8,
        "eval_metric":      "auc",              # AUC for imbalanced classes
        "scale_pos_weight": 1,                  # adjust if classes are imbalanced
        "early_stopping_rounds": 15,
        "num_class":        1,
    }

    # ── Estimator ─────────────────────────────────────────────────────────────
    estimator = Estimator(
        image_uri=xgboost_image,
        role=SAGEMAKER_ROLE,
        instance_count=1,
        instance_type="ml.m5.large",    # cheapest sufficient instance ~$0.10/hr
        volume_size=10,                 # GB
        max_run=3600,                   # 1hr max (job usually finishes in 5-10 min)
        output_path=f"s3://{S3_BUCKET}/{S3_PREFIX}/model/",
        sagemaker_session=session,
        hyperparameters=hyperparams,
        base_job_name="airdate-renewal-classifier",
    )

    # ── Data channels ─────────────────────────────────────────────────────────
    # SageMaker XGBoost expects CSV with label in first column — our format matches
    train_input = TrainingInput(
        s3_data=f"s3://{S3_BUCKET}/{S3_PREFIX}/training/training_latest.csv",
        content_type="text/csv",
    )

    print(f"\n  Training data: s3://{S3_BUCKET}/{S3_PREFIX}/training/training_latest.csv")
    print(f"  Output path:   s3://{S3_BUCKET}/{S3_PREFIX}/model/")
    print(f"  Instance:      ml.m5.large (~$0.10 total)")
    print(f"\n  Starting training job...")

    # ── Launch ────────────────────────────────────────────────────────────────
    estimator.fit({"train": train_input}, wait=True, logs="All")

    # ── Get model artifact location ───────────────────────────────────────────
    job_name    = estimator.latest_training_job.name
    model_data  = estimator.model_data

    print(f"\n{'=' * 60}")
    print(f"✅ Training complete!")
    print(f"   Job name:       {job_name}")
    print(f"   Model artifact: {model_data}")
    print(f"\n  Copy this path — you need it for the inference Lambda:")
    print(f"  MODEL_S3_URI = \"{model_data}\"")

    # ── Save model URI to a config file for the inference Lambda ──────────────
    config = {
        "job_name":   job_name,
        "model_data": model_data,
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "s3_bucket":  S3_BUCKET,
        "s3_prefix":  S3_PREFIX,
    }
    import json
    config_key = f"{S3_PREFIX}/model/latest_model_config.json"
    boto3.client("s3", region_name=AWS_REGION).put_object(
        Bucket=S3_BUCKET,
        Key=config_key,
        Body=json.dumps(config, indent=2),
        ContentType="application/json",
    )
    print(f"\n  Config saved: s3://{S3_BUCKET}/{config_key}")
    print(f"  Next step: deploy airdate-renewal-inference Lambda")
    print(f"{'=' * 60}")

    return model_data

if __name__ == "__main__":
    launch_training()