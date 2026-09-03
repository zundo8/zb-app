-- AlterTable: Add updatedAt index to Cart sessions and covering index to AnalyticsEvent
CREATE INDEX IF NOT EXISTS "cart_sessions_updated_at_idx"
  ON "cart_sessions" ("updated_at" DESC);

CREATE INDEX IF NOT EXISTS "analytics_events_event_prod_created_idx"
  ON "analytics_events" ("event_name", "created_at", "product_id");
