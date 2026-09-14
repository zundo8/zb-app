import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ReverseGeoResponse {
  ok: boolean;
  formattedAddress?: string;
  houseNo?: string;
  street?: string;
  landmark?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  source?: string;
  error?: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { ok: false, error: "lat and lng parameters are required" },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { ok: false, error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    // ── Strategy 1: Google Maps Geocoding API ──────────────────────────
    const googleApiKey =
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "";

    if (googleApiKey) {
      try {
        const gmUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;
        const gmRes = await fetch(gmUrl, { next: { revalidate: 3600 } });
        if (gmRes.ok) {
          const gmData = await gmRes.json();
          if (gmData.status === "OK" && gmData.results && gmData.results[0]) {
            const first = gmData.results[0];
            const components: any[] = first.address_components || [];

            let houseNo = "";
            let street = "";
            let landmark = "";
            let city = "";
            let state = "";
            let zip = "";
            let country = "India";
            let countryCode = "IN";

            for (const c of components) {
              const types = c.types || [];
              if (types.includes("street_number") || types.includes("premise") || types.includes("subpremise")) {
                houseNo = houseNo ? `${houseNo}, ${c.long_name}` : c.long_name;
              }
              if (types.includes("route")) {
                street = street ? `${c.long_name}, ${street}` : c.long_name;
              }
              if (types.includes("sublocality") || types.includes("sublocality_level_1") || types.includes("neighborhood")) {
                if (!street) {
                  street = c.long_name;
                } else {
                  landmark = landmark ? `${landmark}, ${c.long_name}` : c.long_name;
                }
              }
              if (types.includes("locality")) {
                city = c.long_name;
              } else if (!city && (types.includes("administrative_area_level_2") || types.includes("postal_town"))) {
                city = c.long_name;
              }
              if (types.includes("administrative_area_level_1")) {
                state = c.long_name;
              }
              if (types.includes("postal_code")) {
                zip = c.long_name;
              }
              if (types.includes("country")) {
                country = c.long_name;
                countryCode = (c.short_name || "IN").toUpperCase();
              }
            }

            return NextResponse.json<ReverseGeoResponse>({
              ok: true,
              formattedAddress: first.formatted_address || "",
              houseNo,
              street: street || landmark || first.formatted_address?.split(",")[0] || "",
              landmark,
              city,
              state,
              zip,
              country,
              countryCode,
              placeId: first.place_id || undefined,
              lat,
              lng,
              source: "google",
            });
          }
        }
      } catch (gmErr) {
        console.warn("[ReverseGeo] Google Geocoding API failed, falling back:", gmErr);
      }
    }

    // ── Strategy 2: OpenStreetMap Nominatim (Server-Side) ──────────────
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const nomRes = await fetch(nomUrl, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "ZicaBellaBackend/1.0 (contact@zicabella.com)",
        },
        next: { revalidate: 3600 },
      });

      if (nomRes.ok) {
        const data = await nomRes.json();
        if (data && data.address) {
          const addr = data.address;
          const houseNo = addr.house_number || addr.building || "";
          const road = addr.road || addr.residential || "";
          const suburb = addr.suburb || addr.neighbourhood || addr.quarter || "";
          const street = [road, suburb].filter(Boolean).join(", ");
          const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || "";
          const state = addr.state || "";
          const zip = (addr.postcode || "").replace(/\s/g, "").slice(0, 6);
          const country = addr.country || "India";
          const countryCode = (addr.country_code || "in").toUpperCase();

          return NextResponse.json<ReverseGeoResponse>({
            ok: true,
            formattedAddress: data.display_name || "",
            houseNo,
            street: street || data.display_name?.split(",")[0] || "",
            landmark: suburb !== street ? suburb : "",
            city,
            state,
            zip,
            country,
            countryCode,
            lat,
            lng,
            source: "nominatim",
          });
        }
      }
    } catch (nomErr) {
      console.warn("[ReverseGeo] Nominatim failed, trying BigDataCloud:", nomErr);
    }

    // ── Strategy 3: BigDataCloud Client-Free Reverse Geocode ───────────
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const bdcRes = await fetch(bdcUrl, { next: { revalidate: 3600 } });
      if (bdcRes.ok) {
        const data = await bdcRes.json();
        if (data) {
          const street = data.locality || data.principalSubdivisionDescription || "";
          const city = data.city || data.locality || "";
          const state = data.principalSubdivision || "";
          const zip = data.postcode || "";
          const country = data.countryName || "India";
          const countryCode = (data.countryCode || "IN").toUpperCase();

          return NextResponse.json<ReverseGeoResponse>({
            ok: true,
            formattedAddress: [street, city, state, zip, country].filter(Boolean).join(", "),
            street,
            city,
            state,
            zip,
            country,
            countryCode,
            lat,
            lng,
            source: "bigdatacloud",
          });
        }
      }
    } catch (bdcErr) {
      console.warn("[ReverseGeo] BigDataCloud failed:", bdcErr);
    }

    return NextResponse.json<ReverseGeoResponse>({
      ok: false,
      error: "Unable to reverse geocode coordinates",
      lat,
      lng,
    });
  } catch (error: any) {
    console.error("[ReverseGeo] Unexpected error:", error);
    return NextResponse.json<ReverseGeoResponse>(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
