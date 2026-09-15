import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface GeoSuggestion {
  placeId: string;
  displayName: string;
  mainText: string;
  secondaryText: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();
    const country = searchParams.get("country")?.trim().toLowerCase() || "in";

    if (!query || query.length < 2) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    // Call OpenStreetMap Nominatim search
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&limit=6&countrycodes=${encodeURIComponent(country)}`;

    const res = await fetch(nomUrl, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ZicaBellaBackend/1.0 (contact@zicabella.com)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    const suggestions: GeoSuggestion[] = data.map((item: any) => {
      const addr = item.address || {};
      const houseNo = addr.house_number || addr.building || "";
      const road = addr.road || addr.residential || "";
      const suburb = addr.suburb || addr.neighbourhood || addr.quarter || addr.subdivision || "";
      const streetParts = [houseNo, road, suburb].filter(Boolean);
      const street = streetParts.length > 0 ? streetParts.join(", ") : item.name || "";
      const landmark = suburb && road ? suburb : "";
      const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || "";
      const state = addr.state || "";
      const zip = (addr.postcode || "").replace(/\s/g, "").slice(0, 6);
      const itemCountry = addr.country || "India";
      const itemCountryCode = (addr.country_code || country).toUpperCase();

      const mainText = item.name || suburb || road || city || query;
      const secondaryParts = [suburb !== mainText ? suburb : "", city, state, zip].filter(Boolean);
      const secondaryText = secondaryParts.join(", ");

      return {
        placeId: String(item.place_id || Math.random().toString(36).substring(2)),
        displayName: item.display_name || `${mainText}, ${secondaryText}`,
        mainText,
        secondaryText: secondaryText || itemCountry,
        street,
        landmark,
        city,
        state,
        zip,
        country: itemCountry,
        countryCode: itemCountryCode,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    return NextResponse.json({ ok: true, suggestions });
  } catch (err: any) {
    console.error("[GeoSuggest] Error:", err.message);
    return NextResponse.json({ ok: true, suggestions: [] });
  }
}
