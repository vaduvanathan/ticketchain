const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

class SheetsServiceFile {
  constructor() {
    this.initialized = false;
    this.filePath = path.join(__dirname, '..', 'data', 'db.json');
    this.state = {
      users: [],
      events: [],
      event_participants: [],
      feedback: [],
      credit_log: []
    };
  }

  async initialize() {
    if (this.initialized) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.filePath)) {
      try { this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8')); } catch (_) {}
    } else {
      this._save();
    }
    this.initialized = true;
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  generateId() { return randomUUID(); }
  rowToObject(row) { return row; }

  // Users
  async addUser(userData) {
    await this.initialize();
    const now = new Date().toISOString();
    const user = {
      id: this.generateId(),
      wallet_address: userData.wallet_address,
      email: userData.email || '',
      name: userData.name || '',
      credit_score: 100,
      created_at: now,
      updated_at: now
    };
    this.state.users.push(user);
    this._save();
    return user;
  }

  async getUserByWallet(walletAddress) {
    await this.initialize();
    return this.state.users.find(u => u.wallet_address === walletAddress) || null;
  }

  async getUserCreditHistory(walletAddress) {
    await this.initialize();
    const user = await this.getUserByWallet(walletAddress);
    if (!user) return [];
    return this.state.credit_log.filter(c => c.user_id === user.id || c.user_id === walletAddress);
  }

  async updateUserCredits(userId, newScore, reason) {
    await this.initialize();
    const user = this.state.users.find(u => u.id === userId || u.wallet_address === userId);
    if (!user) throw new Error('User not found');
    const oldScore = Number(user.credit_score) || 100;
    user.credit_score = newScore;
    user.updated_at = new Date().toISOString();
    await this.logCreditChange(user.id, null, 'credit_update', newScore - oldScore, reason);
    this._save();
    return { oldScore, newScore, change: newScore - oldScore };
  }

  // Events
  async createEvent(eventData) {
    await this.initialize();
    const event = {
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
    this.state.events.push(event);
    this._save();
    return event;
  }

  async getEvent(eventId) {
    await this.initialize();
    return this.state.events.find(e => e.id === eventId) || null;
  }

  async getAllEvents() {
    await this.initialize();
    return [...this.state.events].sort((a,b) => (a.created_at < b.created_at ? 1 : -1));
  }

  // Participants
  async registerParticipant(eventId, userId, status = 'pending') {
    await this.initialize();
    const participation = {
      id: this.generateId(),
      event_id: eventId,
      user_id: userId,
      registration_time: new Date().toISOString(),
      check_in_time: null,
      check_out_time: null,
      attendance_status: status,
      punctuality_score: 0
    };
    this.state.event_participants.push(participation);
    this._save();
    return participation;
  }

  async updateParticipantStatus(eventId, userId, status) {
    await this.initialize();
    const p = this.state.event_participants.find(x => x.event_id === eventId && x.user_id === userId);
    if (!p) throw new Error('Participation not found');
    p.attendance_status = status;
    this._save();
    return p;
  }

  async getPendingParticipants(eventId) {
    await this.initialize();
    return this.state.event_participants.filter(p => p.event_id === eventId && p.attendance_status === 'pending');
  }

  async getEventParticipants(eventId) {
    await this.initialize();
    return this.state.event_participants.filter(p => p.event_id === eventId);
  }

  async getUserAttendingEvents(walletAddress) {
    await this.initialize();
    const mine = this.state.event_participants.filter(p => p.user_id === walletAddress);
    return mine.map(p => {
      const ev = this.state.events.find(e => e.id === p.event_id);
      return ev ? { ...ev, participation_status: p.attendance_status, registration_time: p.registration_time } : null;
    }).filter(Boolean);
  }

  async getUserOrganizingEvents(walletAddress) {
    await this.initialize();
    return this.state.events.filter(e => e.organizer_id === walletAddress).sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
  }

  async checkInParticipant(eventId, userId, checkInTimeIso) {
    await this.initialize();
    const p = this.state.event_participants.find(x => x.event_id === eventId && x.user_id === userId);
    if (!p) throw new Error('Participation not found');
    const ev = await this.getEvent(eventId);
    if (!ev) throw new Error('Event not found');

    const checkInTime = checkInTimeIso ? new Date(checkInTimeIso).getTime() : Date.now();
    const eventTime = new Date(ev.date_time).getTime();

    let score = 0;
    if (checkInTime <= eventTime) score = 10; else if (checkInTime <= eventTime + 15 * 60 * 1000) score = 5; else score = -5;

    p.check_in_time = new Date(checkInTime).toISOString();
    p.attendance_status = 'checked_in';
    p.punctuality_score = score;

    await this.logCreditChange(userId, eventId, 'check_in', score, 'Punctuality score');
    this._save();
    return { minutesLate: Math.max(0, Math.round((checkInTime - eventTime) / 60000)), punctualityScore: score };
  }

  async addFeedback({ event_id, reviewer_id, reviewee_id, reviewee_type, rating, comment }) {
    await this.initialize();
    const item = {
      id: this.generateId(),
      event_id,
      reviewer_id,
      reviewee_id,
      reviewee_type,
      rating,
      comment: comment || '',
      created_at: new Date().toISOString()
    };
    this.state.feedback.push(item);
    this._save();
    return item;
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
    this.state.credit_log.push(row);
    this._save();
    return row;
  }
}

module.exports = SheetsServiceFile;