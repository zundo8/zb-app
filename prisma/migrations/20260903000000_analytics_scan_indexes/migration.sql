-- AlterTable: Add covering indexes for analytics scan-heavy queries
-- These indexes front the date range filter so the planner scans only the
-- date-windowed subset before applying LIKE/ILIKE classification.

-- AnalyticsSession: speeds traffic source classification (ILIKE on utm_source)
CREATE INDEX IF NOT EXISTS "analytics_sessions_started_at_utm_source_idx"
  ON "analytics_sessions" ("started_at", "utm_source");

-- AnalyticsSession: speeds location country queries
CREATE INDEX IF NOT EXISTS "analytics_sessions_started_at_country_idx"
  ON "analytics_sessions" ("started_at", "country");

-- AnalyticsSession: speeds location country_code queries
CREATE INDEX IF NOT EXISTS "analytics_sessions_started_at_country_code_idx"
  ON "analytics_sessions" ("started_at", "country_code");

-- AnalyticsEvent: speeds per-session event rollup CTE in traffic route
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_event_name_idx"
  ON "analytics_events" ("session_id", "event_name");
