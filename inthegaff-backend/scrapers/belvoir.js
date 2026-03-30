const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.belvoir.co.uk';

module.exports = {
  id: 'belvoir',
  name: 'Belvoir Manchester',
  website: BASE,
  areas: ['Manchester City Centre', 'Salford', 'Hulme', 'Ardwick', 'Rusholme'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/estate-agents-and-letting-agents/branch/manchester-central/property-to-rent/`
        : `${BASE}/estate-agents-and-letting-agents/branch/manchester-central/property-to-rent/?page=${page}`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      const cards = $('.property-card').toArray();
      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.find('a[href*="/properties-for-letting/"]').first();
          const href = link.attr('href') || el.find('a').first().attr('href') || '';
          if (!href || href === '#') continue;
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || 'belvoir-' + listings.length;

          const priceStr = el.find('.property-price--search, .property-price, [class*="price"]').first().text().trim();
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          const address = el.find('.property-title--search, .property-title, [class*="title"]').first().text().trim();
          if (!address) continue;

          const img = el.find('img').first();
          const imgSrc = img.attr('src') || img.attr('data-src') || '';
          const photo = imgSrc && !imgSrc.startsWith('data:') ? (imgSrc.startsWith('http') ? imgSrc : 'https:' + imgSrc) : '';

          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);

          listings.push({
            externalId: extId,
            title: address,
            price,
            beds: parseBeds(el.text()),
            type: parseType(el.text()),
            area,
            street: address,
            postcode,
            description: address,
            photos: photo ? [photo] : [],
            features: [],
            furnished: null,
            parking: false,
            pets: false,
            garden: false,
            balcony: false,
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a[rel="next"], .next, [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
