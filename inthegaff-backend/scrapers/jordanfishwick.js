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

      // Jordan Fishwick uses Bootstrap .card elements (not <a> tags)
      // Cards have class "card text-decoration-none text-body"
      let cards = $('.card').filter((i, el) => {
        const $el = $(el);
        return $el.text().includes('\u00a3') && $el.find('img').length > 0;
      }).toArray();

      if (!cards.length) {
        // Fallback: try PropertyHive selectors
        cards = $('ul.properties li, .propertyhive-property, a.card').toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);

          // Link — card may be an <a>, or find inner <a>
          let href = el.is('a') ? el.attr('href') : el.find('a').first().attr('href') || '';
          if (!href) continue;
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          // Price: .price or [class*="price"]
          const priceStr = el.find('.price, [class*="price"]').first().text().trim()
            || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
          const price = parsePrice(priceStr);
          if (!price) continue;

          // Address: h5.card-title, .card-title, h2, h3
          const address = el.find('h5.card-title, .card-title, h5, h4, h3, h2').first().text().trim();

          // Beds
          const bedsStr = el.find('[class*="bed"], .beds').first().text().trim()
            || el.text().match(/(\d+)\s*bed/i)?.[0] || '';

          // Image
          const imgSrc = extractImage(el.find('img').first());

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
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], .next, .pagination .next, a:contains("Next")').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
