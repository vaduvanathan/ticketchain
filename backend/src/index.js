require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Avalanche, BinTools, Buffer } = require('avalanche');

const app = express();
const port = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Avalanche setup (example config for Fuji testnet)
const avalanche = new Avalanche('api.avax-test.network', 443, 'https');
const bintools = BinTools.getInstance();

app.use(express.json());

// Simple ping route to test server
app.get('/ping', (req, res) => {
  res.send('Ticketchain backend is live!');
});

// Sample route to get users from Supabase
app.get('/users', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

