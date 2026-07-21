CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);

