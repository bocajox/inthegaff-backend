const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://peteranthony.co.uk';

module.exports = {
  id: 'peteranthony',
  name: 'Peter Anthony',
  website: BASE,
  areas: ['Levenshulme', 'Burnage', 'Fallowfield', 'Rusholme', 'Longsight', 'Gorton'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/property-search/?department=residential-lettings`
        : `${BASE}/property-search/page/${page}/?department=residential-lettings`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      let cards = $('ul.properties li, .propertyhive-property, a.card, [class*="property-card"]').toArray();
      if (!cards.length) {
        cards = $('div, article').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="/property/"]').length > 0
            && ($el.text().includes('£') || $el.find('[class*="price"]').length > 0);
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const link = el.is('a') ? el : el.find('a[href*="/property/"]').first();
        const href = link.attr('href') || el.find('a').first().attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('.price, [class*="price"]').first().text().trim()
          || el.text().match(/£[\d,]+/)?.[0] || '';
        const address = el.find('.address, [class*="address"], h2, h3, h4, .card-title').first().text().trim();
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
          parking:   hasFeature(desc, ['parking', 'garage']),
          pets:      hasFeature(desc, ['pets']),
          garden:    hasFeature(desc, ['garden']),
          balcony:   hasFeature(desc, ['balcony', 'terrace']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a[rel="next"], .propertyhive-pagination .next, .next-page').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
