// SpareRoom Manchester lettings scraper
// Extracts room/flatshare listings from SpareRoom's server-rendered HTML
// Pagination: offset=0, offset=10, offset=20, etc. — ~11 results per page
// Capped at 100 listings per run to stay within Railway 512MB memory limit

const { fetchHTML, isManchesterArea } = require('./_helpers');

const BASE_URL = 'https://www.spareroom.co.uk/flatshare/manchester';

const MAX_LISTINGS = 100;
const RESULTS_PER_PAGE = 10;
const MAX_PAGES = Math.ceil(MAX_LISTINGS / RESULTS_PER_PAGE); // 10 pages

/**
 * Parse price from SpareRoom format
 * Examples: "£595 - £650 pcm", "£500 pcm", "£150 pw"
 * SpareRoom often shows price ranges — take the lower end
 */
function parsePrice(text) {
  if (!text) return null;
  const clean = text.replace(/,/g, '').replace(/&pound;/g, '£');

  // Weekly price
  if (/pw|per\s*week|weekly/i.test(clean)) {
    const match = clean.match(/£(\d+)/);
    if (match) {
      const monthly = Math.round(parseFloat(match[1]) * 52 / 12);
      if (monthly >= 200 && monthly <= 20000) return monthly;
    }
    return null;
  }

  // Monthly price (may be a range like £595 - £650)
  const match = clean.match(/£(\d+)/);
  if (match) {
    const price = parseFloat(match[1]);
    if (price >= 200 && price <= 20000) return Math.round(price);
  }

  return null;
}

/**
 * Extract postcode from location text or data attributes
 */
function extractPostcode(text) {
  if (!text) return '';
  const full = text.match(/\b(M\d{1,2}\s*\d[A-Z]{2})\b/i);
  if (full) return full[1].toUpperCase();
  const district = text.match(/\b(M\d{1,2})\b/i);
  if (district) return district[1].toUpperCase();
  return '';
}

/**
 * Normalise protocol-relative URLs
 */
function norm(url) {
  if (url && url.startsWith('//')) return 'https:' + url;
  return url;
}

/**
 * Parse a single listing from the HTML
 */
function parseListing($, li) {
  const el = $(li);
  const listingId = el.attr('data-listing-id');
  if (!listingId) return null;

  // Get location from data attributes and card text
  const neighbourhood = el.attr('data-listing-neighbourhood') || '';
  const postcodeDistrict = el.attr('data-listing-postcode') || '';
  const locationText = el.find('.listing-card__location').text().trim();

  // Build address from available info
  const address = locationText || `${neighbourhood} (${postcodeDistrict})`;

  // Geographic filter
  if (!isManchesterArea(address) && !isManchesterArea(neighbourhood)) {
    // Also check postcode district directly
    if (!postcodeDistrict || !postcodeDistrict.match(/^M\d{1,2}$/i)) {
      return null;
    }
  }

  // Price
  const priceText = el.find('.listing-card__price').text().trim();
  const price = parsePrice(priceText);

  // Title
  const title = el.find('.listing-card__title').text().trim()
    || el.attr('data-listing-title') || `Room in ${neighbourhood}`;

  // Photo — main image from img src or data-src
  const mainImg = el.find('.listing-card__main-image');
  let photoUrl = mainImg.attr('data-src') || mainImg.attr('src') || '';
  photoUrl = norm(photoUrl);
  const photos = photoUrl && photoUrl.startsWith('http') ? [photoUrl] : [];

  // Also check the profile photo from data attribute
  if (!photos.length) {
    const profilePhoto = el.attr('data-listing-ad-profile-photo');
    if (profilePhoto) photos.push(norm(profilePhoto));
  }

  // URL
  const linkEl = el.find('.listing-card__link');
  const href = linkEl.attr('href') || '';
  const url = href.startsWith('http') ? href : `https://www.spareroom.co.uk${href}`;

  // Beds — SpareRoom lists rooms, not whole properties
  // Parse room count from the card text
  const roomText = el.find('.listing-card__room').text().trim();
  let beds = 1; // Default to 1 for room listings
  const bedsMatch = roomText.match(/(\d+)\s*(?:double|single|room|bed)/i);
  if (bedsMatch) beds = parseInt(bedsMatch[1]);

  const postcode = extractPostcode(postcodeDistrict) || extractPostcode(locationText);

  return {
    external_id: `spareroom-${listingId}`,
    title,
    price,
    street: address,
    postcode,
    beds,
    photos,
    url,
    source: 'spareroom',
  };
}

/**
 * Main scrape function
 */
async function scrape() {
  const seen = new Set();
  const listings = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    if (listings.length >= MAX_LISTINGS) break;

    const offset = page * RESULTS_PER_PAGE;
    const url = `${BASE_URL}?offset=${offset}`;

    try {
      console.log(`[spareroom] Fetching page ${page + 1} (offset=${offset})`);
      const $ = await fetchHTML(url);

      const items = $('li.listing-result');
      if (!items.length) {
        console.log(`[spareroom] No results at offset=${offset}, stopping`);
        break;
      }

      items.each(function () {
        if (listings.length >= MAX_LISTINGS) return false;

        try {
          const listing = parseListing($, this);
          if (!listing) return;

          if (seen.has(listing.external_id)) return;
          seen.add(listing.external_id);

          listings.push(listing);
        } catch (err) {
          console.error('[spareroom] Error parsing listing:', err.message);
        }
      });

      console.log(`[spareroom] Page ${page + 1}: ${items.length} raw, ${listings.length} total kept`);
    } catch (err) {
      console.error(`[spareroom] Error fetching offset=${offset}:`, err.message);
      if (page === 0) {
        console.error('[spareroom] First page failed — SpareRoom may be blocking this IP');
        return [];
      }
    }
  }

  console.log(`[spareroom] Scrape complete: ${listings.length} Manchester listings`);
  return listings;
}

module.exports = {
  id: 'spareroom',
  name: 'SpareRoom',
  website: 'https://www.spareroom.co.uk',
  areas: ['Manchester', 'Salford', 'Trafford', 'Stockport'],
  scrape,
};
