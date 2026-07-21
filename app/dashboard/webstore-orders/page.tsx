"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import WebStoreOrdersList from "@/app/web-store/orders/page";

export default function DashboardWebStoreOrdersPage() {
  return <WebStoreOrdersList />;
}
