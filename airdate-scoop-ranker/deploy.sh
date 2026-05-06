#!/bin/bash
set -e

FUNCTION_NAME="airdate-scoop-ranker"
REGION="us-east-1"
ACCOUNT_ID="775443380425"
ROLE_NAME="airdate-scoop-ranker-role"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "==> Packaging Lambda..."
zip -q function.zip lambda_function.py

if ! aws iam get-role --role-name "$ROLE_NAME" --region "$REGION" &>/dev/null; then
  echo "==> Creating IAM role..."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    --region "$REGION" > /dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "bedrock-invoke" \
    --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["bedrock:InvokeModel"],"Resource":"*"}]}'
  echo "    Waiting for IAM propagation..."
  sleep 12
else
  echo "==> IAM role exists, skipping."
fi

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "==> Updating Lambda..."
  aws lambda update-function-code --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip --region "$REGION" > /dev/null
  aws lambda update-function-configuration --function-name "$FUNCTION_NAME" \
    --timeout 30 --memory-size 256 --region "$REGION" > /dev/null
else
  echo "==> Creating Lambda..."
  aws lambda create-function --function-name "$FUNCTION_NAME" \
    --runtime python3.12 --role "$ROLE_ARN" \
    --handler lambda_function.lambda_handler \
    --timeout 30 --memory-size 256 \
    --zip-file fileb://function.zip --region "$REGION" > /dev/null
  aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$REGION"
fi

echo ""
echo "==> Smoke test..."
PAYLOAD='{"raw_articles":[{"headline":"CBS Cancels Watson After One Season","summary":"CBS has decided not to renew the medical drama Watson.","domain":"deadline.com","url":"https://deadline.com/watson-cancelled","published_at":"2026-04-24T20:00:00Z","story_hash":"test001"},{"headline":"Netflix Renews Stranger Things for Final Season","summary":"Netflix confirmed Stranger Things returns for its fifth and final season.","domain":"variety.com","url":"https://variety.com/stranger-things-s5","published_at":"2026-04-24T20:00:00Z","story_hash":"test002"},{"headline":"HBO Orders New Drama From Succession Creator","summary":"HBO greenlit a new limited series from Jesse Armstrong about private equity.","domain":"hollywoodreporter.com","url":"https://hollywoodreporter.com/hbo-armstrong","published_at":"2026-04-24T20:00:00Z","story_hash":"test003"}]}'

aws lambda invoke --function-name "$FUNCTION_NAME" \
  --payload "$PAYLOAD" --cli-binary-format raw-in-base64-out \
  /tmp/ranker-test.json --region "$REGION" > /dev/null

cat /tmp/ranker-test.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
arts=d.get('ranked_articles',[])
print(f'  Ranked {len(arts)} articles | Bedrock calls: {d.get(\"bedrock_calls\",0)}')
for a in arts:
    m=a.get('scoring_method','?')[0].upper()
    print(f'  [{m}] {a[\"newsworthiness\"]:5.1f}  {a[\"headline\"]}')
"
rm -f function.zip
echo "==> Done: arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
