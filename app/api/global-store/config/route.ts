import { NextResponse } from "next/server";
import { getActiveCountries, isGlobalStoreEnabled } from "@/lib/global-pricing";
import { resolveCountryCode } from "@/lib/country-resolver";

export const dynamic = "force-dynamic";

/**
 * GET /api/global-store/config
 * Public API — returns active countries, global store enabled state, and auto-detected country.
 * Used by CountryProvider client context.
 */
export async function GET(req: Request) {
  try {
    const [enabled, countries, detectedCountryCode] = await Promise.all([
      isGlobalStoreEnabled(),
      getActiveCountries(),
      resolveCountryCode(req),
    ]);

    const response = NextResponse.json(
      { globalStoreEnabled: enabled, countries, detectedCountryCode },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );

    // Set cookie if not present or changed
    const cookieHeader = req.headers.get("cookie") || "";
    if (!cookieHeader.includes("zb_country=") && detectedCountryCode) {
      response.cookies.set("zb_country", detectedCountryCode, {
        path: "/",
        maxAge: 365 * 86400,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error("[Global Store Config] Error:", error);
    // Fail-open: return India-only defaults
    return NextResponse.json({
      globalStoreEnabled: false,
      countries: [],
      detectedCountryCode: "IN",
    });
  }
}
