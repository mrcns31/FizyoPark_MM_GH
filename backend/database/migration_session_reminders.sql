CREATE TABLE IF NOT EXISTS session_reminders (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  reminder_type VARCHAR(20) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, reminder_type)
);
