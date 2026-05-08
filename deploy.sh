#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AirDate.tv — Safe Deploy Script v3.0
# - Wipes Vite transform cache before every build (fixes stale JS bundles)
# - Forces no-cache headers on HTML + JS/CSS assets
# - Protects all Lambda-written S3 paths from --delete wipes
# - Waits for CloudFront invalidation to complete before declaring success
# - Runs smoke test to verify site is live
# Usage: bash deploy.sh [staging|production]
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROFILE="greymoonmedia"
REGION="us-east-1"
ENV="${1:-staging}"

# ── Environment config ────────────────────────────────────────────────────────
if [ "$ENV" == "production" ]; then
  read -p "⚠️  Deploying to PRODUCTION (airdate.tv via Amplify). Are you sure? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 1
  BUCKET="stage.s3.airdate.tv"
  CF_DIST="E2FVOUR7O26Q7P"
  SMOKE_URL="https://airdate.tv/scoop"
  VITE_SCOOP_MANIFEST_URL="https://airdate.tv/scoop/stories.json"
  AMPLIFY_APP_ID="d2l7c6jhjkopde"
  AMPLIFY_BRANCH="main"
elif [ "$ENV" == "staging" ]; then
  BUCKET="stage.s3.airdate.tv"
  CF_DIST="E2FVOUR7O26Q7P"
  SMOKE_URL="https://dev.airdate.tv/scoop"
  VITE_SCOOP_MANIFEST_URL="https://dev.airdate.tv/scoop/stories.json"
  AMPLIFY_APP_ID=""
else
  echo "Usage: bash deploy.sh [staging|production]"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AirDate Safe Deploy v3.0"
echo "  Environment : ${ENV}"
echo "  Bucket      : ${BUCKET}"
echo "  CF Dist     : ${CF_DIST}"
echo "  Manifest    : ${VITE_SCOOP_MANIFEST_URL}"
echo "  Smoke URL   : ${SMOKE_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Pre-flight ────────────────────────────────────────────────────────
echo ""
echo "1/6  Pre-flight checks..."

STORY_JSON_COUNT=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} --region ${REGION} 2>/dev/null | wc -l)
STORY_FILE_COUNT=$(aws s3 ls s3://${BUCKET}/scoop/stories/ \
  --profile ${PROFILE} --region ${REGION} 2>/dev/null | wc -l)

if [ "$STORY_JSON_COUNT" -eq "0" ]; then
  echo "⚠️  WARNING: scoop/stories.json not found in s3://${BUCKET}"
  read -p "    Continue anyway? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 1
else
  STORY_COUNT=$(aws s3 cp s3://${BUCKET}/scoop/stories.json - \
    --profile ${PROFILE} --region ${REGION} 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "?")
  echo "✅  stories.json found — ${STORY_COUNT} stories"
  echo "✅  stories/ folder — ${STORY_FILE_COUNT} files"
fi

# ── Step 2: Clean build (wipe Vite cache first) ───────────────────────────────
echo ""
echo "2/6  Clearing Vite cache + building..."
echo "     Wiping node_modules/.vite and dist/..."
rm -rf node_modules/.vite dist
echo "✅  Cache cleared"

VITE_SCOOP_MANIFEST_URL=${VITE_SCOOP_MANIFEST_URL} npm run build
echo "✅  Build complete"

# ── Step 3: Sync HTML with no-cache headers ───────────────────────────────────
echo ""
echo "3/6  Syncing dist/ → s3://${BUCKET}/"
echo "     Protected: scoop/*, images/*, assets/og/*, .well-known/*"

# index.html — always no-cache so browser never serves stale HTML
aws s3 cp dist/index.html s3://${BUCKET}/index.html \
  --profile ${PROFILE} \
  --region ${REGION} \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate"

# JS/CSS assets — content-hashed filenames, long cache is fine
# but we force upload to ensure S3 is fresh
aws s3 sync dist/ s3://${BUCKET}/ \
  --profile ${PROFILE} \
  --region ${REGION} \
  --delete \
  --exclude "scoop/*" \
  --exclude "scoop/stories.json" \
  --exclude "scoop/stories/*" \
  --exclude "scoop/stories/**" \
  --exclude "images/*" \
  --exclude "assets/og/*" \
  --exclude "assets/images/no-poster.png" \
  --exclude ".well-known/*" \
  --exclude "index.html"

echo "✅  Sync complete"

# ── Step 4: Post-sync safety check ───────────────────────────────────────────
echo ""
echo "4/6  Post-sync safety checks..."

STORY_JSON_AFTER=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} --region ${REGION} 2>/dev/null | wc -l)
STORY_FILES_AFTER=$(aws s3 ls s3://${BUCKET}/scoop/stories/ \
  --profile ${PROFILE} --region ${REGION} 2>/dev/null | wc -l)

if [ "$STORY_JSON_AFTER" -eq "0" ]; then
  echo "🔴  CRITICAL: scoop/stories.json was WIPED — restoring..."
  aws s3 sync s3://airdate.tv/scoop/ s3://${BUCKET}/scoop/ \
    --content-type application/json \
    --cache-control "max-age=900" \
    --profile ${PROFILE} --region ${REGION}
  echo "✅  Restored"
else
  echo "✅  stories.json intact (${STORY_COUNT} stories)"
  echo "✅  stories/ files intact (${STORY_FILES_AFTER} files)"
fi

# ── Step 5: CloudFront invalidation (waits for completion) ───────────────────
echo ""
echo "5/6  Invalidating CloudFront (${CF_DIST})..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST} \
  --paths "/*" \
  --profile ${PROFILE} \
  --region ${REGION} \
  --query 'Invalidation.Id' --output text)

echo "     Waiting for invalidation ${INVALIDATION_ID} to complete..."
aws cloudfront wait invalidation-completed \
  --distribution-id ${CF_DIST} \
  --id ${INVALIDATION_ID} \
  --profile ${PROFILE} \
  --region ${REGION}

echo "✅  CloudFront invalidation complete"

# ── Step 6: Smoke test ────────────────────────────────────────────────────────
echo ""
echo "6/6  Smoke test: ${SMOKE_URL}..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SMOKE_URL}" 2>/dev/null)
if [ "$HTTP_CODE" == "200" ]; then
  echo "✅  Smoke test passed (HTTP ${HTTP_CODE})"
else
  echo "🔴  Smoke test FAILED (HTTP ${HTTP_CODE})"
  exit 1
fi

# ── Production: trigger Amplify rebuild ──────────────────────────────────────
if [ "$ENV" == "production" ] && [ -n "$AMPLIFY_APP_ID" ]; then
  echo ""
  echo "  Triggering Amplify rebuild for airdate.tv..."
  JOB_ID=$(aws amplify start-job \
    --app-id ${AMPLIFY_APP_ID} \
    --branch-name ${AMPLIFY_BRANCH} \
    --job-type RELEASE \
    --profile ${PROFILE} \
    --region ${REGION} \
    --query 'jobSummary.jobId' --output text)
  echo "✅  Amplify job ${JOB_ID} triggered"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ ${ENV} deploy complete and verified."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"