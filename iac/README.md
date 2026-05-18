# AirDate.TV v3.4 Infrastructure as Code

## Validate
aws cloudformation validate-template \
  --template-body file://airdate-cloudformation.yaml \
  --profile greymoonmedia --region us-east-1

## Deploy (first time)
aws cloudformation create-stack \
  --stack-name airdate-infrastructure \
  --template-body file://airdate-cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile greymoonmedia --region us-east-1

## Update existing stack
aws cloudformation update-stack \
  --stack-name airdate-infrastructure \
  --template-body file://airdate-cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --profile greymoonmedia --region us-east-1

## DR Resources (not managed by CFN — existing)
- Cognito Prod:    us-east-1_J62LRXqEx
- Cognito Dev:     us-east-1_LIdVq7KLY
- Cognito Staff:   us-east-1_6lLVVlzzk
- CloudFront Prod: E790ECNWOI9EN
- CloudFront Stage:E2FVOUR7O26Q7P
- API Gateway:     21ave5trw7
- GuardDuty:       5ecf1dd49979e01114cb4e0b7b92f6e2
