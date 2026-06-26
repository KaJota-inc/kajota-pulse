/**
 * Atlas Database Trigger function — POSTs change events to Pulse.
 *
 * Paste this as the function body for THREE triggers (one per
 * collection: products, cosellproducts, orders) in
 * Atlas → Triggers → Add Trigger → Database → Event Type: Function.
 *
 * Configure each trigger:
 *   - Cluster:        the production Kajota cluster
 *   - Database:       kajota
 *   - Collection:     products | cosellproducts | orders   (one each)
 *   - Operation Type: Insert, Update, Replace  (tick all three)
 *   - Full Document:  ON  (so updates carry fullDocument)
 *
 * Store the shared secret in Atlas → App Services → Values as
 * `PulseIngestSecret`, and set the SAME value as PULSE_INGEST_SECRET in
 * Vercel's env. The Pulse /api/ingest route rejects any request whose
 * X-Pulse-Ingest-Secret header doesn't match.
 */
exports = async function (changeEvent) {
  const url = "https://kajota-pulse.vercel.app/api/ingest";
  try {
    const res = await context.http.post({
      url,
      headers: {
        "Content-Type": ["application/json"],
        "X-Pulse-Ingest-Secret": [context.values.get("PulseIngestSecret")],
      },
      body: changeEvent,
      encodeBodyAsJSON: true,
    });
    // 2xx = handled. Log non-2xx for visibility in the Trigger logs.
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.error(
        "Pulse ingest non-2xx",
        res.statusCode,
        res.body.text().slice(0, 200)
      );
    }
  } catch (err) {
    // Never throw — a failed POST shouldn't block the Mongo write or
    // wedge the trigger queue.
    console.error("Pulse ingest POST failed", err.message);
  }
};
