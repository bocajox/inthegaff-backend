const { fetchHTML, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');
const BASE = 'https://www.hunters.com';
module.exports = {
  id: 'hunters', name: 'Hunters', website: BASE,
  areas: ['Manchester City Centre', 'Salford Quays', 'Hulme', 'Chorlton', 'Didsbury'],
  async scrape() {
    const listings = [];
    // Hunters has a South Manchester specific office
    const searchUrls = [
      `${BASE}/office/south-manchester/properties/lettings/`,
      `${BASE}/office/manchester/properties/lettings/`,
    ];
    for (const searchUrl of searchUrls) {
      let page = 1;
      while (true) {
        const $ = await fetchHTML(`${searchUrl}?page=${page}`);
        const cards = $('[class*="PropertyCard"], [class*="property-card"], article[class*="property"]').toArray();
        if (!cards.length) break;
        for (const card of cards) {
          const el = $(card);
          const href = el.find('a[href*="/property/"]').first().attr('href') || '';
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const price = parsePrice(el.find('[class*="price"]').first().text());
          if (!price) continue;
          const address = el.find('[class*="address"], h2, h3').first().text().trim();
          const postcode = extractPostcode(address);
          const desc = el.find('p').first().text().trim();
          listings.push({
            externalId: href.replace(/\/$/, '').split('/').pop() || href,
            title: address, price,
            beds: parseBeds(el.find('[class*="bed"]').first().text() || address),
            type: parseType(address), area: guessArea(address, postcode),
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
      await new Promise(r => setTimeout(r, 2000));
    }
    return listings;
  },
};
