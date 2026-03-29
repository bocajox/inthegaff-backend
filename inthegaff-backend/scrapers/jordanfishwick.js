const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://jordanfishwick.co.uk';

// Extra headers that mimic a real browser visit more convincingly
const EXTRA = {
  'Referer':    'https://www.google.co.uk/',
  'Connection': 'keep-alive',
};

module.exports = {
  id:      'jordanfishwick',
  name:    'Jordan Fishwick',
  website: BASE,
  areas:   ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Altrincham'],

  async scrape() {
    const listings = [];
    // Try multiple URL patterns — they changed their site structure
    const candidates = [
      `${BASE}/properties/lettings/`,
      `${BASE}/properties/to-rent/`,
      `${BASE}/property/to-let/`,
      `${BASE}/search/?type=to-let`,
      `${BASE}/properties/?type=to-let`,
    ];

    let workingBase = null;
    for (const url of candidates) {
      try {
        const $ = await fetchHTML(url, EXTRA);
        if ($('body').text().length > 500) { workingBase = url; break; }
      } catch (e) { continue; }
    }
    if (!workingBase) return listings;

    let page = 1;
    while (true) {
      const sep = workingBase.includes('?') ? '&' : '?';
      const url = page === 1 ? workingBase : `${workingBase}${sep}page=${page}`;
      let $;
      try {
        $ = await fetchHTML(url, EXTRA);
      } catch (e) { break; }

      const cards = $(
        '.property-item, .property-card, [class*="PropertyItem"], [class*="PropertyCard"], ' +
        'article.listing, article.property, [class*="property-result"], [class*="listing-card"]'
      ).toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a').first();
        const href    = link.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId   = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim();
        const address  = el.find('[class*="address"], [class*="title"], [class*="Address"], h2, h3').first().text().trim();
        const bedsStr  = el.find('[class*="beds"], [class*="bedroom"], [class*="Bed"]').first().text().trim();
        const imgSrc   = extractImage(el.find('img').first());

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area     = guessArea(address, postcode);
        const desc     = el.find('p').first().text().trim();

        listings.push({
          externalId:  extId,
          title:       address,
          price,
          beds:        parseBeds(bedsStr || address),
          type:        parseType(address),
          area,
          street:      address,
          postcode,
          description: desc,
          photos:      imgSrc ? [imgSrc] : [],
          features:    [],
          furnished:   hasFeature(desc + address, ['furnished']),
          parking:     hasFeature(desc + address, ['parking', 'garage']),
          pets:        hasFeature(desc + address, ['pets considered', 'pets welcome']),
          garden:      hasFeature(desc + address, ['garden']),
          balcony:     hasFeature(desc + address, ['balcony', 'terrace']),
          listingUrl:  fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next-page, [class*="pagination"] .next, [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 15) break;
      page++;
      await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
  },
};
