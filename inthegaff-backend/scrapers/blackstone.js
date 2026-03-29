const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://blackstoneestateagent.co.uk';

module.exports = {
  id:      'blackstone',
  name:    'Black Stone Estate Agents',
  website: BASE,
  areas:   ['Levenshulme', 'Gorton', 'Longsight', 'Burnage'],

  async scrape() {
    const listings = [];
    let page = 1;
    while (true) {
      let $;
      try { $ = await fetchHTML(`${BASE}/properties/?type=lettings&page=${page}`); } catch (e) { break; }

      const cards = $('[class*="property"], .property-item').toArray();
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
      // Stop at page 5 max — Black Stone was hanging at 82s with unlimited pages
      if (!$('a[rel="next"], .next').length || page >= 5) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }
    return listings;
  },
};
