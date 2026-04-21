// airdate-stripe-webhook — v2.2
// v2.2: Added subscription_id + subscription_period_end storage on checkout
//       Added cancel_at_period_end = true handling in subscription.updated
//       (v2.1 only handled the reactivation / false branch)

const stripe = require('stripe');
const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const dynamo = new DynamoDBClient({ region: 'us-east-1' });

// ── Environment config ─────────────────────────────────────────────────────────
const ENV_CONFIG = {
    prod: {
        webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET_LIVE,
        stripeKey:      process.env.STRIPE_SECRET_KEY_LIVE,
        cognitoPoolId:  'us-east-1_J62LRXqEx'
    },
    dev: {
        webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET_TEST,
        stripeKey:      process.env.STRIPE_SECRET_KEY_TEST,
        cognitoPoolId:  'us-east-1_LIdVq7KLY'
    }
};

// ── Cognito helper ─────────────────────────────────────────────────────────────
async function updateCognitoUser(poolId, username, attributes) {
    const cognito = new CognitoIdentityProviderClient({ region: 'us-east-1' });
    await cognito.send(new AdminUpdateUserAttributesCommand({
        UserPoolId:     poolId,
        Username:       username,
        UserAttributes: attributes
    }));
    console.log(`Updated Cognito user ${username} in pool ${poolId}`);
}

// ── DynamoDB helper ────────────────────────────────────────────────────────────
async function downgradeDynamoUser(cognitoSub) {
    await dynamo.send(new UpdateItemCommand({
        TableName: 'airdate-users',
        Key: { user_id: { S: cognitoSub } },
        UpdateExpression:
            'SET tier = :free, ' +
            'cancel_at_period_end = :false, ' +
            'updated_at = :ts ' +
            'REMOVE subscription_period_end, subscription_id',
        ExpressionAttributeValues: {
            ':free':  { S: 'free' },
            ':false': { BOOL: false },
            ':ts':    { N: String(Math.floor(Date.now() / 1000)) },
        }
    }));
    console.log(`DynamoDB: downgraded ${cognitoSub} to free`);
}

