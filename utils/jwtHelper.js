const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Add this line to serve static files
app.use(express.static('public'));

const EPG_API_BASE = 'https://sndbx-epgapi.taly.com.eg:5002';

async function getKid() {
    try {
        // Format public key properly
        const publicKey = process.env.TALLY_PUBLIC_KEY;
        
        const requestData = {
            username: process.env.TALLY_MERCHANT_USERNAME,
            rsa_public_key: publicKey
        };

        console.log('Sending KID request with data:', JSON.stringify(requestData, null, 2));

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

        if (!response.data || !response.data.kid) {
            throw new Error('Invalid KID response from server');
        }

        console.log('KID response:', response.data);
        return response.data.kid;
    } catch (error) {
        console.error('KID Error:', {
            message: error.message,
            data: error.response?.data,
            status: error.response?.status
        });
        throw new Error('Failed to get KID: ' + error.message);
    }
}

const getJwt = async (kid) => {
    try {
        const response = await axios.post(
            'https://sndbx-epgapi.taly.com.eg:5002/api/CreateJWT',
            {
                kid: kid,
                rsa_private_key: process.env.TALLY_PRIVATE_KEY
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        if (!response.data || !response.data.JWToken) {
            throw new Error('Invalid JWT response from server');
        }
        return response.data.JWToken;
    } catch (error) {
        console.error('JWT Error:', error.response?.data || error);
        throw new Error('Failed to get JWT: ' + error.message);
    }
};

module.exports = { getKid, getJwt };