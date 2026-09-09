CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_note TEXT,
  requester_token TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_requester
ON leave_requests(requester_token);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status
ON leave_requests(status);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  requester_token TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  distance_m REAL NOT NULL,

  UNIQUE(date, requester_token)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user
ON checkins(requester_token);

CREATE INDEX IF NOT EXISTS idx_checkins_date
ON checkins(date);