// ── Handler ────────────────────────────────────────────────────────────────────
exports.handler = async (event) => {

    const stage  = event.requestContext?.stage || 'prod';
    const config = ENV_CONFIG[stage] || ENV_CONFIG.prod;

    console.log(`[AirDate Webhook] Stage: ${stage} | Pool: ${config.cognitoPoolId}`);

    // ── Verify Stripe signature ────────────────────────────────────────────────
    const sig = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        const stripeClient = stripe(config.stripeKey);
        stripeEvent = stripeClient.webhooks.constructEvent(
            event.body,
            sig,
            config.webhookSecret
        );
    } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    console.log(`[AirDate Webhook] Event type: ${stripeEvent.type}`);

    // ── Handle events ──────────────────────────────────────────────────────────
    try {

        // ── Checkout completed → upgrade to Pro ────────────────────────────────
        if (stripeEvent.type === 'checkout.session.completed') {
            const session    = stripeEvent.data.object;
            const cognitoSub = session.metadata?.cognito_sub;

            if (!cognitoSub) {
                console.error('No cognito_sub in session metadata');
                return { statusCode: 400, body: 'Missing cognito_sub' };
            }

            // ── v2.2: Fetch subscription to get period_end ─────────────────────
            let subscriptionId  = session.subscription || null;
            let periodEnd       = null;
            if (subscriptionId) {
                try {
                    const stripeClient = stripe(config.stripeKey);
                    const sub          = await stripeClient.subscriptions.retrieve(subscriptionId);
                    periodEnd          = sub.current_period_end; // Unix int
                } catch (subErr) {
                    console.error(`Could not retrieve subscription: ${subErr.message}`);
                }
            }

            // Update Cognito
            await updateCognitoUser(config.cognitoPoolId, cognitoSub, [
                { Name: 'custom:tier',               Value: 'pro'            },
                { Name: 'custom:stripe_customer_id', Value: session.customer }
            ]);

            // ── v2.2: DynamoDB now also stores subscription_id + period_end ────
            try {
                const updateExpr    = periodEnd
                    ? 'SET tier = :pro, stripe_customer_id = :cid, subscription_id = :sid, subscription_period_end = :pe, cancel_at_period_end = :false, updated_at = :ts'
                    : 'SET tier = :pro, stripe_customer_id = :cid, subscription_id = :sid, cancel_at_period_end = :false, updated_at = :ts';

                const exprVals = {
                    ':pro':   { S:    'pro'                                          },
                    ':cid':   { S:    session.customer                               },
                    ':sid':   { S:    subscriptionId || ''                           },
                    ':false': { BOOL: false                                          },
                    ':ts':    { N:    String(Math.floor(Date.now() / 1000))          },
                };
                if (periodEnd) exprVals[':pe'] = { N: String(periodEnd) };

                await dynamo.send(new UpdateItemCommand({
                    TableName:                 'airdate-users',
                    Key:                       { user_id: { S: cognitoSub } },
                    UpdateExpression:          updateExpr,
                    ExpressionAttributeValues: exprVals,
                }));
                console.log(`DynamoDB: upgraded ${cognitoSub} to pro — sub: ${subscriptionId}, period_end: ${periodEnd}`);
            } catch (dbErr) {
                console.error(`DynamoDB upgrade failed: ${dbErr.message}`);
                // Don't fail webhook — Cognito already updated
            }

            console.log(`Upgraded user ${cognitoSub} to Pro`);
        }

        // ── Subscription deleted → downgrade to Free ───────────────────────────
        else if (stripeEvent.type === 'customer.subscription.deleted') {
            const subscription = stripeEvent.data.object;
            const customerId   = subscription.customer;

            const stripeClient = stripe(config.stripeKey);
            const customer     = await stripeClient.customers.retrieve(customerId);
            const cognitoSub   = customer.metadata?.cognito_sub;

            if (!cognitoSub) {
                console.error(`No cognito_sub in customer metadata for ${customerId}`);
                return { statusCode: 400, body: 'Missing cognito_sub on customer' };
            }

            // Downgrade Cognito
            await updateCognitoUser(config.cognitoPoolId, cognitoSub, [
                { Name: 'custom:tier', Value: 'free' }
            ]);

            // Downgrade DynamoDB
            try {
                await downgradeDynamoUser(cognitoSub);
            } catch (dbErr) {
                console.error(`DynamoDB downgrade failed: ${dbErr.message}`);
            }

            console.log(`Downgraded user ${cognitoSub} to Free`);
        }

        // ── Subscription updated (cancel_at_period_end toggled) ────────────────
        else if (stripeEvent.type === 'customer.subscription.updated') {
            const subscription = stripeEvent.data.object;
            const customerId   = subscription.customer;

            console.log(`Subscription updated — cancel_at_period_end: ${subscription.cancel_at_period_end}`);

            // Fetch cognitoSub from customer metadata (needed for both branches)
            let cognitoSub = null;
            try {
                const stripeClient = stripe(config.stripeKey);
                const customer     = await stripeClient.customers.retrieve(customerId);
                cognitoSub         = customer.metadata?.cognito_sub;
            } catch (err) {
                console.error(`Could not retrieve customer ${customerId}: ${err.message}`);
            }

            if (!cognitoSub) {
                console.error(`No cognito_sub found for customer ${customerId}`);
                return { statusCode: 200, body: 'OK' }; // 200 so Stripe doesn't retry
            }

            // ── v2.2: CANCELLATION SCHEDULED (cancel_at_period_end = true) ─────
            if (subscription.cancel_at_period_end) {
                const periodEnd = subscription.current_period_end; // Unix int

                try {
                    await dynamo.send(new UpdateItemCommand({
                        TableName: 'airdate-users',
                        Key: { user_id: { S: cognitoSub } },
                        UpdateExpression:
                            'SET cancel_at_period_end = :true, ' +
                            'subscription_period_end = :pe, ' +
                            'updated_at = :ts',
                        ExpressionAttributeValues: {
                            ':true': { BOOL: true },
                            ':pe':   { N: String(periodEnd) },
                            ':ts':   { N: String(Math.floor(Date.now() / 1000)) },
                        }
                    }));
                    console.log(`DynamoDB: cancel scheduled for ${cognitoSub} at ${new Date(periodEnd * 1000).toISOString()}`);
                } catch (err) {
                    console.error(`DynamoDB cancel-schedule write failed: ${err.message}`);
                }

            // ── REACTIVATION (cancel_at_period_end = false) ────────────────────
            } else {
                try {
                    await dynamo.send(new UpdateItemCommand({
                        TableName: 'airdate-users',
                        Key: { user_id: { S: cognitoSub } },
                        UpdateExpression:
                            'SET cancel_at_period_end = :false, ' +
                            'updated_at = :ts ' +
                            'REMOVE subscription_period_end',
                        ExpressionAttributeValues: {
                            ':false': { BOOL: false },
                            ':ts':    { N: String(Math.floor(Date.now() / 1000)) },
                        }
                    }));
                    console.log(`DynamoDB: cleared cancel pending for ${cognitoSub}`);
                } catch (err) {
                    console.error(`Failed to clear cancel state: ${err.message}`);
                }
            }
        }

        // ── Invoice payment failed ─────────────────────────────────────────────
        else if (stripeEvent.type === 'invoice.payment_failed') {
            const invoice = stripeEvent.data.object;
            console.log(`Payment failed for customer ${invoice.customer} — no action taken`);
            // Future: SES payment failure notification
        }

        else {
            console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

    } catch (err) {
        console.error(`Error processing webhook event: ${err.message}`);
        return { statusCode: 500, body: `Processing error: ${err.message}` };
    }

    return { statusCode: 200, body: 'OK' };
};