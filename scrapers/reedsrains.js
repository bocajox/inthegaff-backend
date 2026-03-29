const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.reedsrains.co.uk';

module.exports = {
  id:      'reedsrains',
  name:    'Reeds Rains',
  website: BASE,
  areas:   ['Didsbury', 'Salford Quays', 'Chorlton', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    const branches  = [
      'didsbury',
      'salford-quays-city-living',
    ];

    for (const branch of branches) {
      let page = 1;
      while (true) {
        const url = `${BASE}/property-to-rent/${branch}?page=${page}`;
        const $   = await fetchHTML(url);

        const cards = $('[class*="property-card"], .property-card, .search-result-item').toArray();
        if (!cards.length) break;

        for (const card of cards) {
          const el      = $(card);
          const link    = el.find('a[href*="/property/"]').first();
          const href    = link.attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId   = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('[class*="price"]').first().text().trim();
          const address  = el.find('[class*="address"], h2, h3').first().text().trim();
          const bedsStr  = el.find('[class*="bed"]').first().text().trim();
          const imgSrc   = el.find('img').first().attr('src') || el.find('img').first().attr('data-lazy-src') || '';

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

        const hasNext = $('a[rel="next"]').length > 0;
        if (!hasNext || page >= 10) break;
        page++;
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    return listings;
  },
};
