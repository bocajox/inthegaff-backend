const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.hunters.com';

module.exports = {
  id:      'hunters',
  name:    'Hunters',
  website: BASE,
  areas:   ['Manchester City Centre', 'Salford Quays', 'Hulme', 'Chorlton', 'Didsbury'],

  async scrape() {
    const listings = [];
    // Hunters uses office-specific pages — try multiple South Manchester offices
    const searchUrls = [
      `${BASE}/property-for-rent/search?location=Manchester`,
      `${BASE}/office/south-manchester/properties/lettings/`,
      `${BASE}/office/manchester-city-centre/properties/lettings/`,
      `${BASE}/office/manchester/properties/lettings/`,
      `${BASE}/search?type=lettings&location=Manchester`,
    ];

    for (const searchUrl of searchUrls) {
      let page = 1;
      while (true) {
        const sep = searchUrl.includes('?') ? '&' : '?';
        const url = page === 1 ? searchUrl : `${searchUrl}${sep}page=${page}`;
        let $;
        try { $ = await fetchHTML(url); } catch (e) { break; }

        let cards = $(
          '[class*="PropertyCard"], [class*="property-card"], article[class*="property"], ' +
          '[class*="property-result"], [class*="listing-card"], .property, .property-card'
        ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

        if (!cards.length) {
          cards = $('article, .card').filter((i, el) =>
            $(el).find('[class*="price"]').length > 0
          ).toArray();
        }
        if (!cards.length) break;

        for (const card of cards) {
          const el      = $(card);
          const href    = el.find('a[href*="/property/"]').first().attr('href') || el.find('a').first().attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const price   = parsePrice(el.find('[class*="price"]').first().text());
          if (!price) continue;
          const address  = el.find('[class*="address"], h2, h3').first().text().trim();
          const postcode = extractPostcode(address);
          const desc     = el.find('p').first().text().trim();
          listings.push({
            externalId: href.replace(/\/$/, '').split('/').pop() || href,
            title: address, price,
            beds: parseBeds(el.find('[class*="bed"]').first().text() || address),
            type: parseType(address), area: guessArea(address, postcode),
            street: address, postcode, description: desc,
            photos: [extractImage(el.find('img').first())].filter(Boolean),
            features: [],
            furnished: hasFeature(desc, ['furnished']),
            parking:   hasFeature(desc, ['parking']),
            pets:      hasFeature(desc, ['pets']),
            garden:    hasFeature(desc, ['garden']),
            balcony:   hasFeature(desc, ['balcony']),
            listingUrl: fullUrl,
          });
        }
        if (!$('a[rel="next"], [aria-label="Next"]').length || page >= 10) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    return listings;
  },
};
