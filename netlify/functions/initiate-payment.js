exports.handler = async (event, context) => {
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Method Not Allowed" })
        };
    }

    try {
        const { amount, currency, firstName, email } = JSON.parse(event.body);

        const consumerKey = process.env.PESAPAL_CONSUMER_KEY;
        const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
        const notificationId = process.env.PESAPAL_NOTIFICATION_ID;

        // =========================================================
        // ⬥ ENVIRONMENT TOGGLE (Set to false for Sandbox testing!)
        // =========================================================
        const IS_PRODUCTION = true; 

        const base_url = IS_PRODUCTION 
            ? "https://pay.pesapal.com/v3" 
            : "https://cybqa.pesapal.com/pesapalv3";

        console.log(`\n--- HANDSHAKE INITIALIZED [Mode: ${IS_PRODUCTION ? "PRODUCTION" : "SANDBOX"}] ---`);
        console.log("Checking credentials presence...");
        console.log("- Key Found:", consumerKey ? "YES (Valid length)" : "NO (EMPTY/UNDEFINED)");
        console.log("- Secret Found:", consumerSecret ? "YES (Valid length)" : "NO (EMPTY/UNDEFINED)");
        console.log("- IPN ID Found:", notificationId ? "YES" : "NO (EMPTY/UNDEFINED)");

        // 3. Request Access Token
        const authResponse = await fetch(`${base_url}/api/Auth/RequestToken`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                "consumer_key": consumerKey,
                "consumer_secret": consumerSecret
            })
        });

        const authData = await authResponse.json();

        // PRINT THE RAW ERROR DIRECTLY TO TERMINAL FOR ANALYSIS
        console.log("=========================================");
        console.log("PESAPAL RAW RESPONSE OBJECT:");
        console.log(JSON.stringify(authData, null, 2));
        console.log("=========================================");

        if (!authData.token) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    message: "Authentication failed or blocked by provider.", 
                    detail: authData 
                })
            };
        }

        const token = authData.token;
        const merchantReference = "ELSHADDAI-" + Date.now();

        const paymentOrder = {
            "id": merchantReference,
            "currency": currency,
            "amount": parseFloat(amount),
            "description": "Donation to El-Shaddai Foundation Katakwi",
            "callback_url": "https://elshaddaifoundation.netlify.app/payment-status.html", 
            "notification_id": notificationId, 
            "billing_address": {
                "email_address": email,
                "first_name": firstName
            }
        };

        const orderResponse = await fetch(`${base_url}/api/Transactions/SubmitOrderRequest`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(paymentOrder)
        });

        const orderData = await orderResponse.json();

        if (orderData.redirect_url) {
            return {
                statusCode: 200,
                body: JSON.stringify({ redirect_url: orderData.redirect_url })
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Order creation rejected.", detail: orderData })
            };
        }

    } catch (error) {
        console.error("Backend exception:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server execution exception.", error: error.message })
        };
    }
};