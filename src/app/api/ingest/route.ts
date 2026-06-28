/**
 * POST /api/ingest — Atlas Trigger sink.
 *
 * The Kajota Mongo Atlas cluster has Database Triggers configured for
 * the `products`, `cosellproducts`, and `orders` collections. Each
 * trigger POSTs the full change-event document here. This route
 * decodes the event, translates Mongo fields to Pulse shapes, and
 * fans out to the right `lib/db.ts` writer.
 *
 * Auth: the Atlas Trigger is configured with a static header
 *   X-Pulse-Ingest-Secret: <PULSE_INGEST_SECRET>
 * which we verify on every request. No secret = HTTP 401, drop event.
 *
 * Always returns 200 with `{ok:true|false, ...}` even on internal
 * errors so Mongo doesn't retry indefinitely — the alternative is a
 * runaway loop when a single bad doc breaks ingestion.
 */
import { NextResponse } from 'next/server';

import {
  recordEngagement,
  recordPriceSnapshot,
  recordStockEvent,
  upsertCosellListing,
  upsertProduct,
} from '@/lib/db';

/** Subset of an Atlas Trigger change-event we care about. */
interface AtlasChangeEvent {
  operationType: 'insert' | 'update' | 'replace' | 'delete';
  ns: { db: string; coll: string };
  fullDocument?: Record<string, unknown>;
  documentKey?: { _id?: string };
}

export async function POST(request: Request): Promise<NextResponse> {
  // -- auth check --
  const expected = process.env.PULSE_INGEST_SECRET;
  const provided = request.headers.get('x-pulse-ingest-secret');
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // -- parse --
  let event: AtlasChangeEvent;
  try {
    event = (await request.json()) as AtlasChangeEvent;
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 200 });
  }
  if (!event?.ns?.coll) {
    return NextResponse.json({ ok: false, error: 'missing_ns' }, { status: 200 });
  }

  // -- route to the right handler by collection --
  try {
    switch (event.ns.coll) {
      case 'products':
        await handleProductEvent(event);
        return NextResponse.json({ ok: true, handled: 'product' });
      case 'cosellproducts':
        await handleCosellEvent(event);
        return NextResponse.json({ ok: true, handled: 'cosell' });
      case 'orders':
        await handleOrderEvent(event);
        return NextResponse.json({ ok: true, handled: 'order' });
      default:
        // Silently accept unknown collections — Atlas may add new
        // triggers ahead of code rollouts.
        return NextResponse.json({ ok: true, handled: 'ignored', coll: event.ns.coll });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown';
    // Log to Vercel + still return 200 so Atlas doesn't retry-storm.
    console.error('Pulse ingest error', { coll: event.ns.coll, op: event.operationType, message });
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}

/* ----------------------------------------------------------------- */
/*  Per-collection handlers                                          */
/* ----------------------------------------------------------------- */

async function handleProductEvent(event: AtlasChangeEvent): Promise<void> {
  const doc = event.fullDocument;
  if (!doc) return;
  const id = ejsonId(doc._id);
  if (!id) return;

  const name = String(doc.productName ?? doc.name ?? '');
  const price = ejsonNum(doc.price);
  const currency = String(doc.ccy ?? doc.currency ?? 'NGN');
  const categoryId = firstCategoryId(doc.categoryIds);
  const storeId = ejsonId(doc.storeId) || null;
  const stockStatus = normaliseStockStatus(doc.stockStatus);

  await upsertProduct({
    id,
    name,
    currency,
    price,
    categoryId,
    storeId,
    stockStatus,
  });
  if (price > 0) {
    await recordPriceSnapshot(id, price, currency);
  }
  if (stockStatus !== 'UNKNOWN') {
    await recordStockEvent(id, stockStatus);
  }
}

async function handleCosellEvent(event: AtlasChangeEvent): Promise<void> {
  const doc = event.fullDocument;
  if (!doc) return;
  const id = ejsonId(doc._id);
  if (!id) return;

  const productId = ejsonId(doc.productId);
  const sellerId = ejsonId(doc.userId) || ejsonId(doc.sellerId);

  await upsertCosellListing({
    id,
    productId,
    sellerId,
    markupPct: ejsonNum(doc.markupPercentage),
    markedUpPrice: ejsonNum(doc.markedUpPrice),
    isActive: doc.isActive !== false,
  });

  if (event.operationType === 'insert' && productId) {
    await recordEngagement(productId, 'cosell_create', sellerId || undefined);
  }
}

async function handleOrderEvent(event: AtlasChangeEvent): Promise<void> {
  // Orders fold into the trending signal as "view" / "favorite"
  // strengtheners depending on whether the order completed. Day-1
  // implementation just emits a single "view" per order so the
  // velocity signal gets warmer.
  const doc = event.fullDocument;
  if (!doc) return;
  const items = (doc.items ?? doc.orderItems) as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const productId = ejsonId(item.productId);
    const buyerId = ejsonId(doc.userId) || undefined;
    if (productId) {
      await recordEngagement(productId, 'view', buyerId);
    }
  }
}

/* ----------------------------------------------------------------- */
/*  Helpers                                                          */
/* ----------------------------------------------------------------- */

/**
 * Decode an EJSON-wrapped id to a plain string. Atlas Triggers serialize
 * change events as Extended JSON, so a Mongo ObjectId arrives as
 * `{ "$oid": "507f..." }` rather than a bare string. Handles plain
 * strings too. Returns '' for null/undefined.
 */
function ejsonId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.$oid === 'string') return o.$oid;
  }
  const s = String(value);
  return s === '[object Object]' ? '' : s;
}

/**
 * Decode an EJSON-wrapped number. Atlas sends numbers as
 * `{ "$numberInt": "9500" }` / `$numberLong` / `$numberDouble` /
 * `$numberDecimal`. Handles plain numbers/strings too. Returns 0 on
 * anything unparseable (never NaN).
 */
function ejsonNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const wrapped = o.$numberInt ?? o.$numberLong ?? o.$numberDouble ?? o.$numberDecimal;
    if (wrapped != null) {
      const n = Number(wrapped);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function firstCategoryId(value: unknown): string | null {
  if (Array.isArray(value) && value.length > 0) return ejsonId(value[0]) || String(value[0]);
  if (typeof value === 'string') return value;
  return null;
}

function normaliseStockStatus(value: unknown): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' {
  const s = typeof value === 'string' ? value.toUpperCase() : '';
  if (s === 'IN_STOCK' || s === 'LOW_STOCK' || s === 'OUT_OF_STOCK') return s;
  return 'UNKNOWN';
}
