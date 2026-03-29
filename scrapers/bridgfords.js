const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.bridgfords.co.uk';

module.exports = {
  id:      'bridgfords',
  name:    'Bridgfords',
  website: BASE,
  areas:   ['Chorlton', 'Levenshulme', 'Manchester City Centre', 'Salford'],

  async scrape() {
    const listings = [];
    // Bridgfords uses branch-specific pages
    const branchUrls = [
      `${BASE}/greater-manchester/chorlton/lettings`,
      `${BASE}/greater-manchester/levenshulme/lettings`,
      `${BASE}/greater-manchester/manchester/lettings`,
    ];

    for (const branchUrl of branchUrls) {
      let page = 1;
      while (true) {
        const url = `${branchUrl}?page=${page}`;
        const $   = await fetchHTML(url);

        const cards = $('[class*="PropertyCard"], .property-card, .property-result, [data-testid*="property"]').toArray();
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
          const imgSrc   = el.find('img').first().attr('src') || el.find('img').first().attr('data-src') || '';

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

        const hasNext = $('a[rel="next"], [aria-label="Next page"]').length > 0;
        if (!hasNext || page >= 10) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
  },
};
