#!/usr/bin/env bash
# Drop ONE demo doc into the real kajota-mobile.cosell_products collection
# to fire the live Atlas Trigger -> /api/ingest -> Aurora.
#
#   bash scripts/demo-cosell-insert.sh           # insert the demo doc
#   bash scripts/demo-cosell-insert.sh --clean   # remove all _pulseDemo docs
#
# Reads MONGODB_URI from the backend .env so no secret is typed here.
set -euo pipefail

ENV_FILE="${KAJOTA_BACKEND_ENV:-/Users/oluwaboriola/Documents/kajota-mobile-backend/.env}"
MONGODB_URI=$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^["'"'"']//; s/["'"'"']$//')

if [[ "${1:-}" == "--clean" ]]; then
  mongosh "$MONGODB_URI" --quiet --eval '
    const db = db.getSiblingDB("kajota-mobile");
    const r = db.cosell_products.deleteMany({ _pulseDemo: true });
    print("DELETED _pulseDemo docs: " + r.deletedCount);
  '
  exit 0
fi

mongosh "$MONGODB_URI" --quiet --eval '
  const db = db.getSiblingDB("kajota-mobile");
  const uniq = new ObjectId().toString();
  const doc = {
    productId: "p_pulse_demo_" + uniq,   // handler -> product_id in Aurora
    userId: "seller_pulse_demo",         // handler -> seller_id in Aurora
    product_id: uniq,                    // unique idx: {product_id, store_id}
    store_id: "store_pulse_demo_" + uniq,
    referral_code: "PULSEDEMO_" + uniq,  // unique idx: referral_code
    markupPercentage: 27.5,
    markedUpPrice: 12750,
    isActive: true,
    _pulseDemo: true,                    // tag so --clean can find it
    createdAt: new Date()
  };
  const r = db.cosell_products.insertOne(doc);
  print("INSERTED_ID=" + r.insertedId.toString());
  print("seller_id that should appear in Aurora: " + doc.userId);
'
