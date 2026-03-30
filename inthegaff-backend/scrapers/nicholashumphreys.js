const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.nicholashumphreys.com';

module.exports = {
  id: 'nicholashumphreys',
  name: 'Nicholas Humphreys',
  website: BASE,
  areas: ['Fallowfield', 'Withington', 'Rusholme', 'Didsbury'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/properties/in-manchester/?department=residential-lettings`
        : `${BASE}/properties/in-manchester/page/${page}/?department=residential-lettings`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      let cards = $('[class*="property--card"], [class*="property-card"], .property-card').toArray();
      if (!cards.length) {
        cards = $('div, article').filter((i, el) => {
          const $el = $(el);
          return $el.find('img.property--card__image, img[class*="property"]').length > 0
            && $el.find('a[href*="/property/"]').length > 0;
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const statusText = el.text();
        if (statusText.includes('For Sale') && !statusText.includes('To Let')) continue;

        const link = el.find('a[href*="/property/"]').first();
        const href = link.attr('href') || '';
        if (!href) continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceMatch = el.text().match(/£([\d,]+)\s*(?:PCM|pcm|pm)/);
        const priceStr = priceMatch ? priceMatch[0] : el.find('[class*="price"]').first().text().trim();
        const address = el.find('[class*="address"], h2, h3, h4, h5').first().text().trim()
          || el.find('img.property--card__image').attr('alt') || '';
        const bedsMatch = el.text().match(/(\d+)\s*bedroom/i);
        const bedsStr = bedsMatch ? bedsMatch[0] : '';

        const img = el.find('img.property--card__image, img[class*="property"]').first();
        const imgSrc = extractImage(img);

        const price = parsePrice(priceStr);
        if (!price) continue;

        const postcode = extractPostcode(address);
        const area = guessArea(address, postcode);

        listings.push({
          externalId: extId,
          title: address,
          price,
          beds: parseBeds(bedsStr || address),
          type: parseType(el.text()),
          area,
          street: address,
          postcode,
          description: '',
          photos: imgSrc ? [imgSrc] : [],
          features: [],
          furnished: hasFeature(statusText, ['furnished']),
          parking:   hasFeature(statusText, ['parking']),
          pets:      hasFeature(statusText, ['pets']),
          garden:    hasFeature(statusText, ['garden']),
          balcony:   hasFeature(statusText, ['balcony']),
          listingUrl: fullUrl,
        });
      }

      const hasNext = $('a:contains("Next"), a[rel="next"], .next').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
