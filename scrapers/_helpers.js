// Shared helpers used across scrapers

const axios   = require('axios');
const cheerio = require('cheerio');

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
};

async function fetchHTML(url, extraHeaders = {}) {
  const { data } = await axios.get(url, {
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    timeout: 15000,
  });
  return cheerio.load(data);
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
  if (s.includes('studio'))   return 'studio';
  if (s.includes('house'))    return 'house';
  if (s.includes('terraced')) return 'house';
  if (s.includes('semi'))     return 'house';
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
  if (s.includes('chorlton'))      return 'Chorlton';
  if (s.includes('didsbury'))      return 'Didsbury';
  if (s.includes('fallowfield'))   return 'Fallowfield';
  if (s.includes('withington'))    return 'Withington';
  if (s.includes('levenshulme'))   return 'Levenshulme';
  if (s.includes('rusholme'))      return 'Rusholme';
  if (s.includes('hulme'))         return 'Hulme';
  if (s.includes('ancoats'))       return 'Ancoats';
  if (s.includes('northern quarter')) return 'Northern Quarter';
  if (s.includes('whalley range')) return 'Whalley Range';
  if (s.includes('stretford'))     return 'Stretford';
  if (s.includes('salford quays') || s.includes('mediacity')) return 'Salford Quays';
  if (s.includes('sale'))          return 'Sale';
  if (s.includes('altrincham'))    return 'Altrincham';
  if (s.includes('stockport'))     return 'Stockport';
  if (s.includes('moss side'))     return 'Moss Side';
  if (s.includes('old trafford'))  return 'Old Trafford';
  if (s.includes('burnage'))       return 'Burnage';
  if (s.includes('longsight'))     return 'Longsight';
  if (s.includes('gorton'))        return 'Gorton';
  if (s.includes('m20') || s.includes('m21')) return 'Didsbury';
  if (s.includes('m14') || s.includes('m15')) return 'Fallowfield';
  if (s.includes('m16'))           return 'Chorlton';
  if (s.includes('m19'))           return 'Levenshulme';
  return 'Manchester';
}

// Check if description mentions feature
function hasFeature(text = '', keywords = []) {
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k));
}

module.exports = { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature };
