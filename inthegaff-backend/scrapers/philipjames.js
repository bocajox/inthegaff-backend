const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.philipjames.co.uk';

module.exports = {
  id:      'philipjames',
  name:    'Philip James',
  website: BASE,
  areas:   ['Didsbury', 'Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    // Philip James updated their URL — try both patterns
    const candidates = [
      `${BASE}/properties/to-rent/`,
      `${BASE}/property/to-rent/`,
      `${BASE}/lettings/`,
      `${BASE}/search/?type=lettings`,
    ];

    let workingBase = null;
    for (const url of candidates) {
      try {
        const $ = await fetchHTML(url);
        if ($('body').text().length > 500) { workingBase = url; break; }
      } catch (e) { continue; }
    }
    if (!workingBase) return listings;

    let page = 1;
    while (true) {
      const sep = workingBase.includes('?') ? '&' : '?';
      const url = page === 1 ? workingBase : `${workingBase}${sep}page=${page}`;
      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      let cards = $(
        '.property, .property-card, [class*="PropertyCard"], [class*="property-card"], ' +
        '.listing-item, [class*="listing-card"], article.property, article[class*="prop"]'
      ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

      if (!cards.length) {
        cards = $('article, li.result, .result').filter((i, el) =>
          $(el).find('[class*="price"]').length > 0
        ).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const link    = el.find('a[href*="propert"], a[href*="rent"], a[href*="let"]').first();
        const href    = link.attr('href') || el.find('a').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const extId   = href.replace(/\/$/, '').split('/').pop() || href;

        const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim();
        const address  = el.find('[class*="address"], [class*="Address"], h2, h3').first().text().trim();
        const bedsStr  = el.find('[class*="bed"], [class*="Bed"]').first().text().trim();
        const imgSrc   = extractImage(el.find('img').first());

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

      const hasNext = $('a[rel="next"], .next, [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 15) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
