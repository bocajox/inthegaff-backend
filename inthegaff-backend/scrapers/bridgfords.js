const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.bridgfords.co.uk';

// Bridgfords has bot protection — these extra headers help look like a real browser
const EXTRA = {
  'Referer':    'https://www.google.co.uk/search?q=bridgfords+manchester+lettings',
  'Connection': 'keep-alive',
  'DNT':        '1',
};

module.exports = {
  id:      'bridgfords',
  name:    'Bridgfords',
  website: BASE,
  areas:   ['Chorlton', 'Levenshulme', 'Manchester City Centre', 'Salford'],

  async scrape() {
    const listings = [];
    // Try their search-based URL first, then branch pages
    const branchUrls = [
      `${BASE}/property/to-rent/search/?q=Manchester`,
      `${BASE}/greater-manchester/chorlton/lettings`,
      `${BASE}/greater-manchester/levenshulme/lettings`,
      `${BASE}/greater-manchester/manchester/lettings`,
    ];

    for (const branchUrl of branchUrls) {
      let page = 1;
      while (true) {
        const sep = branchUrl.includes('?') ? '&' : '?';
        const url = page === 1 ? branchUrl : `${branchUrl}${sep}page=${page}`;
        let $;
        try {
          $ = await fetchHTML(url, EXTRA);
        } catch (e) {
          break; // 403 or 404 — skip this branch
        }

        const cards = $(
          '[class*="PropertyCard"], .property-card, .property-result, ' +
          '[data-testid*="property"], [class*="property-item"], article.property'
        ).toArray();
        if (!cards.length) break;

        for (const card of cards) {
          const el      = $(card);
          const link    = el.find('a[href*="/property/"]').first();
          const href    = link.attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId   = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim();
          const address  = el.find('[class*="address"], [class*="Address"], h2, h3').first().text().trim();
          const bedsStr  = el.find('[class*="bed"], [class*="Bed"]').first().text().trim();
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
            furnished:   hasFeature(desc, ['furnished']),
            parking:     hasFeature(desc, ['parking', 'garage']),
            pets:        hasFeature(desc, ['pets']),
            garden:      hasFeature(desc, ['garden']),
            balcony:     hasFeature(desc, ['balcony']),
            listingUrl:  fullUrl,
          });
        }

        const hasNext = $('a[rel="next"], [aria-label="Next page"], [aria-label="Next"]').length > 0;
        if (!hasNext || page >= 10) break;
        page++;
        await new Promise(r => setTimeout(r, 2000));
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
  },
};
