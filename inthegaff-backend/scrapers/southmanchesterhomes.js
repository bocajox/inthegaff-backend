const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://southmanchesterhomes.co.uk';

module.exports = {
  id:      'southmanchesterhomes',
  name:    'South Manchester Homes',
  website: BASE,
  areas:   ['Chorlton', 'Didsbury', 'Withington', 'Whalley Range'],

  async scrape() {
    const listings = [];
    // Try multiple URL patterns — small agent, varied site structure
    const candidates = [
      `${BASE}/properties/`,
      `${BASE}/to-let/`,
      `${BASE}/lettings/`,
      `${BASE}/property/to-rent/`,
      `${BASE}/property-to-rent/`,
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
        '[class*="property"], .property-item, .listing-item, [class*="listing"], ' +
        '.result, article.property, [class*="PropertyCard"], .property-card'
      ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

      if (!cards.length) {
        cards = $('article, .card, li').filter((i, el) =>
          $(el).find('[class*="price"]').length > 0
        ).toArray();
      }
      if (!cards.length) break;

      for (const card of cards) {
        const el      = $(card);
        const href    = el.find('a').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const price   = parsePrice(el.find('[class*="price"]').first().text());
        if (!price) continue;
        const address  = el.find('[class*="address"], h2, h3').first().text().trim();
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
      if (!$('a[rel="next"], .next').length || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }
    return listings;
  },
};
