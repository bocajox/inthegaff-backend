const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://peteranthony.co.uk';

const MANCHESTER_KEYWORDS = [
  'manchester', 'salford', 'chorlton', 'didsbury', 'withington',
  'fallowfield', 'rusholme', 'levenshulme', 'burnage', 'longsight',
  'gorton', 'hulme', 'moss side', 'old trafford', 'stretford',
  'whalley range', 'ancoats', 'ardwick', 'openshaw', 'beswick',
  'collyhurst', 'moston', 'harpurhey', 'crumpsall', 'cheetham',
  'stockport', 'heaton', 'reddish', 'edgeley',
];

const MANCHESTER_POSTCODE_RE = /\b(M\d{1,2}|SK\d{1,2}|WA\d{1,2})\b/i;

function isManchesterArea(text) {
  const lower = (text || '').toLowerCase();
  if (MANCHESTER_KEYWORDS.some(k => lower.includes(k))) return true;
  if (MANCHESTER_POSTCODE_RE.test(text)) return true;
  return false;
}

module.exports = {
  id: 'peteranthony',
  name: 'Peter Anthony',
  website: BASE,
  areas: ['Levenshulme', 'Burnage', 'Fallowfield', 'Rusholme', 'Longsight', 'Gorton', 'Stockport'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    const locationPages = [
      `${BASE}/rent/property/for-rent/all-beds/houses-apartments/manchester/`,
      `${BASE}/rent/property/for-rent/all-beds/houses-apartments/levenshulme/`,
      `${BASE}/rent/property/for-rent/all-beds/houses-apartments/stockport/`,
      `${BASE}/rent/property/for-rent/all-beds/houses-apartments/salford/`,
      `${BASE}/rent/property/for-rent/all-beds/houses-apartments/fallowfield/`,
    ];

    const fallbackUrls = [
      `${BASE}/property-search/?department=residential-lettings`,
      `${BASE}/search/?department=residential-lettings`,
      `${BASE}/properties/to-let/`,
    ];

    for (const baseUrl of [...locationPages, ...fallbackUrls]) {
      let page = 1;

      while (true) {
        let url;
        if (page === 1) {
          url = baseUrl;
        } else {
          if (baseUrl.includes('/rent/property/')) {
            url = baseUrl.replace(/\/$/, '') + `/${page}`;
          } else {
            const base = baseUrl.split('?')[0];
            const params = baseUrl.includes('?') ? '?' + baseUrl.split('?')[1] : '';
            url = `${base}page/${page}/${params}`;
          }
        }

        let $;
        try { $ = await fetchHTML(url); } catch (e) { break; }

        let cards = $('[class*="property-card"], [class*="property_card"], .property-listing, .property-item').toArray();
        if (!cards.length) cards = $('ul.properties li, .propertyhive-property, article.property').toArray();
        if (!cards.length) {
          cards = $('a.card, .card').filter((i, el) => {
            const $el = $(el);
            return ($el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                   ($el.find('a').length > 0 || $el.is('a'));
          }).toArray();
        }
        if (!cards.length) {
          cards = $('div, article, li').filter((i, el) => {
            const $el = $(el);
            const hasLink = $el.find('a[href*="/property/"], a[href*="/rent/"], a[href*="/properties/"]').length > 0;
            const hasPrice = $el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0;
            return hasLink && hasPrice && $el.find('img').length > 0 &&
                   $el.children().length >= 2 && $el.children().length < 20 && $el.text().length < 2000;
          }).toArray();
        }
        if (!cards.length) break;

        let foundAny = false;
        for (const card of cards) {
          try {
            const el = $(card);
            const link = el.is('a') ? el : el.find('a[href*="/property/"], a[href*="/rent/"], a[href*="/properties/"], a').first();
            const href = link.attr('href') || el.find('a').first().attr('href') || '';
            if (!href || href === '#') continue;
            const fullUrl = href.startsWith('http') ? href : BASE + href;
            if (seen.has(fullUrl)) continue;
            seen.add(fullUrl);
            const extId = href.replace(/\/$/, '').split('/').pop() || href;
            const priceStr = el.find('.price, [class*="price"]').first().text().trim() ||
                            el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm|PCM|PM)?/)?.[0] || '';
            const price = parsePrice(priceStr);
            if (!price || price > 10000) continue;
            const address = el.find('.address, [class*="address"], h2, h3, h4, h5, .card-title, [class*="title"]').first().text().trim();
            if (!isManchesterArea(address) && !isManchesterArea(el.text())) continue;
            const bedsStr = el.find('[class*="bed"]').first().text().trim();
            const imgSrc = extractImage(el.find('img').first());
            const postcode = extractPostcode(address);
            const area = guessArea(address, postcode);
            const desc = el.find('p, [class*="desc"]').first().text().trim();
            listings.push({
              externalId: extId, title: address, price, beds: parseBeds(bedsStr || address),
              type: parseType(address), area, street: address, postcode, description: desc,
              photos: imgSrc ? [imgSrc] : [], features: [],
              furnished: hasFeature(desc, ['furnished']), parking: hasFeature(desc, ['parking', 'garage']),
              pets: hasFeature(desc, ['pets']), garden: hasFeature(desc, ['garden']),
              balcony: hasFeature(desc, ['balcony', 'terrace']), listingUrl: fullUrl,
            });
            foundAny = true;
          } catch (e) { continue; }
        }
        if (!foundAny) break;
        const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"], .pagination a').length > 0;
        if (!hasNext || page >= 5) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    return listings;
  },
};
