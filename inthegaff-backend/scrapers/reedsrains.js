const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.reedsrains.co.uk';

module.exports = {
  id:      'reedsrains',
  name:    'Reeds Rains',
  website: BASE,
  areas:   ['Didsbury', 'Chorlton', 'Sale', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    // Reeds Rains uses area-slug search pages
    const searches = [
      `${BASE}/property-to-rent/manchester`,
      `${BASE}/property-to-rent/chorlton`,
      `${BASE}/property-to-rent/didsbury`,
    ];

    for (const baseUrl of searches) {
      let page = 1;
      while (true) {
        const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
        let $;
        try {
          $ = await fetchHTML(url);
        } catch (e) {
          break; // 404 or network error — try next search
        }

        const cards = $(
          '[class*="property-card"], .property-card, .search-result-item, ' +
          '[class*="PropertyCard"], [class*="listing-card"], article.property'
        ).toArray();
        if (!cards.length) break;

        for (const card of cards) {
          const el      = $(card);
          const link    = el.find('a[href*="/property/"], a[href*="/to-rent/"]').first();
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
            parking:     hasFeature(desc, ['parking']),
            pets:        hasFeature(desc, ['pets']),
            garden:      hasFeature(desc, ['garden']),
            balcony:     hasFeature(desc, ['balcony']),
            listingUrl:  fullUrl,
          });
        }

        const hasNext = $('a[rel="next"], [class*="pagination"] a:contains("Next"), [aria-label="Next page"]').length > 0;
        if (!hasNext || page >= 8) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
