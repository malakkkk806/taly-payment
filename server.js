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

// Production URLs
const EPG_API_BASE = 'https://epgapi.taly.com.eg:5002'; // Production EPG API
const PAYMENT_GATEWAY_URL = 'https://epgapi.taly.com.eg/epg/rest/register.do'; // Production Payment Gateway 

async function getKid() {
    try {
        console.log('🔑 Getting KID from EPG API...');
        const rawPublicKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'publickey.txt'), 'utf8');
        const publicKey = rawPublicKey.replace(/\\n/g, '\n');

        const requestData = {
            username: process.env.TALLY_MERCHANT_USERNAME,
            rsa_public_key: publicKey
        };
        
        console.log('📤 Sending KID request to:', `${EPG_API_BASE}/api/Key`);
        console.log('📤 Request data:', { 
            username: requestData.username, 
            rsa_public_key: publicKey.substring(0, 50) + '...' 
        });

        const response = await axios.post(
            `${EPG_API_BASE}/api/Key`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ KID Response status:', response.status);
        console.log('✅ KID Response data:', response.data);

        if (!response.data.kid) throw new Error('No KID received');
        return response.data.kid;
    } catch (error) {
        console.error('❌ KID Error:', error.message);
        if (error.response) {
            console.error('❌ KID Error Status:', error.response.status);
            console.error('❌ KID Error Data:', error.response.data);
            console.error('❌ KID Error Headers:', error.response.headers);
        }
        throw error;
    }
}

async function getJwt(kid) {
    try {
        console.log('🔐 Getting JWT token...');
        const rawPrivateKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'privatekey.txt'), 'utf8');
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

        const requestData = {
            kid: kid,
            rsa_private_key: privateKey
        };

        console.log('📤 Sending JWT request to:', `${EPG_API_BASE}/api/CreateJWT`);
        console.log('📤 Request data:', { 
            kid: kid, 
            rsa_private_key: privateKey.substring(0, 50) + '...' 
        });

        const response = await axios.post(
            `${EPG_API_BASE}/api/CreateJWT`,
            requestData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ JWT Response status:', response.status);
        console.log('✅ JWT Response data:', response.data);

        if (!response.data.JWToken) throw new Error('No JWT received');
        return response.data.JWToken;
    } catch (error) {
        console.error('❌ JWT Error:', error.message);
        if (error.response) {
            console.error('❌ JWT Error Status:', error.response.status);
            console.error('❌ JWT Error Data:', error.response.data);
            console.error('❌ JWT Error Headers:', error.response.headers);
        }
        throw error;
    }
}

app.post('/api/register-order', async (req, res) => {
    try {
        console.log('🚀 Starting register order process...');
        console.log('📥 Request body:', req.body);
        
        const kid = await getKid();
        const jwt = await getJwt(kid);

        const {
            userName,
            password,
            orderNumber,
            amount,
            currency,
            returnUrl,
            features
        } = req.body;

        const registerData = {
            userName: process.env.TALLY_MERCHANT_USERNAME,
            password: process.env.TALLY_MERCHANT_PASSWORD,
            orderNumber,
            amount,
            currency: currency || '818',
            returnUrl: returnUrl || 'https://tally-payment-production.up.railway.app/',
            features: features || 'FORCE_SSL'
        };

        console.log('💳 Sending payment registration to Tally...');
        console.log('🔗 Payment URL:', PAYMENT_GATEWAY_URL);
        console.log('📋 Register data:', registerData);
        console.log('🔑 Using JWT token:', jwt.substring(0, 20) + '...');

        const response = await axios.post(
            PAYMENT_GATEWAY_URL,
            new URLSearchParams(registerData),
            {
                headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('✅ Payment registration response status:', response.status);
        console.log('✅ Payment registration response data:', response.data);

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
        console.error('❌ Register Order Error:', error.message);
        if (error.response) {
            console.error('❌ Error Status:', error.response.status);
            console.error('❌ Error Data:', error.response.data);
            console.error('❌ Error Headers:', error.response.headers);
            console.error('❌ Request URL:', error.config?.url);
            console.error('❌ Request Method:', error.config?.method);
            console.error('❌ Request Headers:', error.config?.headers);
        }
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
