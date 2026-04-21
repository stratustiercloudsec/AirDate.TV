import json
import boto3
from datetime import datetime

# Initialize AWS Resources outside the handler
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses', region_name='us-east-1')
table = dynamodb.Table("AirDate_Inquiries")

def lambda_handler(event, context):
    # This print MUST show up in CloudWatch if the function starts
    print("RECEIVED SIGNAL:", json.dumps(event))
    
    try:
        # HTTP API 2.0 can send body as a string OR a dict
        body_raw = event.get('body', '{}')
        if isinstance(body_raw, str):
            body = json.loads(body_raw)
        else:
            body = body_raw
            
        email = body.get('email')
        timestamp = body.get('timestamp', datetime.utcnow().isoformat())
        name = body.get('name', 'Anonymous')
        signal_type = body.get('type', 'general')
        message = body.get('message', '')

        # 1. DynamoDB Write
        table.put_item(
            Item={
                'email': email,
                'timestamp': timestamp,
                'name': name,
                'signal_type': signal_type,
                'message': message,
                'status': 'NEW_SIGNAL'
            }
        )

        # 2. SES Email (Wrapped in a sub-try so it doesn't kill the whole process)
        try:
            subject = f"AirDate Signal: {signal_type.upper()} from {name}"
            email_content = f"Identity: {name}\nEndpoint: {email}\n\n{message}"
            
            ses.send_email(
                Source='operations@stratustierlabs.com',
                Destination={'ToAddresses': ['operations@stratustierlabs.com']},
                ReplyToAddresses=[email],
                Message={
                    'Subject': {'Data': subject},
                    'Body': {'Text': {'Data': email_content}}
                }
            )
        except Exception as e_mail:
            print(f"Notification error: {str(e_mail)}")

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'message': 'Signal received.'})
        }

    except Exception as e:
        print(f"Fatal Logic Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Internal Processing Error'})
        }