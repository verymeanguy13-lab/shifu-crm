// Session 6: Authentication — Signup API route
// (Not explicitly named in the blueprint's "Builds" line, but required:
// NextAuth's Credentials provider only handles login, never account creation.)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryUnsafe } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { businessName, email, password, phone, tradeTypes, serviceArea } = body;

    if (!businessName || !email || !password) {
      return NextResponse.json(
        { error: "Business name, email, and password are required." },
        { status: 400 }
      );
    }

    const existing = await queryUnsafe(
      `SELECT id FROM businesses WHERE email = $1`,
      [email],
      0
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await queryUnsafe(
      `INSERT INTO businesses (name, email, password_hash, phone, trade_types, service_area)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        businessName,
        email,
        passwordHash,
        phone || null,
        tradeTypes || [],
        serviceArea || null,
      ],
      0
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
