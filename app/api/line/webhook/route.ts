// Session 8: LINE Webhook
// Receives events from LINE, verifies the signature, and stores each
// message. Responds 200 immediately per LINE's requirements — LINE
// disables webhooks that respond slowly or with errors repeatedly.
import { NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line";
import { queryUnsafe } from "@/lib/db";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") || "";

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // Malformed body — nothing we can do with it, but still respond 200
    // so LINE doesn't retry a request that will never parse.
    return NextResponse.json({ ok: true });
  }

  const destination: string | undefined = parsed.destination;
  if (!destination) {
    return NextResponse.json({ ok: true });
  }

  // Look up which business this webhook belongs to via the bot's own
  // user ID (LINE includes this as "destination" in every webhook body).
  // businesses has no RLS (it's the tenant root), so businessId arg
  // below is an unused placeholder.
  const businesses = await queryUnsafe<{
    id: number;
    line_channel_secret: string;
    line_channel_token: string;
  }>(
    `SELECT id, line_channel_secret, line_channel_token FROM businesses WHERE line_bot_user_id = $1`,
    [destination],
    0
  );
  const business = businesses[0];

  if (!business || !business.line_channel_secret) {
    console.log("[webhook debug] Unknown channel. destination received:", destination);
    return NextResponse.json({ error: "Unknown channel" }, { status: 401 });
  }

  const validSignature = verifyLineSignature(
    rawBody,
    signature,
    business.line_channel_secret
  );

  if (!validSignature) {
    console.log("[webhook debug] Invalid signature. destination:", destination, "signature header present:", !!signature);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const events = parsed.events || [];

  for (const event of events) {
    const lineUserId: string | undefined = event.source?.userId;
    if (!lineUserId) continue;

    const text: string | null =
      event.type === "message" && event.message?.type === "text"
        ? event.message.text
        : null;
    const messageType: string = event.message?.type || event.type || "unknown";

    // Find or create the customer this LINE user maps to, scoped to
    // this business (customers.line_user_id is not globally unique —
    // the same LINE account could message different businesses).
    const existingCustomers = await queryUnsafe<{ id: number }>(
      `SELECT id FROM customers WHERE business_id = $1 AND line_user_id = $2`,
      [business.id, lineUserId],
      business.id
    );

    let customerId: number;
    if (existingCustomers[0]) {
      customerId = existingCustomers[0].id;
    } else {
      const inserted = await queryUnsafe<{ id: number }>(
        `INSERT INTO customers (business_id, name, line_user_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [business.id, "LINE 使用者", lineUserId],
        business.id
      );
      customerId = inserted[0].id;
    }

    await queryUnsafe(
      `INSERT INTO messages (customer_id, direction, body, line_message_type)
       VALUES ($1, 'inbound', $2, $3)`,
      [customerId, text, messageType],
      business.id
    );
  }

  return NextResponse.json({ ok: true });
}
