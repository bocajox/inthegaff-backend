const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.hunters.com';

// Manchester postcodes and area keywords for filtering
const MANCHESTER_KEYWORDS = [
  'manchester', 'salford', 'chorlton', 'didsbury', 'fallowfield',
  'withington', 'levenshulme', 'rusholme', 'hulme', 'ancoats',
  'northern quarter', 'whalley range', 'stretford', 'sale',
  'altrincham', 'stockport', 'moss side', 'old trafford',
  'burnage', 'longsight', 'gorton', 'ardwick', 'openshaw',
  'droylsden', 'denton', 'hyde', 'stalybridge', 'ashton',
  'trafford', 'eccles', 'swinton', 'prestwich', 'whitefield',
  'bury', 'bolton', 'rochdale', 'oldham', 'tameside',
  'mediacity', 'castlefield', 'deansgate', 'spinningfields',
  'piccadilly', 'arndale',
];
const MANCHESTER_POSTCODES = /\b(M\d{1,2}|SK\d{1,2}|WA\d{1,2}|BL\d|OL\d|WN\d)\b/i;

function isManchesterArea(address) {
  const lower = address.toLowerCase();
  if (MANCHESTER_KEYWORDS.some(k => lower.includes(k))) return true;
  if (MANCHESTER_POSTCODES.test(address)) return true;
  return false;
}

module.exports = {
  id: 'hunters',
  name: 'Hunters',
  website: BASE,
  areas: ['Manchester City Centre', 'Salford Quays', 'Hulme', 'Chorlton', 'Didsbury'],

  async scrape() {
    const listings = [];

    // Target Manchester-specific branch URL first
    const urls = [
      `${BASE}/estate-agents-and-letting-agents/branch/manchester/property-to-rent/`,
      `${BASE}/search-results/to-let/in-manchester/`,
      `${BASE}/search-results/to-let/?location=Manchester`,
    ];

    let $ = null;
    let workingUrl = null;
    for (const url of urls) {
      try {
        $ = await fetchHTML(url);
        if ($('.property-card, .property--card__results, [class*="property-card"]').length > 0
          || ($('.property-price--search').length > 0)) {
          workingUrl = url;
          break;
        }
        if ($.text().includes('PCM') && $('[class*="property"]').length > 2) {
          workingUrl = url;
          break;
        }
      } catch (e) { continue; }
    }

    if (!workingUrl || !$) return listings;

    let page = 1;
    while (true) {
      if (page > 1) {
        try { $ = await fetchHTML(`${workingUrl}?page=${page}`); } catch (e) { break; }
      }

      let cards = $('.property-card, [class*="property--card__results"]').toArray();
      if (!cards.length) {
        cards = $('div').filter((i, el) => {
          const $el = $(el);
          return ($el.find('.property-price--search').length > 0
            || $el.text().match(/\u00a3[\d,]+\s*PCM/))
            && $el.find('img').length > 0
            && $el.find('a[href*="/propert"]').length > 0
            && $el.children().length >= 2
            && $el.children().length < 15;
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.find('a[href*="/properties-for-letting/"], a[href*="/property"]').first();
          const href = link.attr('href') || el.find('a').first().attr('href') || '';
          if (!href || href === '#') continue;
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('.property-price--search, .property-price, [class*="price"]').first().text().trim();
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          const address = el.find('.property-title--search, .property-title, [class*="title"]').first().text().trim()
            || el.find('h2, h3, h4').first().text().trim();
          if (!address) continue;

          // FIX: Filter to Manchester area only
          if (!isManchesterArea(address)) continue;

          // Use extractImage for proper lazy-load handling
          const img = el.find('img').first();
          const photo = extractImage(img);

          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);

          listings.push({
            externalId: extId,
            title: address,
            price,
            beds: parseBeds(el.text()),
            type: parseType(el.text()),
            area,
            street: address,
            postcode,
            description: '',
            photos: photo ? [photo] : [],
            features: [],
            furnished: null,
            parking: false,
            pets: false,
            garden: false,
            balcony: false,
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], [aria-label="Next"], .next').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
