const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

class SheetsServiceSqlite {
  constructor() {
    this.initialized = false;
    this.db = null;
  }

  async initialize() {
    if (this.initialized) return;
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'ticketchain.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        wallet_address TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        credit_score INTEGER DEFAULT 100,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        date_time TEXT NOT NULL,
        max_attendees INTEGER DEFAULT 0,
        organizer_id TEXT NOT NULL,
        status TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS event_participants (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        registration_time TEXT,
        check_in_time TEXT,
        check_out_time TEXT,
        attendance_status TEXT,
        punctuality_score INTEGER
      );
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        reviewee_id TEXT NOT NULL,
        reviewee_type TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS credit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        event_id TEXT,
        action TEXT,
        points_change INTEGER,
        reason TEXT,
        transaction_hash TEXT,
        created_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
      CREATE INDEX IF NOT EXISTS idx_participants_event ON event_participants(event_id);
      CREATE INDEX IF NOT EXISTS idx_participants_user ON event_participants(user_id);
    `);

    this.initialized = true;
  }

  generateId() {
    return randomUUID();
  }

  rowToObject(row) {
    return row;
  }

  // Users
  async addUser(userData) {
    await this.initialize();
    const id = this.generateId();
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`INSERT INTO users (id, wallet_address, email, name, credit_score, created_at, updated_at)
      VALUES (@id, @wallet_address, @email, @name, @credit_score, @created_at, @updated_at)`);
    const user = {
      id,
      wallet_address: userData.wallet_address,
      email: userData.email || '',
      name: userData.name || '',
      credit_score: 100,
      created_at: now,
      updated_at: now
    };
    stmt.run(user);
    return user;
  }

  async getUserByWallet(walletAddress) {
    await this.initialize();
    const row = this.db.prepare('SELECT * FROM users WHERE wallet_address = ? LIMIT 1').get(walletAddress);
    return row || null;
  }

  async getUserCreditHistory(walletAddress) {
    await this.initialize();
    const user = await this.getUserByWallet(walletAddress);
    if (!user) return [];
    return this.db.prepare('SELECT * FROM credit_log WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  }

  async updateUserCredits(userId, newScore, reason) {
    await this.initialize();
    const user = this.db.prepare('SELECT * FROM users WHERE id = ? OR wallet_address = ?').get(userId, userId);
    if (!user) throw new Error('User not found');
    const oldScore = Number(user.credit_score) || 100;
    const now = new Date().toISOString();
    this.db.prepare('UPDATE users SET credit_score = ?, updated_at = ? WHERE id = ?').run(newScore, now, user.id);
    await this.logCreditChange(user.id, null, 'credit_update', newScore - oldScore, reason);
    return { oldScore, newScore, change: newScore - oldScore };
  }

  // Events
  async createEvent(eventData) {
    await this.initialize();
    const id = this.generateId();
    const now = new Date().toISOString();
    const event = {
      id,
      title: eventData.title,
      description: eventData.description || '',
      location: eventData.location || '',
      date_time: eventData.date_time,
      max_attendees: eventData.max_attendees || 0,
      organizer_id: eventData.organizer_id,
      status: 'upcoming',
      created_at: now
    };
    this.db.prepare(`INSERT INTO events (id, title, description, location, date_time, max_attendees, organizer_id, status, created_at)
      VALUES (@id, @title, @description, @location, @date_time, @max_attendees, @organizer_id, @status, @created_at)`).run(event);
    return event;
  }

  async getEvent(eventId) {
    await this.initialize();
    return this.db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) || null;
  }

  async getAllEvents() {
    await this.initialize();
    return this.db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
  }

  // Participants
  async registerParticipant(eventId, userId, status = 'pending') {
    await this.initialize();
    const id = this.generateId();
    const row = {
      id,
      event_id: eventId,
      user_id: userId,
      registration_time: new Date().toISOString(),
      check_in_time: null,
      check_out_time: null,
      attendance_status: status,
      punctuality_score: 0
    };
    this.db.prepare(`INSERT INTO event_participants (id, event_id, user_id, registration_time, check_in_time, check_out_time, attendance_status, punctuality_score)
      VALUES (@id, @event_id, @user_id, @registration_time, @check_in_time, @check_out_time, @attendance_status, @punctuality_score)`).run(row);
    return row;
  }

  async updateParticipantStatus(eventId, userId, status) {
    await this.initialize();
    this.db.prepare('UPDATE event_participants SET attendance_status = ? WHERE event_id = ? AND user_id = ?').run(status, eventId, userId);
    const row = this.db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?').get(eventId, userId);
    return row;
  }

  async getPendingParticipants(eventId) {
    await this.initialize();
    return this.db.prepare('SELECT * FROM event_participants WHERE event_id = ? AND attendance_status = "pending"').all(eventId);
  }

  async getEventParticipants(eventId) {
    await this.initialize();
    return this.db.prepare('SELECT * FROM event_participants WHERE event_id = ?').all(eventId);
  }

  async getUserAttendingEvents(walletAddress) {
    await this.initialize();
    const rows = this.db.prepare('SELECT * FROM event_participants WHERE user_id = ?').all(walletAddress);
    const events = [];
    for (const p of rows) {
      const ev = await this.getEvent(p.event_id);
      if (ev) {
        events.push({ ...ev, participation_status: p.attendance_status, registration_time: p.registration_time });
      }
    }
    return events;
  }

  async getUserOrganizingEvents(walletAddress) {
    await this.initialize();
    return this.db.prepare('SELECT * FROM events WHERE organizer_id = ? ORDER BY created_at DESC').all(walletAddress);
  }

  async checkInParticipant(eventId, userId, check_in_time) {
    await this.initialize();
    const ev = await this.getEvent(eventId);
    if (!ev) throw new Error('Event not found');
    const eventTime = new Date(ev.date_time).getTime();
    const nowMs = check_in_time ? new Date(check_in_time).getTime() : Date.now();
    let score = 0;
    if (nowMs <= eventTime) score = 10; else if (nowMs <= eventTime + 15 * 60 * 1000) score = 5; else score = -5;

    this.db.prepare('UPDATE event_participants SET check_in_time = ?, attendance_status = "checked_in", punctuality_score = ? WHERE event_id = ? AND user_id = ?')
      .run(new Date(nowMs).toISOString(), score, eventId, userId);

    await this.logCreditChange(userId, eventId, 'check_in', score, 'Punctuality score');

    return { minutesLate: Math.max(0, Math.round((nowMs - eventTime) / 60000)), punctualityScore: score };
  }

  async addFeedback({ event_id, reviewer_id, reviewee_id, reviewee_type, rating, comment }) {
    await this.initialize();
    const row = {
      id: this.generateId(),
      event_id,
      reviewer_id,
      reviewee_id,
      reviewee_type,
      rating,
      comment: comment || '',
      created_at: new Date().toISOString()
    };
    this.db.prepare(`INSERT INTO feedback (id, event_id, reviewer_id, reviewee_id, reviewee_type, rating, comment, created_at)
      VALUES (@id, @event_id, @reviewer_id, @reviewee_id, @reviewee_type, @rating, @comment, @created_at)`).run(row);
    return row;
  }

  async logCreditChange(user_id, event_id, action, points_change, reason, transaction_hash) {
    await this.initialize();
    const row = {
      id: this.generateId(),
      user_id,
      event_id,
      action,
      points_change: points_change || 0,
      reason: reason || '',
      transaction_hash: transaction_hash || '',
      created_at: new Date().toISOString()
    };
    this.db.prepare(`INSERT INTO credit_log (id, user_id, event_id, action, points_change, reason, transaction_hash, created_at)
      VALUES (@id, @user_id, @event_id, @action, @points_change, @reason, @transaction_hash, @created_at)`).run(row);
    return row;
  }
}

module.exports = SheetsServiceSqlite;