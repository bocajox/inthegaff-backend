// OnTheMarket Manchester lettings scraper
// Extracts listings from OnTheMarket's __NEXT_DATA__ JSON (Next.js SSR)
// Pagination: ?page=1, ?page=2, etc. — 30 results per page
// Capped at 100 listings per run to stay within Railway 512MB memory limit

const axios = require('axios');
const { isManchesterArea, extractPostcode } = require('./_helpers');

const BASE_URL = 'https://www.onthemarket.com/to-rent/property/manchester/';

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
const RESULTS_PER_PAGE = 30;
const MAX_PAGES = Math.ceil(MAX_LISTINGS / RESULTS_PER_PAGE); // 4 pages

/**
 * Extract __NEXT_DATA__ JSON from the HTML response
 */
function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error('[onthemarket] Failed to parse __NEXT_DATA__ JSON:', e.message);
    return null;
  }
}

/**
 * Parse price from OnTheMarket format
 * Format: "£995 pcm (£230 pw)" or "£1,200 pcm" or "£300 pw"
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const clean = priceStr.replace(/,/g, '');

  // Try to extract pcm (monthly) price first — it's the primary figure
  const pcmMatch = clean.match(/£([\d.]+)\s*pcm/i);
  if (pcmMatch) {
    const price = parseFloat(pcmMatch[1]);
    if (price >= 200 && price <= 20000) return Math.round(price);
    return null;
  }

  // Fall back to pw (weekly) price and convert to monthly
  const pwMatch = clean.match(/£([\d.]+)\s*(?:pw|per\s*week|weekly)/i);
  if (pwMatch) {
    const weekly = parseFloat(pwMatch[1]);
    const monthly = Math.round(weekly * 52 / 12);
    if (monthly >= 200 && monthly <= 20000) return monthly;
    return null;
  }

  // Plain £ amount — assume monthly
  const plainMatch = clean.match(/£([\d.]+)/);
  if (plainMatch) {
    const price = parseFloat(plainMatch[1]);
    if (price >= 200 && price <= 20000) return Math.round(price);
  }

  return null;
}

/**
 * Parse a single property from the OnTheMarket JSON list
 */
function parseProperty(item) {
  try {
    const address = item.address || '';

    // Geographic filter
    if (!isManchesterArea(address)) return null;

    const price = parsePrice(item.price || item['short-price'] || '');
    const beds = typeof item.bedrooms === 'number' ? item.bedrooms : 0;

    // Get photos — OnTheMarket provides images array with default/webp URLs
    const photos = (item.images || [])
      .slice(0, 5) // Cap photos to save memory
      .map(img => img.default || img.webp || '')
      .filter(url => url && url.startsWith('http'));

    // extractPostcode gets full postcodes (M15 4AA); also try partial district (M15, M50)
    let postcode = extractPostcode(address);
    if (!postcode) {
      const districtMatch = address.match(/\b(M\d{1,2})\b/i);
      if (districtMatch) postcode = districtMatch[1].toUpperCase();
    }
    const id = item.id;
    if (!id) return null;

    // Build title from property type + beds + address
    const propType = item['humanised-property-type'] || 'Property';
    const title = beds > 0
      ? `${beds} Bed ${propType}, ${address}`
      : `${propType}, ${address}`;

    // Build the full listing URL
    const detailsUrl = item['details-url']
      ? `https://www.onthemarket.com${item['details-url']}`
      : `https://www.onthemarket.com/details/${id}/`;

    return {
      external_id: `onthemarket-${id}`,
      title,
      price,
      street: address,
      postcode,
      beds,
      photos,
      url: detailsUrl,
      source: 'onthemarket',
    };
  } catch (err) {
    console.error('[onthemarket] Error parsing listing:', err.message);
    return null;
  }
}

/**
 * Fetch a single page and extract listings from __NEXT_DATA__
 */
async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}?page=${page}`;
  console.log(`[onthemarket] Fetching page ${page}: ${url}`);

  const { data: html } = await axios.get(url, {
    headers: HEADERS,
    timeout: 18000,
    maxRedirects: 5,
  });

  const nextData = extractNextData(html);
  if (!nextData) {
    console.warn(`[onthemarket] No __NEXT_DATA__ found on page ${page}`);
    return [];
  }

  const state = nextData.props?.initialReduxState;
  if (!state) {
    console.warn(`[onthemarket] No initialReduxState on page ${page}`);
    return [];
  }

  const list = state.results?.list;
  if (!Array.isArray(list)) {
    console.warn(`[onthemarket] No results.list on page ${page}`);
    return [];
  }

  return list;
}

/**
 * Main scrape function — fetches up to MAX_PAGES pages, deduplicates, caps at MAX_LISTINGS
 */
async function scrape() {
  const seen = new Set();
  const listings = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const items = await fetchPage(page);
      if (items.length === 0) {
        console.log(`[onthemarket] No items on page ${page}, stopping pagination`);
        break;
      }

      for (const item of items) {
        // Skip spotlight/promoted duplicates
        if (item.id && seen.has(item.id)) continue;
        if (item.id) seen.add(item.id);

        const parsed = parseProperty(item);
        if (parsed) {
          listings.push(parsed);
          if (listings.length >= MAX_LISTINGS) break;
        }
      }

      if (listings.length >= MAX_LISTINGS) {
        console.log(`[onthemarket] Reached ${MAX_LISTINGS} listing cap`);
        break;
      }

      // Small delay between pages to be polite
      if (page < MAX_PAGES) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`[onthemarket] Error fetching page ${page}:`, err.message);
      // Continue to next page rather than crashing
    }
  }

  console.log(`[onthemarket] Scraped ${listings.length} listings (${seen.size} unique IDs seen)`);
  return listings;
}

module.exports = {
  id: 'onthemarket',
  name: 'OnTheMarket',
  website: 'https://www.onthemarket.com',
  areas: ['Manchester'],
  scrape,
};
