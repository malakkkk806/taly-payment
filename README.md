# Tally Payment Gateway Integration

This project demonstrates a full-stack integration with the Taly EPG (Electronic Payment Gateway) API using Node.js (Express) for the backend and a simple HTML frontend. It securely handles payment initiation, JWT authentication, and displays payment results to the user.

---

## Features
- Node.js + Express backend for secure API communication
- Reads public/private keys for JWT-based authentication
- Calls Taly EPG API endpoints for payment processing
- Simple HTML frontend for payment form and result display
- Robust error handling and user feedback

---

## Folder Structure
```
Tally/
├── Booking_api[1]/
│   ├── privatekey.txt
│   └── publickey.txt
├── public/
│   └── index.html
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

---

## Setup Instructions

1. **Clone the repository:**
   ```sh
   git clone <your-repo-url>
   cd Tally
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Add your EPG keys:**
   - Place your `privatekey.txt` and `publickey.txt` in the `Booking_api[1]/` folder.
   - Ensure the merchant name matches your credentials (default: `Booking_api`).

4. **Start the server:**
   ```sh
   node server.js
   ```
   The app will run at [http://localhost:3000](http://localhost:3000)

---

## Payment Flow Overview

1. **Frontend** collects payment details and sends them to `/api/pay`.
2. **Backend**:
   - Reads your public key and merchant name, calls `/api/Key` to get a `kid`.
   - Reads your private key, calls `/api/CreateJWT` with the `kid` to get a JWT.
   - Generates a GUID for `MdOrder` (order ID).
   - Calls `/api/PaymentAPI/process-payment` with payment details and JWT.
   - Returns the payment result to the frontend.
3. **Frontend** displays the result to the user.

---

## Environment Variables (Optional)
You can set the following environment variables for additional configuration:
- `TALY_API_KEY` and `TALY_API_SECRET` (if required by your flow)

---

## Testing
- Open [http://localhost:3000](http://localhost:3000) in your browser.
- Fill in the payment form and submit.
- The result will be displayed below the form.
- You can also test the `/api/pay` endpoint using Postman with a JSON body:
  ```json
  {
    "amount": "100",
    "cardNumber": "4111111111111111",
    "expiry": "12/26",
    "cvv": "123"
  }
  ```

---

## Notes & Limitations
- The current flow generates a random GUID for `MdOrder`. For real payments, you must use a valid order ID as required by the EPG system.
- The backend always returns JSON, even on error, for robust frontend handling.
- Do **not** commit your private/public keys to a public repository.

---

## License
This project is for demonstration and integration purposes only. 