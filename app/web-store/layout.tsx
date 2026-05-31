import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import DashboardLayout from "../dashboard/layout";

export default async function ServerWebStoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Secure redirect if not authenticated
  if (!session || !session.user) {
    redirect("/dashboard/login");
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
