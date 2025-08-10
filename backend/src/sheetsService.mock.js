class SheetsServiceMock {
  constructor() {
    this.initialized = false;
    this.users = [];
    this.events = [];
    this.participants = [];
    this.feedback = [];
    this.creditLog = [];
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  generateId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  rowToObject(row) { return row; }

  // Users
  async addUser(userData) {
    await this.initialize();
    const user = {
      id: this.generateId(),
      wallet_address: userData.wallet_address,
      email: userData.email || '',
      name: userData.name || '',
      credit_score: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.users.push(user);
    return user;
  }

  async getUserByWallet(walletAddress) {
    await this.initialize();
    return this.users.find(u => u.wallet_address === walletAddress) || null;
  }

  async getUserCreditHistory(walletAddress) {
    await this.initialize();
    const user = await this.getUserByWallet(walletAddress);
    if (!user) return [];
    return this.creditLog.filter(c => c.user_id === user.id || c.user_id === walletAddress);
  }

  async updateUserCredits(userId, newScore, reason) {
    await this.initialize();
    const user = this.users.find(u => u.id === userId || u.wallet_address === userId);
    if (!user) throw new Error('User not found');
    const oldScore = Number(user.credit_score) || 100;
    user.credit_score = newScore;
    user.updated_at = new Date().toISOString();
    await this.logCreditChange(user.id, null, 'credit_update', newScore - oldScore, reason);
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
    this.events.push(event);
    return event;
  }

  async getEvent(eventId) {
    await this.initialize();
    return this.events.find(e => e.id === eventId) || null;
  }

  async getAllEvents() {
    await this.initialize();
    return [...this.events];
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
    this.participants.push(participation);
    return participation;
  }

  async updateParticipantStatus(eventId, userId, status) {
    await this.initialize();
    const p = this.participants.find(x => x.event_id === eventId && x.user_id === userId);
    if (!p) throw new Error('Participation not found');
    p.attendance_status = status;
    return p;
  }

  async getPendingParticipants(eventId) {
    await this.initialize();
    return this.participants.filter(p => p.event_id === eventId && p.attendance_status === 'pending');
  }

  async getEventParticipants(eventId) {
    await this.initialize();
    return this.participants.filter(p => p.event_id === eventId);
  }

  async getUserAttendingEvents(walletAddress) {
    await this.initialize();
    const mine = this.participants.filter(p => p.user_id === walletAddress);
    return mine.map(p => {
      const ev = this.events.find(e => e.id === p.event_id);
      return ev ? {
        ...ev,
        participation_status: p.attendance_status,
        registration_time: p.registration_time
      } : null;
    }).filter(Boolean);
  }

  async getUserOrganizingEvents(walletAddress) {
    await this.initialize();
    return this.events.filter(e => e.organizer_id === walletAddress);
  }

  async checkInParticipant(eventId, userId, checkInTimeIso) {
    await this.initialize();
    const p = this.participants.find(x => x.event_id === eventId && x.user_id === userId);
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

    // Optionally update credit log for userId (wallet)
    await this.logCreditChange(userId, eventId, 'check_in', score, 'Punctuality score');

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
    this.feedback.push(item);
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
    this.creditLog.push(row);
    return row;
  }
}

module.exports = SheetsServiceMock;