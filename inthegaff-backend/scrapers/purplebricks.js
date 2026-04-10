// Purplebricks Manchester lettings scraper
// Extracts listings from Purplebricks' __NEXT_DATA__ JSON (Next.js SSR)
// URL changed from /property-to-rent/ to /search/property-to-rent/
// Small volume (~6 listings) but valid Manchester data

const axios = require('axios');
const { isManchesterArea, extractPostcode, guessArea, parseType, hasFeature } = require('./_helpers');

const BASE = 'https://www.purplebricks.co.uk';
const SEARCH_URL = `${BASE}/search/property-to-rent/Manchester`;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

/**
 * Extract __NEXT_DATA__ JSON from HTML
 */
function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error('[purplebricks] Failed to parse __NEXT_DATA__:', e.message);
    return null;
  }
}

/**
 * Parse a single Purplebricks property into standard listing format
 */
function parseProperty(prop) {
  try {
    if (prop.sold || prop.underOffer || !prop.toLet) return null;

    const address = prop.address || '';
    if (!isManchesterArea(address)) return null;

    // Price — marketPrice is already monthly for rentals
    let price = prop.marketPrice || 0;
    if (prop.rentFrequency === 'Weekly') {
      price = Math.round(price * 52 / 12);
    }
    if (price < 200 || price > 20000) return null;

    const postcode = prop.postcode || extractPostcode(address);
    const bedMatch = (prop.title || '').match(/(\d+)\s*bed/i);
    const beds = bedMatch ? parseInt(bedMatch[1]) : (prop.title?.toLowerCase().includes('studio') ? 0 : 1);

    // Image — prefer mediumImage
    const photo = prop.image?.mediumImage || prop.image?.thumbnail || '';
    const photos = photo ? [photo] : [];

    // Extract property type from title like "3 bedroom semi-detached house"
    const typeMatch = (prop.title || '').match(/bedroom\s+(.+)/i);
    const propType = typeMatch ? typeMatch[1] : 'Property';
    const title = beds > 0
      ? `${beds} Bed ${propType}, ${address}`
      : `${propType}, ${address}`;

    const listingUrl = prop.listingUrl
      ? (prop.listingUrl.startsWith('http') ? prop.listingUrl : BASE + prop.listingUrl)
      : `${BASE}/property/${prop.id}`;

    return {
      external_id: `purplebricks-${prop.id || prop.listingId}`,
      title,
      price,
      street: address,
      postcode,
      beds,
      photos,
      url: listingUrl,
      source: 'purplebricks',
    };
  } catch (err) {
    console.error('[purplebricks] Error parsing property:', err.message);
    return null;
  }
}

async function scrape() {
  let html;
  try {
    const resp = await axios.get(SEARCH_URL, {
      headers: HEADERS,
      timeout: 18000,
      maxRedirects: 5,
    });
    html = resp.data;
  } catch (e) {
    console.error('[purplebricks] Fetch failed:', e.message);
    return [];
  }

  const nextData = extractNextData(html);
  if (!nextData) {
    console.warn('[purplebricks] No __NEXT_DATA__ found');
    return [];
  }

  const properties = nextData.props?.pageProps?.ssrResultData?.properties || [];
  if (!properties.length) {
    console.log('[purplebricks] 0 properties in data');
    return [];
  }

  const listings = [];
  const seen = new Set();

  for (const prop of properties) {
    const id = prop.id || prop.listingId;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);

    const parsed = parseProperty(prop);
    if (parsed) listings.push(parsed);
  }

  console.log(`[purplebricks] Scraped ${listings.length} listings`);
  return listings;
}

module.exports = {
  id: 'purplebricks',
  name: 'Purplebricks',
  website: BASE,
  areas: ['Manchester', 'Salford'],
  scrape,
};
