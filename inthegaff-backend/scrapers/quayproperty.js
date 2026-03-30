const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.quayproperty.com';

module.exports = {
  id: 'quayproperty',
  name: 'Quay Property',
  website: BASE,
  areas: ['Salford Quays', 'MediaCity', 'Castlefield', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/search/?department=residential-lettings`
        : `${BASE}/search/page/${page}/?department=residential-lettings`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      let cards = $('[class*="property-card"], [class*="property_card"], .property, ul.properties li, a.card').toArray();
      if (!cards.length) {
        cards = $('article, .card, div').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="propert"]').length > 0
            && $el.text().includes('\u00a3')
            && $el.find('img').length > 0;
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const link = el.is('a') ? el : el.find('a[href*="propert"], a').first();
        const href = link.attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const address = el.find('[class*="address"], h2, h3, h4, .card-title').first().text().trim();
        const bedsStr = el.find('[class*="bed"]').first().text().trim();
        const imgSrc = extractImage(el.find('img').first());

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);
        const desc = el.find('p, [class*="desc"]').first().text().trim();

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(bedsStr || address),
          type: parseType(address),
          area,
          street: address,
          postcode,
          description: desc,
          photos: imgSrc ? [imgSrc] : [],
          features: [],
          furnished: hasFeature(desc, ['furnished']),
          parking:   hasFeature(desc, ['parking']),
          pets:      hasFeature(desc, ['pets']),
          garden:    hasFeature(desc, ['garden']),
          balcony:   hasFeature(desc, ['balcony']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .next, .propertyhive-pagination .next').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
