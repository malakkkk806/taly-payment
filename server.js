const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { randomUUID } = require('crypto');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Read keys
const privateKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'privatekey.txt'), 'utf8');
const publicKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'publickey.txt'), 'utf8');

// Replace with your actual API key and secret from Taly
const API_KEY = process.env.TALY_API_KEY || 'YOUR_API_KEY';
const API_SECRET = process.env.TALY_API_SECRET || 'YOUR_API_SECRET';

const EPG_API_BASE = 'https://sndbx-epgapi.taly.com.eg:5002';
const MERCHANT_NAME = 'Booking_api';

// Helper: Generate a unique order number
function generateOrderNumber() {
    return 'ORDER-' + Date.now();
}

// Helper to get kid from /api/Key
async function getKid() {
    const publicKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'publickey.txt'), 'utf8');
    const response = await axios.post(
        `${EPG_API_BASE}/api/Key`,
        {
            publicKey: publicKey.replace(/\r?\n/g, ''),
            merchant: MERCHANT_NAME
        }
    );
    return response.data.kid;
}

// Helper to get JWT from /api/CreateJWT
async function getJwt(kid) {
    const privateKey = fs.readFileSync(path.join(__dirname, 'Booking_api[1]', 'privatekey.txt'), 'utf8');
    const response = await axios.post(
        `${EPG_API_BASE}/api/CreateJWT`,
        {
            kid,
            privateKey: privateKey.replace(/\r?\n/g, '')
        }
    );
    return response.data.jwt;
}

app.post('/api/pay', async (req, res) => {
    try {
        const { amount, cardNumber, expiry, cvv } = req.body;
        const [exp_month, exp_year_short] = expiry.split('/');
        const exp_year = '20' + exp_year_short;

        // 1. Get kid
        const kid = await getKid();
        // 2. Get JWT
        const jwt = await getJwt(kid);

        // 3. Prepare form data for process-payment
        const formData = new URLSearchParams();
        const mdOrder = randomUUID();
        formData.append('MdOrder', mdOrder);
        formData.append('Pan', cardNumber);
        formData.append('Year', parseInt(exp_year, 10));
        formData.append('Month', parseInt(exp_month, 10));
        formData.append('Language', 'en');
        formData.append('Cvc', cvv);

        // 4. Call process-payment with JWT
        const response = await axios.post(
            `${EPG_API_BASE}/api/PaymentAPI/process-payment`,
            formData,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${jwt}`
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        let details = null;
        if (error.response && error.response.data) {
            try {
                details = typeof error.response.data === 'string'
                    ? JSON.parse(error.response.data)
                    : error.response.data;
            } catch {
                details = error.response.data;
            }
        }
        res.status(500).json({
            error: error.message,
            details: details
        });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 