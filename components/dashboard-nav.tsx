// Simple nav bar for all (dashboard) pages — sign out + quick links.
"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export function DashboardNav() {
  return (
    <div className="border-b px-6 py-3 flex items-center justify-between">
      <div className="flex gap-4 text-sm">
        <Link href="/dashboard" className="hover:underline">
          儀表板
        </Link>
        <Link href="/customers" className="hover:underline">
          客戶
        </Link>
        <Link href="/settings" className="hover:underline">
          設定
        </Link>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm text-red-600 hover:underline"
      >
        登出
      </button>
    </div>
  );
}