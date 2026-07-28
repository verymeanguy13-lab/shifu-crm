// Session 8: Send Test Message — uses the business's own stored
// LINE credentials to push a message to an arbitrary LINE user ID.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryUnsafe } from "@/lib/db";
import { sendLineMessage } from "@/lib/line";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const { lineUserId, text } = await req.json();
  if (!lineUserId || !text) {
    return NextResponse.json(
      { error: "lineUserId and text are required." },
      { status: 400 }
    );
  }

  const rows = await queryUnsafe<{ line_channel_token: string | null }>(
    `SELECT line_channel_token FROM businesses WHERE id = $1`,
    [businessId],
    businessId
  );
  const token = rows[0]?.line_channel_token;

  if (!token) {
    return NextResponse.json(
      { error: "No LINE Channel Access Token saved yet. Save it first." },
      { status: 400 }
    );
  }

  try {
    await sendLineMessage(token, lineUserId, text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send message." },
      { status: 500 }
    );
  }
}
