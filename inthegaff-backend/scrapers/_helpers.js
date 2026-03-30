// Shared helpers used across scrapers

const axios = require('axios');
const cheerio = require('cheerio');

// Full browser-like headers to avoid 403s
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

async function fetchHTML(url, extraHeaders = {}) {
  const { data } = await axios.get(url, {
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    timeout: 18000,
    maxRedirects: 5,
  });
  return cheerio.load(data);
}

// ── Centralised Manchester area filter ─────────────────────────────────────
// Used by every scraper. One place to maintain, one place to test.
const MANCHESTER_AREAS = [
  'manchester', 'salford', 'chorlton', 'didsbury', 'fallowfield',
  'withington', 'levenshulme', 'rusholme', 'hulme', 'ancoats',
  'northern quarter', 'whalley range', 'stretford', 'sale ',
  'altrincham', 'stockport', 'moss side', 'old trafford',
  'burnage', 'longsight', 'gorton', 'ardwick', 'openshaw',
  'droylsden', 'denton', 'hyde', 'stalybridge', 'ashton-under-lyne',
  'trafford', 'eccles', 'swinton', 'prestwich', 'whitefield',
  'mediacity', 'castlefield', 'deansgate', 'spinningfields',
  'piccadilly', 'cheetham', 'crumpsall', 'harpurhey', 'moston',
  'newton heath', 'miles platting', 'beswick', 'clayton',
  'reddish', 'heaton', 'urmston', 'flixton', 'davyhulme',
  'irlam', 'walkden', 'worsley', 'pendlebury',
];

// Non-Manchester cities — if address contains these, reject immediately.
// Prevents Hunters-style leaks (London NW6, Penzance, Sheffield, etc.)
const NON_MANCHESTER_CITIES = [
  'london', 'birmingham', 'liverpool', 'leeds', 'sheffield',
  'bristol', 'nottingham', 'newcastle', 'leicester', 'coventry',
  'cardiff', 'edinburgh', 'glasgow', 'belfast', 'southampton',
  'portsmouth', 'brighton', 'plymouth', 'penzance', 'surbiton',
  'barnsley', 'york', 'hull', 'derby', 'stoke', 'reading',
  'oxford', 'cambridge', 'bath', 'exeter', 'norwich', 'luton',
  'sunderland', 'wolverhampton', 'aberdeen', 'dundee', 'swansea',
];

// Manchester postcodes: M1–M60. Anything else (SK, WA, BL, OL, etc.) is
// too broad and lets in Sheffield/Warrington/etc. We keep it strict.
const MCR_POSTCODE_RE = /\bM(\d{1,2})\s*\d[A-Z]{2}\b/i;
const MCR_DISTRICT_RE = /\bM(\d{1,2})\b/i;

function isManchesterArea(address) {
  if (!address) return false;
  const lower = address.toLowerCase();

  // Step 1: reject known non-Manchester cities
  if (NON_MANCHESTER_CITIES.some(city => lower.includes(city))) return false;

  // Step 2: accept if full M-postcode present (M1 0AA through M60 9ZZ)
  const fullMatch = MCR_POSTCODE_RE.exec(address);
  if (fullMatch) {
    const district = parseInt(fullMatch[1]);
    if (district >= 1 && district <= 60) return true;
  }

  // Step 3: accept if M-district code present (M14, M20, etc.)
  const distMatch = MCR_DISTRICT_RE.exec(address);
  if (distMatch) {
    const district = parseInt(distMatch[1]);
    if (district >= 1 && district <= 60) return true;
  }

  // Step 4: accept if a known Manchester area name appears
  if (MANCHESTER_AREAS.some(area => lower.includes(area))) return true;

  // Step 5: default deny
  return false;
}

// ── Image extraction ───────────────────────────────────────────────────────
// Handles lazy-load attributes, srcset, background-image, and plain src.
function extractImage(imgEl) {
  if (!imgEl || !imgEl.length) return '';

  // Try lazy-load attributes first — these have the real URL
  const dataSrc =
    imgEl.attr('data-src') ||
    imgEl.attr('data-lazy-src') ||
    imgEl.attr('data-lazy') ||
    imgEl.attr('data-original') ||
    imgEl.attr('data-image') ||
    imgEl.attr('data-url') ||
    '';

  if (dataSrc && !dataSrc.startsWith('data:')) return dataSrc;

  // Try srcset (pick the largest image — last entry)
  const srcsetRaw = imgEl.attr('srcset') || imgEl.attr('data-srcset') || '';
  if (srcsetRaw) {
    const entries = srcsetRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (entries.length) {
      // Pick last entry (usually largest), strip width descriptor
      const best = entries[entries.length - 1].split(' ')[0];
      if (best && !best.startsWith('data:')) return best;
    }
  }

  // Fall back to src — but SKIP if it's a data URI placeholder
  const src = imgEl.attr('src') || '';
  if (src && !src.startsWith('data:')) return src;

  return '';
}

