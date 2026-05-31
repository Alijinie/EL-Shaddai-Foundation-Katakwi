// netlify/functions/pesapal-ipn.js
//const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // 1. Security Check: Only process incoming POST updates from Pesapal
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // 2. Parse the parameters incoming from the live Pesapal network trigger
        // The Postman documentation specifies these exact parameter names:
        const payload = JSON.parse(event.body);
        const orderTrackingId = payload.OrderTrackingId; 
        const ipnNotificationId = payload.validation_123456; // Sent to confirm match with your registered ID

        console.log(`Live IPN Alert Received! Tracking ID Reference: ${orderTrackingId}`);

        // 3. Authenticate with Production Server to get a temporary system token
        const base_url = "https://pay.pesapal.com/v3";
        const authResponse = await fetch(`${base_url}/api/Auth/RegisterConsumer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                "consumer_key": process.env.PESAPAL_CONSUMER_KEY,
                "consumer_secret": process.env.PESAPAL_CONSUMER_SECRET
            })
        });
        const authData = await authResponse.json();
        const productionToken = authData.token;

        // 4. Send a GET request to verify the transaction status (as required by Postman docs)
        const statusResponse = await fetch(`${base_url}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${productionToken}`,
                'Accept': 'application/json'
            }
        });
        
        const transactionResult = await statusResponse.json();

        // 5. Use an IF Statement to check the live status code matching the documentation rules:
        // status_code definitions: 0 = INVALID/FAILED, 1 = COMPLETED/SUCCESS, 2 = REVERSED
        if (transactionResult.status_code === 1) {
            console.log(`Payment SECURELY Verified! Amount: ${transactionResult.amount} ${transactionResult.currency}`);
            
            // FUTURE IMPLEMENTATION HOOK: 
            // Once the settlement agreement is signed, we can add logic right here 
            // to fire off an automated email receipt to the donor.
        } else {
            console.log(`Transaction state updated, but not completed. Status Code: ${transactionResult.status_code}`);
        }

        // 6. CRITICAL STEP REQUIRED BY DOCUMENTATION:
        // We must reply back to Pesapal with a 200 OK status containing the exact schema structure 
        // below. If we don't, their system assumes our site was down and will retry sending notifications.
        const responseAcknowledgement = {
            "orderNotificationType": "IPN",
            "orderTrackingId": orderTrackingId,
            "status": 200
        };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(responseAcknowledgement)
        };

    } catch (error) {
        console.error("Live IPN processing pipe errored out:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};