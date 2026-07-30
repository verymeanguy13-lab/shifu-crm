// Session 10: Customer Management — single-customer get/update/delete
// CRITICAL: every query here filters by business_id.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryUnsafe } from "@/lib/db";
import type { Customer } from "@/types/crm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;
  const { id } = await params;

  const rows = await queryUnsafe<Customer>(
    `SELECT * FROM customers WHERE id = $1 AND business_id = $2`,
    [id, businessId],
    businessId
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ customer: rows[0] });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;
  const { id } = await params;

  const { name, phone, notes } = await req.json();

  const rows = await queryUnsafe<Customer>(
    `UPDATE customers
     SET name = COALESCE($1, name),
         phone = $2,
         notes = $3
     WHERE id = $4 AND business_id = $5
     RETURNING *`,
    [name, phone || null, notes || null, id, businessId],
    businessId
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ customer: rows[0] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;
  const { id } = await params;

  const rows = await queryUnsafe<{ id: number }>(
    `DELETE FROM customers WHERE id = $1 AND business_id = $2 RETURNING id`,
    [id, businessId],
    businessId
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}