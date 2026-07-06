PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
  token_hash TEXT NOT NULL,
  intent TEXT NOT NULL CHECK(intent IN ('friendship','romantic','both')),
  is_adult INTEGER NOT NULL DEFAULT 0,
  discoverable INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tastes (
  profile_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('movie','food')),
  item TEXT NOT NULL COLLATE NOCASE,
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  PRIMARY KEY(profile_id, kind, item),
  FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS introductions (
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(sender_id, receiver_id),
  FOREIGN KEY(sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY(receiver_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tastes_lookup ON tastes(kind, item, score);
CREATE INDEX IF NOT EXISTS idx_introductions_receiver ON introductions(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_discovery ON profiles(discoverable, intent);