// Extract background-image URL from a Cheerio element's style attribute
function extractBgImage(el) {
  if (!el || !el.length) return '';
  const style = el.attr('style') || '';
  const m = style.match(/background-image\s*:\s*url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
  return m ? m[1] : '';
}

// ── Price parsing ──────────────────────────────────────────────────────────
// "£1,250 pcm" → 1250
function parsePrice(str = '') {
  const match = str.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

// ── Beds parsing ───────────────────────────────────────────────────────────
// "3 bedroom" / "3 bed" / "Studio" → 0/1/2/3
function parseBeds(str = '') {
  const s = str.toLowerCase();
  if (s.includes('studio')) return 0;
  const m = s.match(/(\d+)\s*bed/);
  return m ? parseInt(m[1]) : 1;
}

// ── Type guessing ──────────────────────────────────────────────────────────
function parseType(str = '') {
  const s = str.toLowerCase();
  if (s.includes('studio')) return 'studio';
  if (s.includes('house')) return 'house';
  if (s.includes('terraced')) return 'house';
  if (s.includes('semi')) return 'house';
  if (s.includes('detached')) return 'house';
  if (s.includes('bungalow')) return 'house';
  if (s.includes('maisonette')) return 'maisonette';
  return 'flat';
}

// ── Postcode extraction ────────────────────────────────────────────────────
function extractPostcode(str = '') {
  const m = str.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i);
  return m ? m[0].toUpperCase() : '';
}

// ── Area guessing ──────────────────────────────────────────────────────────
function guessArea(address = '', postcode = '') {
  const s = (address + ' ' + postcode).toLowerCase();
  if (s.includes('chorlton')) return 'Chorlton';
  if (s.includes('didsbury')) return 'Didsbury';
  if (s.includes('fallowfield')) return 'Fallowfield';
  if (s.includes('withington')) return 'Withington';
  if (s.includes('levenshulme')) return 'Levenshulme';
  if (s.includes('rusholme')) return 'Rusholme';
  if (s.includes('hulme')) return 'Hulme';
  if (s.includes('ancoats')) return 'Ancoats';
  if (s.includes('northern quarter')) return 'Northern Quarter';
  if (s.includes('whalley range')) return 'Whalley Range';
  if (s.includes('stretford')) return 'Stretford';
  if (s.includes('salford quays') || s.includes('mediacity')) return 'Salford Quays';
  if (s.includes('salford')) return 'Salford';
  if (s.includes('sale')) return 'Sale';
  if (s.includes('altrincham')) return 'Altrincham';
  if (s.includes('stockport')) return 'Stockport';
  if (s.includes('moss side')) return 'Moss Side';
  if (s.includes('old trafford')) return 'Old Trafford';
  if (s.includes('burnage')) return 'Burnage';
  if (s.includes('longsight')) return 'Longsight';
  if (s.includes('gorton')) return 'Gorton';
  if (s.includes('reddish')) return 'Reddish';
  if (s.includes('prestwich')) return 'Prestwich';
  if (s.includes('eccles')) return 'Eccles';
  if (s.includes('urmston')) return 'Urmston';
  if (s.includes('m20') || s.includes('m21')) return 'Didsbury';
  if (s.includes('m14') || s.includes('m15')) return 'Fallowfield';
  if (s.includes('m16')) return 'Chorlton';
  if (s.includes('m19')) return 'Levenshulme';
  if (s.includes('m1 ') || s.includes('m2 ') || s.includes('m3 ') || s.includes('m4 ')) return 'City Centre';
  return 'Manchester';
}

// ── Title generation ───────────────────────────────────────────────────────
// Scrapers often leave title empty. This builds a useful one from components.
// "2 Bed Flat in Didsbury" or "Studio in Ancoats"
function generateTitle(street, beds, type, area) {
  const bedStr = beds === 0 ? 'Studio' : `${beds} Bed`;
  const typeStr = (beds === 0) ? '' : ` ${(type || 'flat').charAt(0).toUpperCase() + (type || 'flat').slice(1)}`;
  const areaStr = area && area !== 'Manchester' ? ` in ${area}` : (street ? '' : ' in Manchester');
  return `${bedStr}${typeStr}${areaStr}`;
}

// ── Feature detection ──────────────────────────────────────────────────────
function hasFeature(text = '', keywords = []) {
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k));
}

// ── Card finder ────────────────────────────────────────────────────────────
function findCards($, selectors) {
  for (const sel of selectors) {
    const found = $(sel).toArray();
    if (found.length) return found;
  }
  return [];
}

module.exports = {
  fetchHTML, extractImage, extractBgImage,
  parsePrice, parseBeds, parseType,
  extractPostcode, guessArea, hasFeature,
  findCards, isManchesterArea, generateTitle,
};
