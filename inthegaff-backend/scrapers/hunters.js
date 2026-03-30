const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.hunters.com';

module.exports = {
  id: 'hunters',
  name: 'Hunters',
  website: BASE,
  areas: ['Manchester City Centre', 'Salford Quays', 'Hulme', 'Chorlton', 'Didsbury'],

  async scrape() {
    const listings = [];

    // Hunters uses search-results pages
    const urls = [
      `${BASE}/search-results/to-let/?location=Manchester`,
      `${BASE}/search-results/to-let/Manchester/`,
      `${BASE}/property-for-rent/search?location=Manchester`,
    ];

    let $ = null;
    let workingUrl = null;
    for (const url of urls) {
      try {
        $ = await fetchHTML(url);
        if ($.text().includes('\u00a3') || $('[class*="property"]').length > 0) {
          workingUrl = url;
          break;
        }
      } catch (e) { continue; }
    }
    if (!workingUrl || !$) return listings;

    let page = 1;
    while (true) {
      if (page > 1) {
        const sep = workingUrl.includes('?') ? '&' : '?';
        try { $ = await fetchHTML(`${workingUrl}${sep}page=${page}`); } catch (e) { break; }
      }

      let cards = $('[class*="PropertyCard"], [class*="property-card"], [class*="property_card"], article[class*="property"]').toArray();
      if (!cards.length) {
        cards = $('article, .card, div').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="/property"]').length > 0
            && $el.text().includes('\u00a3')
            && $el.find('img').length > 0;
        }).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el = $(card);
        const link = el.find('a[href*="/property/"], a[href*="/to-let/"]').first();
        const href = link.attr('href') || el.find('a').first().attr('href') || '';
        if (!href || href === '#') continue;
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim()
          || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
        const address = el.find('[class*="address"], [class*="Address"], h2, h3').first().text().trim();
        const bedsStr = el.find('[class*="bed"], [class*="Bed"]').first().text().trim();
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

      const hasNext = $('a[rel="next"], [aria-label="Next"], .next').length > 0;
      if (!hasNext || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
