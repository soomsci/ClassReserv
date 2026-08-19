import type { Metadata } from "next";

import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";
import { isAdminRequest, usableDevPassword } from "@/lib/admin";

export const metadata: Metadata = {
  title: "관리자 · 특별실 예약",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdminRequest();

  if (!admin) return <AdminLogin devPassword={usableDevPassword()} />;
  return <AdminPanel />;
}
