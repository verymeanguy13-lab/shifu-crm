// Session 8: business API route — LINE credential fields only for now.
// Session 9 extends the PATCH body to include name/phone/trade_types/etc.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryUnsafe } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const rows = await queryUnsafe(
    `SELECT id, name, phone, line_channel_token, line_channel_secret, line_bot_user_id
     FROM businesses WHERE id = $1`,
    [businessId],
    businessId
  );

  return NextResponse.json({ business: rows[0] || null });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const body = await req.json();
  const { lineChannelToken, lineChannelSecret, lineBotUserId } = body;

  await queryUnsafe(
    `UPDATE businesses
     SET line_channel_token = $1, line_channel_secret = $2, line_bot_user_id = $3
     WHERE id = $4`,
    [lineChannelToken || null, lineChannelSecret || null, lineBotUserId || null, businessId],
    businessId
  );

  return NextResponse.json({ success: true });
}
