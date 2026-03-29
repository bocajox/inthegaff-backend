const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://edwardmellor.co.uk';

module.exports = {
  id:      'edwardmellor',
  name:    'Edward Mellor',
  website: BASE,
  areas:   ['Levenshulme', 'Gorton', 'Stockport', 'Fallowfield'],

  async scrape() {
    const listings = [];
    // Edward Mellor — try multiple URL patterns
    const candidates = [
      `${BASE}/property/lettings/`,
      `${BASE}/properties/to-rent/`,
      `${BASE}/lettings/`,
      `${BASE}/to-let/`,
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
        '[class*="property-card"], .property-item, .listing, ' +
        '[class*="PropertyCard"], [class*="property-result"], article.property'
      ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

      if (!cards.length) {
        cards = $('article, .card, li.result').filter((i, el) =>
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
