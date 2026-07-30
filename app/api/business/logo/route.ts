// Session 9: Logo upload — stores the file in Vercel Blob, saves the
// resulting public URL onto the business row.
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryUnsafe } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = (session.user as any).businessId;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are allowed." },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 5MB)." },
      { status: 400 }
    );
  }

  const blob = await put(`logos/business-${businessId}-${file.name}`, file, {
    access: "public",
    token: process.env.v3_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });

  await queryUnsafe(
    `UPDATE businesses SET logo_url = $1 WHERE id = $2`,
    [blob.url, businessId],
    businessId
  );

  return NextResponse.json({ url: blob.url });
}
