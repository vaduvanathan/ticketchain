const fetch = require('node-fetch');

async function createEvent() {
  try {
    const res = await fetch('http://localhost:3000/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hackathon',
        location: 'Chennai',
        date_time: '2025-09-01T10:00:00Z',
        max_attendees: 100,
        organizer_id: 1
      })
    });

    const data = await res.json();
    console.log('Response from server:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

createEvent();
