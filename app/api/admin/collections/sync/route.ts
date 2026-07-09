import { NextResponse } from "next/server";
import { clearShopifyCache } from "@/lib/shopify-admin";

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    clearShopifyCache();
    return NextResponse.json({ success: true, message: "Shopify cache cleared successfully" });
  } catch (error: any) {
    console.error("Sync collections cache error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
