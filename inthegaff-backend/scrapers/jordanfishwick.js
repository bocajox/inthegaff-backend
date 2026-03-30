const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://jordanfishwick.co.uk';

module.exports = {
  id: 'jordanfishwick',
  name: 'Jordan Fishwick',
  website: BASE,
  areas: ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Altrincham'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/search/?department=residential-lettings`
        : `${BASE}/search/page/${page}/?department=residential-lettings`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      let cards = $('a.card').toArray();
      if (!cards.length) cards = $('ul.properties li, .propertyhive-property').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        let href = el.is('a') ? el.attr('href') : el.find('a').first().attr('href') || '';
        if (!href) continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('.price.h5, .price, [class*="price"]').first().text().trim();
        const address = el.find('h5.card-title, .card-title, [class*="address"], h2, h3').first().text().trim();
        const bedsStr = el.find('p.ms-2.me-3.mb-0, .beds, [class*="bed"]').first().text().trim();
        const imgSrc = extractImage(el.find('img').first());

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(bedsStr || address),
          type: parseType(address),
          area,
          street: address,
          postcode,
          description: '',
          photos: imgSrc ? [imgSrc] : [],
          features: [],
          furnished: hasFeature(address, ['furnished']),
          parking:   hasFeature(address, ['parking', 'garage']),
          pets:      hasFeature(address, ['pets']),
          garden:    hasFeature(address, ['garden']),
          balcony:   hasFeature(address, ['balcony', 'terrace']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('.propertyhive-pagination a.next, a[rel="next"], .next-page').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
