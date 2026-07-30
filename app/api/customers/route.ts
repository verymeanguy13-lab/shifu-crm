// Session 10: Customer Management — list (with search) + create
// CRITICAL: every query here filters by business_id — a business must
// never be able to read another business's customers.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryUnsafe } from "@/lib/db";
import type { Customer } from "@/types/crm";

// Prevent this route from ever being cached — without this, a plain
// browser refresh (not a hard refresh) could serve a stale list after
// adding/editing a customer.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();

  let customers: Customer[];
  if (search) {
    customers = await queryUnsafe<Customer>(
      `SELECT * FROM customers
       WHERE business_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
       ORDER BY created_at DESC`,
      [businessId, `%${search}%`],
      businessId
    );
  } else {
    customers = await queryUnsafe<Customer>(
      `SELECT * FROM customers WHERE business_id = $1 ORDER BY created_at DESC`,
      [businessId],
      businessId
    );
  }

  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const { name, phone, notes } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const rows = await queryUnsafe<Customer>(
    `INSERT INTO customers (business_id, name, phone, notes)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [businessId, name, phone || null, notes || null],
    businessId
  );

  return NextResponse.json({ customer: rows[0] });
}