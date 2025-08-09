#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🎫 TicketChain Setup Script\n');

// Check if we're in the right directory
if (!fs.existsSync('backend/package.json')) {
    console.error('❌ Please run this script from the project root directory');
    process.exit(1);
}

// Install backend dependencies
console.log('📦 Installing backend dependencies...');
try {
    execSync('cd backend && npm install', { stdio: 'inherit' });
    console.log('✅ Backend dependencies installed\n');
} catch (error) {
    console.error('❌ Failed to install backend dependencies');
    process.exit(1);
}

// Check for credentials file
if (!fs.existsSync('backend/credentials.json')) {
    console.log('⚠️  Google Sheets credentials not found!');
    console.log('📋 Please follow these steps:');
    console.log('   1. Go to https://console.cloud.google.com/');
    console.log('   2. Create a new project or select existing');
    console.log('   3. Enable Google Sheets API');
    console.log('   4. Create service account credentials');
    console.log('   5. Download JSON file as backend/credentials.json\n');
}

// Create .env file if it doesn't exist
if (!fs.existsSync('backend/.env')) {
    console.log('📝 Creating environment file...');
    
    const envContent = `# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id_here

# Server Configuration
PORT=3000

# Blockchain Configuration (Optional)
ETHEREUM_NETWORK=sepolia
PRIVATE_KEY=your_private_key_here
CONTRACT_ADDRESS=your_deployed_contract_address_here
`;
    
    fs.writeFileSync('backend/.env', envContent);
    console.log('✅ Created backend/.env file');
    console.log('📝 Please edit backend/.env with your configuration\n');
}

// Check if Google Sheet ID is configured
const envPath = 'backend/.env';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('your_google_sheet_id_here')) {
        console.log('⚠️  Please update GOOGLE_SHEET_ID in backend/.env');
    }
}

console.log('🚀 Setup complete! Next steps:');
console.log('   1. Configure backend/.env with your Google Sheet ID');
console.log('   2. Add backend/credentials.json (Google service account)');
console.log('   3. Run: cd backend && npm start');
console.log('   4. Open frontend/index.html in your browser');
console.log('\n📚 See README.md for detailed instructions');
console.log('\n🎉 Happy coding!');
