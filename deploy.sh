#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AirDate.tv — Safe Deploy Script
# Protects all Lambda-written S3 paths from --delete wipes
# Usage: bash deploy.sh [staging|production]
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROFILE="greymoonmedia"
REGION="us-east-1"

# ── Environment toggle (default: staging)
ENV="${1:-staging}"

if [ "$ENV" == "production" ]; then
  BUCKET="stage.s3.airdate.tv"    # React app prod → d3t7gopk4cip9i.cloudfront.net
  CF_DIST="E2FVOUR7O26Q7P"        # React app CloudFront — NOT E790ECNWOI9EN
elif [ "$ENV" == "staging" ]; then
  BUCKET="stage.s3.airdate.tv"    # Same for now — Amplify handles its own
  CF_DIST="E2FVOUR7O26Q7P"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AirDate Safe Deploy"
echo "  Environment : ${ENV}"
echo "  Bucket      : ${BUCKET}"
echo "  CF Dist     : ${CF_DIST}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Pre-flight — verify scoop manifest exists before touching anything
echo ""
echo "1/4  Pre-flight: verifying scoop manifest..."
MANIFEST_CHECK=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} \
  --region ${REGION} 2>/dev/null | wc -l)

if [ "$MANIFEST_CHECK" -eq "0" ]; then
  echo "⚠️   WARNING: scoop/stories.json not found in s3://${BUCKET}."
  echo "    This may mean the pipeline hasn't run yet, or it was already wiped."
  read -p "    Continue anyway? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 1
else
  STORY_COUNT=$(aws s3 cp s3://${BUCKET}/scoop/stories.json - \
    --profile ${PROFILE} \
    --region ${REGION} 2>/dev/null | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "?")
  echo "✅  scoop/stories.json found — ${STORY_COUNT} stories"
fi

# ── Step 2: Build
echo ""
echo "2/4  Building..."
npm run build
echo "✅  Build complete"

# ── Step 3: Sync — exclude ALL Lambda-managed paths
echo ""
echo "3/4  Syncing dist/ → s3://${BUCKET}/"
echo "     Protected: scoop/*, images/*, assets/og/*, assets/images/*, .well-known/*"

aws s3 sync dist/ s3://${BUCKET}/ \
  --profile ${PROFILE} \
  --region ${REGION} \
  --delete \
  --exclude "scoop/*" \
  --exclude "scoop/stories/*" \
  --exclude "images/*" \
  --exclude "assets/og/*" \
  --exclude "assets/images/no-poster.png" \
  --exclude ".well-known/*"

echo "✅  Sync complete"

# ── Step 4: CloudFront invalidation
echo ""
echo "4/4  Invalidating CloudFront (${CF_DIST})..."
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST} \
  --paths "/*" \
  --profile ${PROFILE} \
  --region ${REGION} \
  --no-cli-pager

echo "✅  Invalidation submitted (InProgress — takes ~30–60s to propagate)"

# ── Post-deploy: verify scoop manifest survived the --delete sync
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Post-deploy checks..."
MANIFEST_AFTER=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} \
  --region ${REGION} 2>/dev/null | wc -l)

if [ "$MANIFEST_AFTER" -eq "0" ]; then
  echo "🔴  CRITICAL: scoop/stories.json is GONE after deploy!"
  echo "    Restore by running the Step Functions pipeline manually:"
  echo ""
  echo "    aws stepfunctions start-execution \\"
  echo "      --state-machine-arn arn:aws:states:us-east-1:775443380425:stateMachine:airdate-scoop-agent \\"
  echo "      --profile ${PROFILE} --region ${REGION}"
  echo ""
else
  echo "✅  scoop/stories.json intact after deploy"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done. ${ENV} is live."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"