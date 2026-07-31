/**
 * Server-side Country Resolver for Storefront
 * Resolves country code based on:
 * 1. `zb_country` cookie if present and valid
 * 2. IP Geolocation lookup (`lib/ip-geo.ts`)
 * 3. Default to "IN" (India) if lookup fails or unsupported country
 */

import { cookies, headers } from "next/headers";
import { getClientIP, lookupIpGeo } from "@/lib/ip-geo";
import { getActiveCountries } from "@/lib/global-pricing";

const FALLBACK_SUPPORTED = ["IN", "US", "GB", "CA", "AU", "AE", "DE", "ES"];

/**
 * Resolve country code for server components / server actions / route handlers.
 */
export async function resolveCountryCode(req?: Request): Promise<string> {
  try {
    const activeCountries = await getActiveCountries();
    const supportedCodes = activeCountries.length > 0
      ? activeCountries.map((c) => c.code.toUpperCase())
      : FALLBACK_SUPPORTED;

    // 1. Check cookie
    const cookieStore = cookies();
    const cookieCountry = cookieStore.get("zb_country")?.value;
    if (cookieCountry && supportedCodes.includes(cookieCountry.toUpperCase())) {
      return cookieCountry.toUpperCase();
    }

    // 2. IP Geo Lookup if request available
    if (req) {
      const ip = getClientIP(req);
      if (ip) {
        const geo = await lookupIpGeo(ip);
        if (geo?.countryCode && supportedCodes.includes(geo.countryCode.toUpperCase())) {
          return geo.countryCode.toUpperCase();
        }
      }
    } else {
      // Try header fallback in Next.js Server Components
      const headerList = headers();
      const cfCountry = headerList.get("cf-ipcountry") || headerList.get("x-vercel-ip-country");
      if (cfCountry && supportedCodes.includes(cfCountry.toUpperCase())) {
        return cfCountry.toUpperCase();
      }
    }
  } catch (e) {
    // Fail silently
  }

  return "IN";
}
