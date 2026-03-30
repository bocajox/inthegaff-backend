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

// Extract best available image src from an img element
// FIX: prioritise data-src over src, and skip data: URIs (lazy-load placeholders)
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

  // Try srcset (first entry)
  const srcset = (imgEl.attr('srcset') || imgEl.attr('data-srcset') || '').split(',')[0].trim().split(' ')[0];
  if (srcset && !srcset.startsWith('data:')) return srcset;

  // Fall back to src — but SKIP if it's a data URI placeholder
  const src = imgEl.attr('src') || '';
  if (src && !src.startsWith('data:')) return src;

  return '';
}

// Parse "£1,250 pcm" → 1250
function parsePrice(str = '') {
  const match = str.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

// Parse "3 bedroom" / "3 bed" / "Studio" → 0/1/2/3
function parseBeds(str = '') {
  const s = str.toLowerCase();
  if (s.includes('studio')) return 0;
  const m = s.match(/(\d+)\s*bed/);
  return m ? parseInt(m[1]) : 1;
}

// Guess type from title/description
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

// Extract postcode from address string
function extractPostcode(str = '') {
  const m = str.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i);
  return m ? m[0].toUpperCase() : '';
}

// Guess South Manchester area from address/postcode
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
  if (s.includes('sale')) return 'Sale';
  if (s.includes('altrincham')) return 'Altrincham';
  if (s.includes('stockport')) return 'Stockport';
  if (s.includes('moss side')) return 'Moss Side';
  if (s.includes('old trafford')) return 'Old Trafford';
  if (s.includes('burnage')) return 'Burnage';
  if (s.includes('longsight')) return 'Longsight';
  if (s.includes('gorton')) return 'Gorton';
  if (s.includes('m20') || s.includes('m21')) return 'Didsbury';
  if (s.includes('m14') || s.includes('m15')) return 'Fallowfield';
  if (s.includes('m16')) return 'Chorlton';
  if (s.includes('m19')) return 'Levenshulme';
  return 'Manchester';
}

// Check if description mentions feature
function hasFeature(text = '', keywords = []) {
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k));
}

// Generic property-card selector — tries many common patterns
// Returns the first non-empty NodeList from a list of selector strings
function findCards($, selectors) {
  for (const sel of selectors) {
    const found = $(sel).toArray();
    if (found.length) return found;
  }
  return [];
}

module.exports = {
  fetchHTML, extractImage,
  parsePrice, parseBeds, parseType,
  extractPostcode, guessArea, hasFeature,
  findCards,
};
