
require('dotenv').config();
console.log('GOOGLE_SHEET_ID:', process.env.GOOGLE_SHEET_ID ? 'Loaded' : 'Missing');

const express = require('express');
const cors = require('cors');
const SheetsService = require('./sheetsService');
const BlockchainService = require('./blockchainService');

const app = express();
const port = process.env.PORT || 3000;

const sheetsService = new SheetsService();
const blockchainService = new BlockchainService();

app.use(express.json());
app.use(cors());

// Simple ping route
app.get('/ping', (req, res) => {
  res.send('Ticketchain backend with Google Sheets is live!');
});

// User routes
app.post('/users', async (req, res) => {
  try {
    const { wallet_address, email, name } = req.body;
    
    if (!wallet_address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Check if user already exists
    const existingUser = await sheetsService.getUserByWallet(wallet_address);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await sheetsService.addUser({ wallet_address, email, name });
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:wallet_address', async (req, res) => {
  try {
    const user = await sheetsService.getUserByWallet(req.params.wallet_address);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:wallet_address/credits', async (req, res) => {
  try {
    const history = await sheetsService.getUserCreditHistory(req.params.wallet_address);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event routes
app.post('/events', async (req, res) => {
  try {
    const { title, description, location, date_time, max_attendees, organizer_id, use_blockchain } = req.body;

    if (!title || !date_time || !organizer_id) {
      return res.status(400).json({ error: 'Missing required fields: title, date_time, organizer_id' });
    }

    // Create event in Google Sheets
    const event = await sheetsService.createEvent({
      title,
      description,
      location,
      date_time,
      max_attendees,
      organizer_id
    });

    let blockchainResult = null;
    
    // Optionally register on blockchain
    if (use_blockchain && process.env.CONTRACT_ADDRESS && process.env.PRIVATE_KEY) {
      try {
        blockchainResult = await blockchainService.registerEvent(
          title,
          location || '',
          date_time
        );
        
        // Log blockchain transaction
        await sheetsService.logCreditChange(
          organizer_id,
          event.id,
          'event_registered',
          0,
          'Event registered on blockchain',
          blockchainResult.transactionHash
        );
      } catch (blockchainError) {
        console.error('Blockchain registration failed:', blockchainError);
        // Continue without blockchain - event is still created in Sheets
      }
    }

    res.status(201).json({ 
      event,
      blockchain: blockchainResult ? {
        registered: true,
        transactionHash: blockchainResult.transactionHash,
        blockchainEventId: blockchainResult.eventId
      } : { registered: false }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/events', async (req, res) => {
  try {
    const events = await sheetsService.getAllEvents();
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/events/:event_id', async (req, res) => {
  try {
    const event = await sheetsService.getEvent(req.params.event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Participant routes
app.post('/events/:event_id/register', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const participation = await sheetsService.registerParticipant(req.params.event_id, user_id);
    res.status(201).json({ participation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/events/:event_id/checkin', async (req, res) => {
  try {
    const { user_id, check_in_time, use_blockchain } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check in via Google Sheets
    const result = await sheetsService.checkInParticipant(req.params.event_id, user_id, check_in_time);
    
    let blockchainResult = null;
    
    // Optionally record on blockchain
    if (use_blockchain && process.env.CONTRACT_ADDRESS && process.env.PRIVATE_KEY) {
      try {
        // For blockchain, we need the actual wallet address, not the user_id
        const user = await sheetsService.getUserByWallet(user_id);
        if (user && user.wallet_address) {
          blockchainResult = await blockchainService.checkInParticipant(
            req.params.event_id, 
            user.wallet_address
          );
          
          // Log blockchain transaction
          await sheetsService.logCreditChange(
            user_id,
            req.params.event_id,
            'blockchain_checkin',
            0,
            'Check-in recorded on blockchain',
            blockchainResult.transactionHash
          );
        }
      } catch (blockchainError) {
        console.error('Blockchain check-in failed:', blockchainError);
        // Continue without blockchain - check-in is still recorded in Sheets
      }
    }

    res.json({ 
      message: 'Check-in successful',
      punctuality_score: result.punctualityScore,
      minutes_late: result.minutesLate,
      blockchain: blockchainResult ? {
        recorded: true,
        transactionHash: blockchainResult.transactionHash
      } : { recorded: false }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/events/:event_id/participants', async (req, res) => {
  try {
    const participants = await sheetsService.getEventParticipants(req.params.event_id);
    res.json({ participants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Feedback routes
app.post('/feedback', async (req, res) => {
  try {
    const { event_id, reviewer_id, reviewee_id, reviewee_type, rating, comment } = req.body;
    
    if (!event_id || !reviewer_id || !reviewee_id || !reviewee_type || !rating) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const feedback = await sheetsService.addFeedback({
      event_id,
      reviewer_id,
      reviewee_id,
      reviewee_type,
      rating,
      comment
    });

    res.status(201).json({ feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Blockchain-specific routes
app.get('/blockchain/status', async (req, res) => {
  try {
    const isAvailable = !!(process.env.CONTRACT_ADDRESS && process.env.PRIVATE_KEY);
    res.json({ 
      blockchain_available: isAvailable,
      contract_address: process.env.CONTRACT_ADDRESS || null,
      network: process.env.ETHEREUM_NETWORK || 'sepolia'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/blockchain/users/:wallet_address/score', async (req, res) => {
  try {
    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(503).json({ error: 'Blockchain service not available' });
    }

    const score = await blockchainService.getCreditScore(req.params.wallet_address);
    res.json({ 
      wallet_address: req.params.wallet_address,
      blockchain_score: score 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/blockchain/events/:event_id', async (req, res) => {
  try {
    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(503).json({ error: 'Blockchain service not available' });
    }

    const event = await blockchainService.getEvent(req.params.event_id);
    res.json({ blockchain_event: event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Development/Testing route to create sample data
app.post('/dev/sample-data', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    // Create sample user
    const sampleUser = await sheetsService.addUser({
      wallet_address: '0x1234567890123456789012345678901234567890',
      email: 'test@example.com',
      name: 'Test User'
    });

    // Create sample event
    const sampleEvent = await sheetsService.createEvent({
      title: 'Sample Web3 Conference',
      description: 'A test event for the ticketing system',
      location: 'Virtual',
      date_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      max_attendees: 100,
      organizer_id: sampleUser.wallet_address
    });

    res.json({
      message: 'Sample data created',
      user: sampleUser,
      event: sampleEvent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move listen to end, after all routes defined
app.listen(port, () => {
  console.log(`TicketChain backend running on port ${port}`);
  console.log(`Blockchain integration: ${process.env.CONTRACT_ADDRESS ? 'Enabled' : 'Disabled'}`);
});
