#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AirDate.tv — Safe Deploy Script
# Protects all Lambda-written S3 paths from --delete wipes
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

BUCKET="airdate.tv"
PROFILE="greymoonmedia"
CF_DIST="EUFOZ7OTGUMGW"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AirDate Safe Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Pre-flight — verify scoop manifest exists before touching anything
echo ""
echo "1/4  Pre-flight: verifying scoop manifest..."
MANIFEST_CHECK=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} 2>/dev/null | wc -l)

if [ "$MANIFEST_CHECK" -eq "0" ]; then
  echo "⚠️   WARNING: scoop/stories.json not found in S3."
  echo "    This may mean the pipeline hasn't run yet, or it was already wiped."
  read -p "    Continue anyway? (y/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Yy]$ ]] && echo "Aborted." && exit 1
else
  # Count stories in the manifest
  STORY_COUNT=$(aws s3 cp s3://${BUCKET}/scoop/stories.json - \
    --profile ${PROFILE} 2>/dev/null | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(len(d.get('items',[])))" 2>/dev/null || echo "?")
  echo "✅  scoop/stories.json found — ${STORY_COUNT} stories"
fi

# ── Step 2: Build
echo ""
echo "2/4  Building..."
npm run build
echo "✅  Build complete"

# ── Step 3: Sync — exclude ALL Lambda-managed paths recursively
echo ""
echo "3/4  Syncing dist/ → s3://${BUCKET}/"
echo "    Protected paths: scoop/*, images/*, assets/og/*, assets/images/*"

aws s3 sync dist/ s3://${BUCKET}/ \
  --profile ${PROFILE} \
  --delete \
  --exclude "scoop/*" \
  --exclude "scoop/stories/*" \
  --exclude "images/*" \
  --exclude "assets/og/*" \
  --exclude "assets/images/no-poster.png" \
  --exclude ".well-known/*"

echo "✅  Sync complete"

# ── Step 4: CloudFront invalidation (frontend assets only — not scoop paths)
echo ""
echo "4/4  Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id ${CF_DIST} \
  --paths "/*" \
  --profile ${PROFILE} \
  --no-cli-page

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Post-deploy verification
echo "  Post-deploy checks..."
MANIFEST_AFTER=$(aws s3 ls s3://${BUCKET}/scoop/stories.json \
  --profile ${PROFILE} 2>/dev/null | wc -l)

if [ "$MANIFEST_AFTER" -eq "0" ]; then
  echo "🔴  CRITICAL: scoop/stories.json is GONE after deploy!"
  echo "    Run the Step Functions pipeline manually to restore:"
  echo "    aws stepfunctions start-execution \\"
  echo "      --state-machine-arn arn:aws:states:us-east-1:775443380425:stateMachine:airdate-scoop-agent \\"
  echo "      --profile ${PROFILE} --region us-east-1"
else
  echo "✅  scoop/stories.json intact after deploy"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done. airdate.tv is live."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"