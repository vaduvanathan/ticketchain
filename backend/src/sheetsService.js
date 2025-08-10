const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');

class SheetsService {
    constructor() {
        this.doc = null;
        this.sheets = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load service account credentials
            const credentialsPath = path.join(__dirname, '../credentials.json');
            const serviceAccountAuth = new JWT({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            // Initialize the sheet document
            const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'; // Example sheet ID
            this.doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

            await this.doc.loadInfo();
            console.log(`Connected to sheet: ${this.doc.title}`);

            // Initialize or get existing sheets
            await this.initializeSheets();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets:', error);
            throw error;
        }
    }

    async initializeSheets() {
        const sheetConfigs = [
            {
                name: 'users',
                headers: ['id', 'wallet_address', 'email', 'name', 'credit_score', 'created_at', 'updated_at']
            },
            {
                name: 'events',
                headers: ['id', 'title', 'description', 'location', 'date_time', 'max_attendees', 'organizer_id', 'status', 'created_at']
            },
            {
                name: 'event_speakers',
                headers: ['id', 'event_id', 'speaker_id', 'role', 'created_at']
            },
            {
                name: 'event_participants',
                headers: ['id', 'event_id', 'user_id', 'registration_time', 'check_in_time', 'check_out_time', 'attendance_status', 'punctuality_score']
            },
            {
                name: 'feedback',
                headers: ['id', 'event_id', 'reviewer_id', 'reviewee_id', 'reviewee_type', 'rating', 'comment', 'created_at']
            },
            {
                name: 'credit_log',
                headers: ['id', 'user_id', 'event_id', 'action', 'points_change', 'reason', 'transaction_hash', 'created_at']
            }
        ];

        for (const config of sheetConfigs) {
            let sheet = this.doc.sheetsByTitle[config.name];
            
            if (!sheet) {
                // Create new sheet
                sheet = await this.doc.addSheet({
                    title: config.name,
                    headerValues: config.headers
                });
                console.log(`Created sheet: ${config.name}`);
            } else {
                // Load existing sheet
                await sheet.loadHeaderRow();
                console.log(`Loaded existing sheet: ${config.name}`);
            }
            
            this.sheets[config.name] = sheet;
        }
    }

    // User management functions
    async addUser(userData) {
        await this.initialize();
        const sheet = this.sheets.users;
        
        const newUser = {
            id: this.generateId(),
            wallet_address: userData.wallet_address,
            email: userData.email || '',
            name: userData.name || '',
            credit_score: 100, // Starting credit score
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const row = await sheet.addRow(newUser);
        return { ...newUser, rowIndex: row.rowIndex };
    }

    async getUserByWallet(walletAddress) {
        await this.initialize();
        const sheet = this.sheets.users;
        const rows = await sheet.getRows();
        
        const user = rows.find(row => row.get('wallet_address') === walletAddress);
        return user ? this.rowToObject(user) : null;
    }

    async updateUserCredits(userId, newScore, reason) {
        await this.initialize();
        const sheet = this.sheets.users;
        const rows = await sheet.getRows();
        
        // Use wallet_address as the identifier, since other calls pass wallet addresses
        const userRow = rows.find(row => row.get('wallet_address') === userId || row.get('id') === userId);
        if (!userRow) throw new Error('User not found');
        
        const oldScore = parseInt(userRow.get('credit_score'));
        userRow.set('credit_score', newScore);
        userRow.set('updated_at', new Date().toISOString());
        await userRow.save();

        // Log the credit change
        await this.logCreditChange(userId, null, 'credit_update', newScore - oldScore, reason);
        
        return { oldScore, newScore, change: newScore - oldScore };
    }

    // Event management functions
    async createEvent(eventData) {
        await this.initialize();
        const sheet = this.sheets.events;
        
        const newEvent = {
            id: this.generateId(),
            title: eventData.title,
            description: eventData.description || '',
            location: eventData.location || '',
            date_time: eventData.date_time,
            max_attendees: eventData.max_attendees || 0,
            organizer_id: eventData.organizer_id,
            status: 'upcoming',
            created_at: new Date().toISOString()
        };

        const row = await sheet.addRow(newEvent);
        return { ...newEvent, rowIndex: row.rowIndex };
    }

    async getEvent(eventId) {
        await this.initialize();
        const sheet = this.sheets.events;
        const rows = await sheet.getRows();
        
        const event = rows.find(row => row.get('id') === eventId);
        return event ? this.rowToObject(event) : null;
    }

    async getAllEvents() {
        await this.initialize();
        const sheet = this.sheets.events;
        const rows = await sheet.getRows();
        
        return rows.map(row => this.rowToObject(row));
    }

    // Participant management functions
    async registerParticipant(eventId, userId) {
        await this.initialize();
        const sheet = this.sheets.event_participants;
        
        const participation = {
            id: this.generateId(),
            event_id: eventId,
            user_id: userId,
            registration_time: new Date().toISOString(),
            check_in_time: '',
            check_out_time: '',
            attendance_status: 'registered',
            punctuality_score: 0
        };

        const row = await sheet.addRow(participation);
        return { ...participation, rowIndex: row.rowIndex };
    }

    async checkInParticipant(eventId, userId, checkInTime = null) {
        await this.initialize();
        const sheet = this.sheets.event_participants;
        const rows = await sheet.getRows();
        
        const participantRow = rows.find(row => 
            row.get('event_id') === eventId && row.get('user_id') === userId
        );
        
        if (!participantRow) throw new Error('Participant not registered for this event');
        
        const actualCheckInTime = checkInTime || new Date().toISOString();
        participantRow.set('check_in_time', actualCheckInTime);
        participantRow.set('attendance_status', 'checked_in');
        
        // Calculate punctuality score
        const event = await this.getEvent(eventId);
        const eventTime = new Date(event.date_time);
        const checkInDateTime = new Date(actualCheckInTime);
        const minutesLate = (checkInDateTime - eventTime) / (1000 * 60);
        
        let punctualityScore = 0;
        if (minutesLate <= 0) {
            punctualityScore = 10; // On time or early
        } else if (minutesLate <= 15) {
            punctualityScore = 5; // Up to 15 minutes late
        } else {
            punctualityScore = -5; // More than 15 minutes late
        }
        
        participantRow.set('punctuality_score', punctualityScore);
        await participantRow.save();

        // Update user credit score
        const user = await this.getUserByWallet(userId);
        if (user) {
            const newScore = parseInt(user.credit_score) + punctualityScore;
            await this.updateUserCredits(userId, newScore, `Check-in punctuality: ${minutesLate > 0 ? `${Math.round(minutesLate)} min late` : 'on time'}`);
        }

        return { punctualityScore, minutesLate };
    }

    async getEventParticipants(eventId) {
        await this.initialize();
        const sheet = this.sheets.event_participants;
        const rows = await sheet.getRows();
        
        const participants = rows.filter(row => row.get('event_id') === eventId);
        return participants.map(row => this.rowToObject(row));
    }

    // Feedback functions
    async addFeedback(feedbackData) {
        await this.initialize();
        const sheet = this.sheets.feedback;
        
        const feedback = {
            id: this.generateId(),
            event_id: feedbackData.event_id,
            reviewer_id: feedbackData.reviewer_id,
            reviewee_id: feedbackData.reviewee_id,
            reviewee_type: feedbackData.reviewee_type, // 'organizer' or 'speaker'
            rating: feedbackData.rating,
            comment: feedbackData.comment || '',
            created_at: new Date().toISOString()
        };

        const row = await sheet.addRow(feedback);
        
        // Award points for giving feedback
        const reviewer = await this.getUserByWallet(feedbackData.reviewer_id);
        if (reviewer) {
            const newScore = parseInt(reviewer.credit_score) + 2;
            await this.updateUserCredits(feedbackData.reviewer_id, newScore, 'Provided event feedback');
        }

        // Check if reviewee gets bonus for high rating
        if (feedbackData.rating >= 4) {
            const reviewee = await this.getUserByWallet(feedbackData.reviewee_id);
            if (reviewee) {
                const newScore = parseInt(reviewee.credit_score) + 5;
                await this.updateUserCredits(feedbackData.reviewee_id, newScore, `High rating (${feedbackData.rating}/5) as ${feedbackData.reviewee_type}`);
            }
        }

        return { ...feedback, rowIndex: row.rowIndex };
    }

    // Credit logging
    async logCreditChange(userId, eventId, action, pointsChange, reason, transactionHash = '') {
        await this.initialize();
        const sheet = this.sheets.credit_log;
        
        const logEntry = {
            id: this.generateId(),
            user_id: userId,
            event_id: eventId || '',
            action: action,
            points_change: pointsChange,
            reason: reason,
            transaction_hash: transactionHash,
            created_at: new Date().toISOString()
        };

        const row = await sheet.addRow(logEntry);
        return { ...logEntry, rowIndex: row.rowIndex };
    }

    async getUserCreditHistory(userId) {
        await this.initialize();
        const sheet = this.sheets.credit_log;
        const rows = await sheet.getRows();
        
        const history = rows.filter(row => row.get('user_id') === userId);
        return history.map(row => this.rowToObject(row));
    }

    // Utility functions
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    rowToObject(row) {
        const obj = {};
        for (const header of row._sheet.headerValues) {
            obj[header] = row.get(header);
        }
        return obj;
    }
}

module.exports = SheetsService;
