# GlobalTools International

GlobalTools International is the English-first edition of GlobalTools for international users.

It will include free browser tools, digital spreadsheet products, multilingual navigation, USD pricing and Stripe Checkout.

## Development

- Node.js 18+
- Start command: `npm start`
- Main application: `gateway.js`
- Application server: `server.js`

## Configuration

Create an environment file from `.env.example` and configure the required Stripe and application secrets in the deployment platform. Never commit real API keys or production secrets.

## Deployment

Deploy the repository to a Node.js VPS or container host. Set the start command to `npm start` and configure the environment variables before enabling checkout.
