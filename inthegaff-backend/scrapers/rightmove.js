// Rightmove Manchester lettings scraper
// Extracts listings from Rightmove's __NEXT_DATA__ JSON (Next.js SSR)
// Pagination: index=0, index=24, index=48, etc. — 25 results per page
// Capped at 100 listings per run to stay within Railway 512MB memory limit

const axios = require('axios');
const { isManchesterArea } = require('./_helpers');

const BASE_URL = 'https://www.rightmove.co.uk/property-to-rent/find.html';
const SEARCH_PARAMS = {
  locationIdentifier: 'REGION^904', // Manchester
  sortType: '6',                     // Newest first
  includeLetAgreed: 'false',
  propertyTypes: '',
  mustHave: '',
  dontShow: '',
  furnishTypes: '',
  keywords: '',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const MAX_LISTINGS = 100;
const RESULTS_PER_PAGE = 25;
const MAX_PAGES = Math.ceil(MAX_LISTINGS / RESULTS_PER_PAGE); // 4 pages

/**
 * Extract __NEXT_DATA__ JSON from the HTML response
 */
function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error('[rightmove] Failed to parse __NEXT_DATA__ JSON:', e.message);
    return null;
  }
}

/**
 * Parse price — Rightmove provides structured price data in JSON
 * price.amount is already monthly, but we double-check with frequency
 */
function parsePrice(priceObj) {
  if (!priceObj || !priceObj.amount) return null;
  let amount = priceObj.amount;

  // Convert weekly to monthly if needed
  if (priceObj.frequency === 'weekly') {
    amount = Math.round(amount * 52 / 12);
  }

  // Reject outliers for Manchester market
  if (amount < 200 || amount > 20000) return null;
  return amount;
}

/**
 * Extract postcode from display address
 * Rightmove addresses usually end with the postcode district e.g. "Manchester, M1"
 */
function extractPostcode(address) {
  if (!address) return '';
  // Full postcode: M1 1AA, M20 3BG etc.
  const full = address.match(/\b(M\d{1,2}\s*\d[A-Z]{2})\b/i);
  if (full) return full[1].toUpperCase();
  // Partial district: M1, M20 etc.
  const district = address.match(/\b(M\d{1,2})\b/i);
  if (district) return district[1].toUpperCase();
  return '';
}

/**
 * Parse a single property from the Rightmove JSON
 */
function parseProperty(prop) {
  const address = prop.displayAddress || '';

  // Geographic filter
  if (!isManchesterArea(address)) return null;

  const price = parsePrice(prop.price);

  // Get photos — Rightmove provides srcUrl in the images array
  const photos = (prop.images || [])
    .slice(0, 5) // Cap photos to save memory
    .map(img => img.srcUrl || '')
    .filter(url => url && url.startsWith('http'));

  const postcode = extractPostcode(address);
  const beds = typeof prop.bedrooms === 'number' ? prop.bedrooms : 0;

  // Build title from property type + beds + address
  const subType = prop.propertySubType || 'Property';
  const title = beds > 0
    ? `${beds} Bed ${subType}, ${address}`
    : `${subType}, ${address}`;

  // Build the full listing URL
  const propertyUrl = prop.propertyUrl
    ? `https://www.rightmove.co.uk${prop.propertyUrl}`
    : `https://www.rightmove.co.uk/properties/${prop.id}`;

  return {
    external_id: `rightmove-${prop.id}`,
    title,
    price,
    street: address,
    postcode,
    beds,
    photos,
    url: propertyUrl,
    source: 'rightmove',
  };
}

/**
 * Fetch one page of results
 */
async function fetchPage(index) {
  const params = new URLSearchParams({ ...SEARCH_PARAMS, index: String(index) });
  const url = `${BASE_URL}?${params.toString()}`;

  console.log(`[rightmove] Fetching page at index=${index}`);
  const { data } = await axios.get(url, {
    headers: HEADERS,
    timeout: 18000,
    maxRedirects: 5,
  });

  const nextData = extractNextData(data);
  if (!nextData) {
    console.warn('[rightmove] No __NEXT_DATA__ found on page index=' + index);
    return [];
  }

  const searchResults = nextData.props?.pageProps?.searchResults;
  if (!searchResults || !searchResults.properties) {
    console.warn('[rightmove] No properties in searchResults at index=' + index);
    return [];
  }

  return searchResults.properties;
}

/**
 * Main scrape function
 */
async function scrape() {
  const seen = new Set();
  const listings = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    if (listings.length >= MAX_LISTINGS) break;

    const index = page * RESULTS_PER_PAGE;

    try {
      const properties = await fetchPage(index);
      if (!properties.length) {
        console.log(`[rightmove] No results at index=${index}, stopping pagination`);
        break;
      }

      for (const prop of properties) {
        if (listings.length >= MAX_LISTINGS) break;

        try {
          const id = `rightmove-${prop.id}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const listing = parseProperty(prop);
          if (listing) {
            listings.push(listing);
          }
        } catch (err) {
          console.error(`[rightmove] Error parsing property ${prop.id}:`, err.message);
        }
      }

      console.log(`[rightmove] Page ${page + 1}: ${properties.length} raw, ${listings.length} total kept`);
    } catch (err) {
      console.error(`[rightmove] Error fetching page index=${index}:`, err.message);
      // If first page fails (e.g. 403), abort entirely
      if (page === 0) {
        console.error('[rightmove] First page failed — Rightmove may be blocking this IP');
        return [];
      }
      // Otherwise continue to next page
    }
  }

  console.log(`[rightmove] Scrape complete: ${listings.length} Manchester listings`);
  return listings;
}

module.exports = {
  id: 'rightmove',
  name: 'Rightmove',
  website: 'https://www.rightmove.co.uk',
  areas: ['Manchester', 'Salford', 'Trafford', 'Stockport'],
  scrape,
};
