// Session 9: business API route — full settings (expands Session 8's version)
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
    `SELECT id, name, phone, statement_number, trade_types, service_area,
            default_warranty_months, logo_url,
            line_channel_token, line_channel_secret, line_bot_user_id
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
  const {
    name,
    phone,
    statementNumber,
    tradeTypes,
    serviceArea,
    defaultWarrantyMonths,
    lineChannelToken,
    lineChannelSecret,
    lineBotUserId,
  } = body;

  await queryUnsafe(
    `UPDATE businesses
     SET name = $1,
         phone = $2,
         statement_number = $3,
         trade_types = $4,
         service_area = $5,
         default_warranty_months = $6,
         line_channel_token = $7,
         line_channel_secret = $8,
         line_bot_user_id = $9
     WHERE id = $10`,
    [
      name,
      phone || null,
      statementNumber || null,
      tradeTypes || [],
      serviceArea || null,
      JSON.stringify(defaultWarrantyMonths || {}),
      lineChannelToken || null,
      lineChannelSecret || null,
      lineBotUserId || null,
      businessId,
    ],
    businessId
  );

  return NextResponse.json({ success: true });
}
