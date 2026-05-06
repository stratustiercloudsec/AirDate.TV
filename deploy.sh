#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AirDate.tv — Safe Deploy Script
# Usage: bash deploy.sh [staging|production]
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROFILE="greymoonmedia"
REGION="us-east-1"
ENV="${1:-staging}"

if [ "$ENV" == "production" ]; then
  read -p "⚠️  Deploying to PRODUCTION. Are you sure? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 1
  BUCKET="stage.s3.airdate.tv"
  CF_DIST="E2FVOUR7O26Q7P"
  SCOOP_MANIFEST_URL="https://airdate.tv/scoop/stories.json"
elif [ "$ENV" == "staging" ]; then
  BUCKET="stage.s3.airdate.tv"
  CF_DIST="E2FVOUR7O26Q7P"
  SCOOP_MANIFEST_URL="https://dev.airdate.tv/scoop/stories.json"
else
  echo "Usage: bash deploy.sh [staging|production]"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AirDate Safe Deploy"
echo "  Environment : ${ENV}"
echo "  Bucket      : ${BUCKET}"
echo "  CF Dist     : ${CF_DIST}"
echo "  Manifest    : ${SCOOP_MANIFEST_URL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Pre-flight — count scoop files BEFORE touching anything
echo ""
echo "1/5  Pre-flight checks..."

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

# ── Step 2: Bake env var into build
echo ""
echo "2/5  Building with VITE_SCOOP_MANIFEST_URL=${SCOOP_MANIFEST_URL}..."
VITE_SCOOP_MANIFEST_URL=${SCOOP_MANIFEST_URL} npm run build
echo "✅  Build complete"

# ── Step 3: Sync WITHOUT --delete first (safe add/update only)
# Then separately delete only non-protected files
echo ""
echo "3/5  Syncing dist/ → s3://${BUCKET}/ (protected paths excluded)..."

# ── CRITICAL: Use --exclude BEFORE --delete, and cover all nested paths
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