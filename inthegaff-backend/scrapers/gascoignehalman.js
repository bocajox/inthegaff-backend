const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.gascoignehalman.co.uk';

module.exports = {
  id:      'gascoignehalman',
  name:    'Gascoigne Halman',
  website: BASE,
  areas:   ['Didsbury', 'Chorlton', 'Sale', 'Altrincham', 'Wilmslow'],

  async scrape() {
    const listings = [];
    // Try multiple URL patterns — GH has changed their site a few times
    const candidates = [
      `${BASE}/search/to-rent/`,
      `${BASE}/properties/lettings/`,
      `${BASE}/search/?sale_type=to_rent`,
      `${BASE}/search/?instruction_type=Letting`,
    ];

    let workingBase = null;
    for (const url of candidates) {
      try {
        const $ = await fetchHTML(url);
        const cards = $('[class*="property"], [class*="listing"], .result, article').filter((i, el) =>
          $(el).find('[class*="price"]').length > 0
        ).toArray();
        if (cards.length) { workingBase = url; break; }
      } catch (e) {
        continue;
      }
    }

    if (!workingBase) return listings;

    let page = 1;
    while (true) {
      const url = `${workingBase}${workingBase.includes('?') ? '&' : '?'}page=${page}`;
      let $;
      try {
        $ = await fetchHTML(url);
      } catch (e) { break; }

      const cards = $(
        '[class*="property-card"], [class*="PropertyCard"], [class*="property-item"], ' +
        '[class*="listing-card"], .property, .property-card, .result-item, article.property'
      ).toArray();
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const href    = el.find('a[href*="propert"], a[href*="let"], a[href*="rent"]').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const price   = parsePrice(el.find('[class*="price"], [class*="Price"]').first().text());
        if (!price) continue;
        const address  = el.find('[class*="address"], [class*="Address"], h2, h3').first().text().trim();
        const postcode = extractPostcode(address);
        const desc     = el.find('p').first().text().trim();
        listings.push({
          externalId: href.replace(/\/$/, '').split('/').pop() || href,
          title: address, price,
          beds: parseBeds(el.find('[class*="bed"]').first().text() || address),
          type: parseType(address), area: guessArea(address, postcode),
          street: address, postcode, description: desc,
          photos: [extractImage(el.find('img').first())].filter(Boolean),
          features: [],
          furnished: hasFeature(desc, ['furnished']),
          parking:   hasFeature(desc, ['parking']),
          pets:      hasFeature(desc, ['pets']),
          garden:    hasFeature(desc, ['garden']),
          balcony:   hasFeature(desc, ['balcony']),
          listingUrl: fullUrl,
        });
      }
      if (!$('a[rel="next"], .next, [aria-label="Next"]').length || page >= 15) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
