const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');
const BASE = 'https://www.purplebricks.co.uk';
module.exports = {
  id: 'purplebricks', name: 'Purple Bricks', website: BASE,
  areas: ['Manchester', 'Salford', 'Chorlton', 'Didsbury', 'Fallowfield'],
  async scrape() {
    const listings = [];
    // Purple Bricks search: Manchester, to-rent
    let page = 1;
    while (true) {
      const url = `${BASE}/property-to-rent/search?location=Manchester&radius=5&page=${page}`;
      const $ = await fetchHTML(url);
      const cards = $('[class*="PropertyCard"], [data-testid*="property"], [class*="listing"]').toArray();
      if (!cards.length) break;
      for (const card of cards) {
        const el = $(card);
        const href = el.find('a[href*="/property/"]').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const price = parsePrice(el.find('[class*="price"]').first().text());
        if (!price) continue;
        const address = el.find('[class*="address"], h2, h3').first().text().trim();
        const postcode = extractPostcode(address);
        // Only include South Manchester results
        const area = guessArea(address, postcode);
        if (area === 'Manchester' && !address.toLowerCase().includes('manchester')) continue;
        const desc = el.find('p').first().text().trim();
        listings.push({
          externalId: href.replace(/\/$/, '').split('/').pop() || href,
          title: address, price,
          beds: parseBeds(el.find('[class*="bed"]').first().text() || address),
          type: parseType(address), area,
          street: address, postcode, description: desc,
          photos: [el.find('img').first().attr('src') || ''].filter(Boolean),
          features: [], furnished: hasFeature(desc, ['furnished']),
          parking: hasFeature(desc, ['parking']), pets: hasFeature(desc, ['pets']),
          garden: hasFeature(desc, ['garden']), balcony: hasFeature(desc, ['balcony']),
          listingUrl: fullUrl,
        });
      }
      if (!$('a[rel="next"], [aria-label="Next"]').length || page >= 10) break;
      page++; await new Promise(r => setTimeout(r, 1500));
    }
    return listings;
  },
};
