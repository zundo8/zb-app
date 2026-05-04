/**
 * GET /api/logistics/serviceability — Check Delhivery delivery serviceability for a pincode
 * 
 * Accepts: ?pincode=xxxxxx
 * Returns: { serviceable: boolean, tat_days: number }
 * Caches results per pincode for 24 hours.
 */

import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// In-memory cache for pincode serviceability (24h TTL)
const pincodeCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getDelhiveryConfig() {
  const apiKey = process.env.DELHIVERY_API_KEY;
  const baseUrl = process.env.DELHIVERY_BASE_URL || "https://track.delhivery.com";

  if (apiKey) return { apiKey, baseUrl };

  // Fallback to DB
  const shop = await prisma.shop.findFirst({ select: { delhiveryApiKey: true } });
  if (shop?.delhiveryApiKey) {
    return { apiKey: shop.delhiveryApiKey, baseUrl };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const pincode = req.nextUrl.searchParams.get("pincode");

    if (!pincode || !/^\d{6}$/.test(pincode)) {
      return NextResponse.json(
        { error: "Valid 6-digit pincode is required" },
        { status: 400 }
      );
    }

    // Check cache
    const cached = pincodeCache.get(pincode);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const config = await getDelhiveryConfig();
    if (!config) {
      // Return serviceable by default if no Delhivery config
      return NextResponse.json({ serviceable: true, tat_days: 5, source: "default" });
    }

    // Call Delhivery serviceability API
    const url = `${config.baseUrl}/c/api/pin-codes/json/?filter_codes=${pincode}`;
    const res = await fetch(url, {
      headers: { Authorization: `Token ${config.apiKey}` },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      console.error(`[Delhivery] Serviceability check failed: ${res.status}`);
      return NextResponse.json({ serviceable: true, tat_days: 7, source: "fallback" });
    }

    const data = await res.json();
    const deliveryCode = data?.delivery_codes?.[0]?.postal_code;

    const result = {
      serviceable: !!deliveryCode,
      tat_days: deliveryCode?.max_days || 7,
      district: deliveryCode?.district || null,
      state: deliveryCode?.state_code || null,
      cod_available: deliveryCode?.cod === "Y",
      prepaid_available: deliveryCode?.pre_paid === "Y",
      source: "delhivery",
    };

    // Cache the result
    pincodeCache.set(pincode, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Delhivery] Serviceability error:", error.message);
    return NextResponse.json({ serviceable: true, tat_days: 7, source: "error_fallback" });
  }
}
