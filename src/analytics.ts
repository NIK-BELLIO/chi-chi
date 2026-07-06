type AnalyticsEnv = { DB: D1Database };

const CREATE_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;

export async function ensureAnalytics(env: AnalyticsEnv): Promise<void> {
  await env.DB.prepare(CREATE_EVENTS_TABLE).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at)").run();
}

export async function trackEvent(
  env: AnalyticsEnv,
  eventType: string,
  profileId: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO analytics_events(id,profile_id,event_type,metadata) VALUES(?,?,?,?)",
    ).bind(crypto.randomUUID(), profileId, eventType, JSON.stringify(metadata)).run();
  } catch (error) {
    // Analytics must never break the product. The admin endpoint creates the
    // table automatically after the first deployment if migrations lag behind.
    console.warn("analytics event skipped", error instanceof Error ? error.message : String(error));
  }
}
