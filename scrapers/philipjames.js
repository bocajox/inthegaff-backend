const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.philipjames.co.uk';

module.exports = {
  id:      'philipjames',
  name:    'Philip James',
  website: BASE,
  areas:   ['Didsbury', 'Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    let   page     = 1;

    while (true) {
      const url = `${BASE}/properties/to-rent/?page=${page}`;
      const $   = await fetchHTML(url);

      const cards = $('.property, .property-card, [class*="PropertyCard"], .listing-item').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a[href*="propert"]').first();
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
          balcony:     hasFeature(desc, ['balcony', 'terrace']),
          listingUrl:  fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next').length > 0;
      if (!hasNext || page >= 15) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
