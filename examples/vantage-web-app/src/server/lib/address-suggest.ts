/**
 * Address autocomplete with a pluggable provider:
 *  - GOOGLE_PLACES_API_KEY set → Google Places API (New), the industry
 *    standard for checkout autocomplete (rooftop-accurate delivery addresses).
 *  - key absent → Photon (photon.komoot.io), a free, keyless OSM geocoder.
 *    Fine for demos: fair-use rate limits, no SLA, and OSM data is
 *    street-level (house numbers are patchy). Production checkouts should
 *    set the Google key (or swap in Loqate/Mapbox here).
 *
 * The server proxies both so no provider key ever reaches the browser.
 */

export interface AddressSuggestion {
  label: string;
  address_line_1: string;
  city: string;
  administrative_area: string;
  postal_code: string;
  country_code: string;
}

/** "street" completes address line 1; "postal" completes a postal code and
 * fills the city/region/country it belongs to. */
export type SuggestKind = "street" | "postal";

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

export function suggestAddresses(
  query: string,
  countryCodes: string[],
  kind: SuggestKind = "street",
): Promise<AddressSuggestion[]> {
  return GOOGLE_KEY
    ? googleSuggest(query, countryCodes, GOOGLE_KEY, kind)
    : photonSuggest(query, countryCodes, kind);
}

async function photonSuggest(
  query: string,
  countryCodes: string[],
  kind: SuggestKind,
): Promise<AddressSuggestion[]> {
  // Photon's fuzzy match is sensitive to spacing on partial postcodes
  // ("n77" matches N7 7.., "n7 7" and "n77d" don't) — query the raw,
  // compact, and UK-spaced forms in parallel and merge. The postcode layer
  // ("other") needs a high limit since we country-filter after the fact.
  const queries = new Set([query]);
  if (kind === "postal") {
    const compact = query.replace(/\s+/g, "");
    queries.add(compact);
    const uk = compact.match(/^([A-Za-z]{1,2}\d[A-Za-z\d]?)(\d[A-Za-z]{0,2})$/);
    if (uk) queries.add(`${uk[1]} ${uk[2]}`);
  }
  type PhotonResponse = {
    features?: {
      properties?: {
        housenumber?: string;
        street?: string;
        name?: string;
        city?: string;
        district?: string;
        state?: string;
        postcode?: string;
        countrycode?: string;
      };
    }[];
  };
  const responses = await Promise.all(
    [...queries].map(async (q) => {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", kind === "postal" ? "30" : "6");
      url.searchParams.set("lang", "en");
      if (kind === "postal") url.searchParams.set("layer", "other");
      const res = await fetch(url);
      return res.ok ? ((await res.json()) as PhotonResponse) : {};
    }),
  );
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const f of responses.flatMap((d) => d.features ?? [])) {
    if (out.length >= 6) break;
    const p = f.properties ?? {};
    const cc = (p.countrycode ?? "").toUpperCase();
    if (countryCodes.length && !countryCodes.includes(cc)) continue;
    let s: AddressSuggestion;
    if (kind === "postal") {
      // Postcode features carry the code in `name`, no street.
      const code = p.postcode ?? p.name ?? "";
      const place = p.city ?? p.district ?? "";
      if (!code || !place) continue;
      s = {
        label: [code, place, p.state].filter(Boolean).join(", "),
        address_line_1: "",
        city: p.city ?? "",
        administrative_area: p.state ?? "",
        postal_code: code,
        country_code: cc,
      };
    } else {
      const line1 = [p.housenumber, p.street ?? p.name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!line1 || !p.city) continue;
      s = {
        label: [line1, p.city, p.postcode].filter(Boolean).join(", "),
        address_line_1: line1,
        city: p.city,
        administrative_area: p.state ?? "",
        postal_code: p.postcode ?? "",
        country_code: cc,
      };
    }
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    out.push(s);
  }
  return out;
}

async function googleSuggest(
  query: string,
  countryCodes: string[],
  key: string,
  kind: SuggestKind,
): Promise<AddressSuggestion[]> {
  const auto = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes:
          kind === "postal"
            ? ["postal_code"]
            : ["street_address", "premise", "subpremise"],
        ...(countryCodes.length ? { includedRegionCodes: countryCodes } : {}),
      }),
    },
  );
  if (!auto.ok) return [];
  const { suggestions = [] } = (await auto.json()) as {
    suggestions?: {
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }[];
  };

  const out: AddressSuggestion[] = [];
  for (const s of suggestions.slice(0, 5)) {
    const id = s.placePrediction?.placeId;
    if (!id) continue;
    const det = await fetch(
      `https://places.googleapis.com/v1/places/${id}?fields=addressComponents`,
      { headers: { "X-Goog-Api-Key": key } },
    );
    if (!det.ok) continue;
    const { addressComponents = [] } = (await det.json()) as {
      addressComponents?: {
        types?: string[];
        longText?: string;
        shortText?: string;
      }[];
    };
    const get = (type: string, short = false) => {
      const c = addressComponents.find((x) => x.types?.includes(type));
      return (short ? c?.shortText : c?.longText) ?? "";
    };
    const line1 =
      kind === "postal"
        ? ""
        : [get("street_number"), get("route")].filter(Boolean).join(" ");
    if (kind === "postal" ? !get("postal_code") : !line1) continue;
    out.push({
      label: s.placePrediction?.text?.text ?? line1,
      address_line_1: line1,
      city: get("locality") || get("postal_town"),
      administrative_area: get("administrative_area_level_1", true),
      postal_code: get("postal_code"),
      country_code: get("country", true),
    });
  }
  return out;
}
