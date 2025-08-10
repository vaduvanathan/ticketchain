# 🎫 TicketChain - Web3 Event Management System

A decentralized ticketing system with credit scores for event attendees, organizers, and speakers. Built with Google Sheets as the primary database and blockchain for tamper-proof records.

## 🚀 Features

- **Event Management**: Create and manage events with detailed information
- **Credit Score System**: Dynamic scoring based on punctuality and feedback
- **Blockchain Integration**: Tamper-proof attendance records on Ethereum
- **Google Sheets Backend**: Easy-to-view data storage and management
- **MetaMask Integration**: Seamless Web3 wallet connectivity
- **Dual Storage**: Google Sheets for convenience + Blockchain for security
- **Real-time Scoring**: Automatic credit adjustments based on behavior

## 📊 Credit Score Rules

- **On-time arrival**: +10 points
- **Late arrival (up to 15 min)**: +5 points  
- **Late arrival (15+ min)**: -5 points
- **Feedback submission**: +2 points
- **High rating received (4-5 stars)**: +5 bonus points

## 🏗️ Architecture

```
Frontend (HTML/JS) → Backend API (Node.js/Express) → Google Sheets + Blockchain
                                                   ↓
                                              Smart Contract (Solidity)
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v16+)
- MetaMask browser extension
- Google Cloud account (for Sheets API)
- Ethereum testnet access (Sepolia recommended)

### 1. Clone and Install

```bash
git clone https://github.com/vaduvanathan/ticketchain.git
cd ticketchain
cd backend
npm install
```

### 2. Google Sheets Setup

1. Create a new Google Sheet
2. Go to [Google Cloud Console](https://console.cloud.google.com/)
3. Create a new project or select existing
4. Enable Google Sheets API
5. Create service account credentials
6. Download credentials JSON file as `backend/credentials.json`
7. Share your Google Sheet with the service account email

### 3. Environment Configuration

Copy `backend/env.example` to `backend/.env`:

```bash
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id_here

# Server Configuration
PORT=3000

# Blockchain Configuration (Optional)
ETHEREUM_NETWORK=sepolia
PRIVATE_KEY=your_private_key_here
CONTRACT_ADDRESS=your_deployed_contract_address_here
```

### 4. Smart Contract Deployment (Optional)

1. Install [Remix IDE](https://remix.ethereum.org/)
2. Copy `contracts/TicketChain.sol` to Remix
3. Compile with Solidity 0.8.19+
4. Deploy to Sepolia testnet
5. Copy contract address to `.env`

### 5. Run the Application

```bash
# Start backend
cd backend
npm start

# Open frontend
# Open frontend/index.html in your browser
# Or serve with a local server:
npx http-server frontend -p 8080
```

## 🔧 API Endpoints

### Users
- `POST /users` - Register new user
- `GET /users/:wallet_address` - Get user profile
- `GET /users/:wallet_address/credits` - Get credit history

### Events
- `POST /events` - Create event
- `GET /events` - List all events
- `GET /events/:event_id` - Get event details
- `POST /events/:event_id/register` - Register for event
- `POST /events/:event_id/checkin` - Check into event
- `GET /events/:event_id/participants` - Get participants

### Feedback
- `POST /feedback` - Submit feedback

### Blockchain
- `GET /blockchain/status` - Check blockchain availability
- `GET /blockchain/users/:wallet_address/score` - Get on-chain credit score
- `GET /blockchain/events/:event_id` - Get on-chain event data

### Development
- `POST /dev/sample-data` - Create sample data (dev only)

## 🎯 Usage Flow

### For Event Organizers

1. **Connect MetaMask** and register your account
2. **Create Event** with title, location, date/time
3. **Optional**: Enable blockchain recording for tamper-proof records
4. **Share Event ID** with participants
5. **Check-in participants** during the event
6. **Receive feedback** and credit score bonuses

### For Attendees

1. **Connect MetaMask** and register your account
2. **Register for events** using Event ID
3. **Check-in on time** to earn maximum credit points
4. **Provide feedback** to earn additional points
5. **Track your credit score** over time

## 🔒 Security Features

- **Blockchain Immutability**: Attendance records can't be altered
- **Wallet Authentication**: Secure MetaMask-based login
- **Credit Score Transparency**: All score changes are logged
- **Dual Storage**: Data redundancy between Sheets and blockchain

## 🧪 Testing

### Sample Data Creation

```bash
curl -X POST http://localhost:3000/dev/sample-data
```

### Manual Testing Flow

1. Create a sample user and event
2. Register user for the event
3. Check-in the user (try different times to test punctuality)
4. Submit feedback
5. Check updated credit scores

## 📱 Frontend Features

- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Live credit score updates
- **MetaMask Integration**: Seamless wallet connection
- **Event Management**: Create and view events
- **Check-in System**: Easy event check-in process

## 🔮 Future Enhancements

- **NFT Tickets**: Issue NFTs as event tickets
- **DAO Governance**: Community voting on credit rules
- **Multi-chain Support**: Deploy on multiple blockchains
- **Mobile App**: React Native mobile application
- **Analytics Dashboard**: Event and user analytics
- **Reputation System**: Extended reputation beyond credit scores

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**MetaMask Connection Failed**
- Ensure MetaMask is installed and unlocked
- Switch to Sepolia testnet if using blockchain features

**Google Sheets Access Denied**
- Verify credentials.json is in backend folder
- Check that service account has access to the sheet
- Ensure Google Sheets API is enabled

**Contract Interaction Failed**
- Verify contract address in .env
- Ensure sufficient ETH for gas fees
- Check network configuration

**Backend Connection Error**
- Verify backend is running on port 3000
- Check CORS settings if accessing from different domain
- Ensure all environment variables are set

### Getting Help

- Check the [Issues](https://github.com/vaduvanathan/ticketchain/issues) page
- Join our community discussions
- Review the API documentation above

---

Built with ❤️ for the Web3 community. Star ⭐ this repo if you find it useful!

## Frontend mock pages (static)

Two lightweight static pages were added under `frontend/` to match the provided UI mockups:

- `frontend/home.html`: Hero welcome screen with red theme and CTAs
- `frontend/login.html`: Glassy registration/login form

Open them directly in a browser or serve the `frontend/` folder with any static server.

```bash
# from repo root
python3 -m http.server 8080 -d frontend
# then visit: http://localhost:8080/home.html or /login.html
```
