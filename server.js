const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const EPG_API_BASE = 'https://sndbx-epgapi.taly.com.eg:5002';

async function getKid() {
    const rawPublicKey = fs.readFileSync(path.join(__dirname, '..', 'Booking_api[1]', 'publickey.txt'), 'utf8');
    // Replace all literal \n with real newlines
    const publicKey = rawPublicKey.replace(/\\n/g, '\n');
    console.log('Payload to /api/Key:', {
      username: process.env.TALLY_MERCHANT_USERNAME,
      rsa_public_key: publicKey
    });
    const response = await axios.post(
        `${EPG_API_BASE}/api/Key`,
        {
            username: process.env.TALLY_MERCHANT_USERNAME,
            rsa_public_key: publicKey
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }
    );
    console.log('Response from /api/Key:', response.data);
    if (!response.data.kid) throw new Error('No KID received');
    return response.data.kid;
}

async function getJwt(kid) {
    const rawPrivateKey = fs.readFileSync(path.join(__dirname, '..', 'Booking_api[1]', 'privatekey.txt'), 'utf8');
    // Replace all literal \n with real newlines
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
    console.log('Payload to /api/CreateJWT:', {
      kid,
      rsa_private_key: privateKey
    });
    const response = await axios.post(
        `${EPG_API_BASE}/api/CreateJWT`,
        {
            kid: kid,
            rsa_private_key: privateKey
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }
    );
    console.log('Response from /api/CreateJWT:', response.data);
    if (!response.data.JWToken) throw new Error('No JWT received');
    return response.data.JWToken;
}

app.post('/api/pay', async (req, res) => {
    try {
        // 1. Get KID
        const kid = await getKid();

        // 2. Get JWT
        const jwt = await getJwt(kid);

        // 3. Register payment
        const orderNumber = 'ORDER' + Date.now();
        const registerData = {
            userName: process.env.TALLY_MERCHANT_USERNAME,
            password: process.env.TALLY_MERCHANT_PASSWORD,
            orderNumber: orderNumber,
            amount: req.body.amount * 100, // minor units
            currency: '818',
            returnUrl: 'http://localhost:3000/payment-callback',
            features: 'FORCE_SSL'
        };

        const response = await axios.post(
            'https://sndbx-payment.taly.com.eg/epg/rest/register.do',
            new URLSearchParams(registerData),
            {
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        // 4. Return formUrl to frontend
        if (response.data.formUrl) {
            res.json({
                success: true,
                formUrl: response.data.formUrl,
                orderId: response.data.orderId,
                orderNumber
            });
        } else {
            res.json({
                success: false,
                error: 'No form URL received from payment gateway',
                rawResponse: response.data
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// Handle user redirect after payment (GET)
app.get('/payment-callback', (req, res) => {
    res.send('Payment callback received!<br><pre>' + JSON.stringify(req.query, null, 2) + '</pre>');
});

// Handle server-to-server notification (POST)
app.post('/payment-callback', (req, res) => {
    console.log('Payment callback POST data:', req.body);
    res.json({ received: true });
});

app.post('/api/register-order', async (req, res) => {
    try {
        // 1. Get KID
        const kid = await getKid();
        // 2. Get JWT
        const jwt = await getJwt(kid);
        // 3. Build registerData from req.body
        const registerData = {
            userName: req.body.userName,
            password: req.body.password,
            orderNumber: req.body.orderNumber,
            amount: req.body.amount,
            currency: req.body.currency || '818',
            returnUrl: req.body.returnUrl || 'http://localhost:3000/payment-callback',
            features: req.body.features || 'FORCE_SSL'
        };
        // 4. Call Taly register.do endpoint
        const response = await axios.post(
            'https://sndbx-payment.taly.com.eg/epg/rest/register.do',
            new URLSearchParams(registerData),
            {
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );
        // 5. Return formUrl/orderId to frontend
        if (response.data.formUrl) {
            res.json({
                success: true,
                formUrl: response.data.formUrl,
                orderId: response.data.orderId,
                orderNumber: registerData.orderNumber
            });
        } else {
            res.json({
                success: false,
                error: 'No form URL received from payment gateway',
                rawResponse: response.data
            });
        }
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.status(404).send('Not found');
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});