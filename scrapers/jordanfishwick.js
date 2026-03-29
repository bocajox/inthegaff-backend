const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://jordanfishwick.co.uk';

module.exports = {
  id:      'jordanfishwick',
  name:    'Jordan Fishwick',
  website: BASE,
  areas:   ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Altrincham'],

  async scrape() {
    const listings = [];
    let   page     = 1;

    while (true) {
      const url = `${BASE}/properties/?type=to-let&page=${page}`;
      const $   = await fetchHTML(url);

      const cards = $('.property-item, .property-card, [class*="PropertyItem"], article.listing').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a').first();
        const href    = link.attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId   = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim();
        const address  = el.find('[class*="address"], [class*="title"], h2, h3').first().text().trim();
        const bedsStr  = el.find('[class*="beds"], [class*="bedroom"]').first().text().trim();
        const imgSrc   = el.find('img').first().attr('src') || el.find('img').first().attr('data-src') || '';

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area     = guessArea(address, postcode);

        listings.push({
          externalId:  extId,
          title:       address,
          price,
          beds:        parseBeds(bedsStr || address),
          type:        parseType(address),
          area,
          street:      address,
          postcode,
          description: el.find('p').first().text().trim(),
          photos:      imgSrc ? [imgSrc] : [],
          features:    [],
          furnished:   false,
          parking:     false,
          pets:        false,
          garden:      false,
          balcony:     false,
          listingUrl:  fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next-page, [class*="pagination"] .next').length > 0;
      if (!hasNext || page >= 15) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
