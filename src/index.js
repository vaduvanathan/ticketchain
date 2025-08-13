require('dotenv').config();
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple ping route to test server
app.get('/ping', (req, res) => {
  res.send('Ticketchain backend is live!');
});

// Placeholder for Google Sheets integration
// TODO: Integrate with Google Sheets service for user and event management
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Ready for Google Sheets + Ethereum integration',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Note: For full functionality, use the backend server in ./backend/');
});
