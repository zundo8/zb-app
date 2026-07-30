import { NextResponse } from "next/server";
import { getActiveCountries, isGlobalStoreEnabled } from "@/lib/global-pricing";

export const dynamic = "force-dynamic";

/**
 * GET /api/global-store/config
 * Public API — returns active countries and global store enabled state.
 * Used by the CountryProvider client context to avoid waterfall fetches.
 * Lightweight: reads from in-memory cache (60s TTL), no auth required.
 */
export async function GET() {
  try {
    const [enabled, countries] = await Promise.all([
      isGlobalStoreEnabled(),
      getActiveCountries(),
    ]);

    return NextResponse.json(
      { globalStoreEnabled: enabled, countries },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[Global Store Config] Error:", error);
    // Fail-open: return India-only defaults
    return NextResponse.json({
      globalStoreEnabled: false,
      countries: [],
    });
  }
}
