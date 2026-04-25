#!/bin/bash
# AirDate safe deploy — never deletes Lambda-written S3 paths
set -e
echo "Building..."
npm run build
echo "Syncing to S3..."
aws s3 sync dist/ s3://airdate.tv/ \
  --profile greymoonmedia \
  --delete \
  --exclude "scoop/*" \
  --exclude "images/*" \
  --exclude "assets/og/*"
echo "Invalidating CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id EUFOZ7OTGUMGW \
  --paths "/*" \
  --profile greymoonmedia \
  --no-cli-pager
echo "Done."
