-- Cached search API: one row per (source, query).
--
-- The Worker also creates this table lazily on the first search, so a fresh
-- database works without a manual step; this migration is the clean path and the
-- source of truth for the schema.
CREATE TABLE IF NOT EXISTS video_search_cache (
  source      TEXT NOT NULL,
  query       TEXT NOT NULL,
  payload     TEXT NOT NULL,
  videos      INTEGER NOT NULL DEFAULT 0,
  fetched_at  INTEGER NOT NULL,
  PRIMARY KEY (source, query)
);

-- Serve the "what is cached for this query" lookup cheaply.
CREATE INDEX IF NOT EXISTS idx_video_search_cache_fetched_at
  ON video_search_cache (fetched_at);
