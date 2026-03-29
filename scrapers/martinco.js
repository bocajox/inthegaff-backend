const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.martinco.com';

module.exports = {
  id:      'martinco',
  name:    'Martin & Co',
  website: BASE,
  areas:   ['Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    let   page     = 1;

    while (true) {
      const url = `${BASE}/branch/manchester-chorlton/properties/let/?page=${page}`;
      const $   = await fetchHTML(url);

      const cards = $('[class*="property-card"], .property-card, article.property, [data-property]').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a').first();
        const href    = link.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId   = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim();
        const address  = el.find('[class*="address"], h2, h3').first().text().trim();
        const bedsStr  = el.find('[class*="bed"]').first().text().trim();
        const imgSrc   = el.find('img').first().attr('src') || '';

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area     = guessArea(address, postcode);
        const desc     = el.find('[class*="desc"], p').first().text().trim();

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

      const hasNext = $('a[rel="next"], .pagination .next').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
