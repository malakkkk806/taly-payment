// server.js - ready for Railway deployment

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, "public")));

const EPG_API_BASE = 'https://sndbx-epgapi.taly.com.eg:5002';

async function getKid() {
    const rawPublicKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'publickey.txt'), 'utf8');
    const publicKey = rawPublicKey.replace(/\\n/g, '\n');

    const response = await axios.post(
        `${EPG_API_BASE}/api/Key`,
        {
            username: 'Booking_api',
            rsa_public_key: publicKey
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }
    );

    if (!response.data.kid) throw new Error('No KID received');
    return response.data.kid;
}

async function getJwt(kid) {
    const rawPrivateKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'privatekey.txt'), 'utf8');
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

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

    if (!response.data.JWToken) throw new Error('No JWT received');
    return response.data.JWToken;
}

app.post('/api/register-order', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        
        console.log('Getting KID...');
        const kid = await getKid();
        console.log('KID received:', kid);
        
        console.log('Getting JWT...');
        const jwt = await getJwt(kid);
        console.log('JWT received:', jwt ? 'Yes' : 'No');

        const {
            username,
            password,
            orderNumber,
            amount,
            currency,
            returnUrl,
            features
        } = req.body;

        console.log('Extracted fields:', {
            username,
            password: password ? '***' : undefined,
            orderNumber,
            amount,
            currency,
            returnUrl,
            features
        });

        const registerData = {
            userName: username, // Try with camelCase
            password,
            orderNumber,
            amount,
            currency: currency || '818',
            returnUrl: returnUrl || 'https://tally-payment-production.up.railway.app/',
            features: features || 'FORCE_SSL'
        };

        console.log('Sending to payment gateway:', {
            ...registerData,
            password: '***'
        });

        const urlParams = new URLSearchParams(registerData);
        console.log('URL Parameters:', urlParams.toString());

        const response = await axios.post(
            'https://sndbx-payment.taly.com.eg/epg/rest/register.do',
            urlParams,
            {
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );

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
        console.error('Register Order Error:', error.message);
        console.error('Error details:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers
        });
        res.json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

