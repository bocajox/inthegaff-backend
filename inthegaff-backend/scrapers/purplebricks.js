const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.purplebricks.co.uk';

module.exports = {
  id:      'purplebricks',
  name:    'Purple Bricks',
  website: BASE,
  areas:   ['Manchester', 'Salford', 'Chorlton', 'Didsbury', 'Fallowfield'],

  async scrape() {
    const listings = [];
    // Purple Bricks embeds property data in JSON within a <script> tag
    // Try the search page and parse embedded JSON if available
    const searchUrls = [
      `${BASE}/property-to-rent/search?location=Manchester&radius=5`,
      `${BASE}/property/to-rent/?location=Manchester`,
    ];

    for (const url of searchUrls) {
      let $;
      try { $ = await fetchHTML(url); } catch (e) { continue; }

      // First: try standard HTML cards
      let cards = $(
        '[class*="PropertyCard"], [data-testid*="property"], [class*="listing"], ' +
        '[class*="property-card"], [class*="PropertyListing"]'
      ).filter((i, el) => $(el).find('[class*="price"]').length > 0).toArray();

      if (!cards.length) {
        // Fallback: scan for JSON in script tags
        $('script').each((i, el) => {
          const txt = $(el).html() || '';
          if (!txt.includes('"price"') && !txt.includes('"rent"')) return;
          try {
            // Look for array of properties in JSON
            const matches = txt.match(/\{[^{}]*"price"[^{}]*\}/g) || [];
            for (const m of matches) {
              try {
                const obj = JSON.parse(m);
                if (!obj.price) return;
                listings.push({
                  externalId:  String(obj.id || obj.propertyId || Math.random()),
                  title:       obj.address || obj.displayAddress || '',
                  price:       parseInt(String(obj.price).replace(/[^0-9]/g, '')) || 0,
                  beds:        parseInt(obj.bedrooms || obj.beds) || 1,
                  type:        parseType(obj.address || ''),
                  area:        guessArea(obj.address || '', obj.postcode || ''),
                  street:      obj.address || '',
                  postcode:    obj.postcode || extractPostcode(obj.address || ''),
                  description: obj.summary || obj.description || '',
                  photos:      obj.mainImage ? [obj.mainImage] : (obj.images || []),
                  features:    [],
                  furnished:   false,
                  parking:     false,
                  pets:        false,
                  garden:      false,
                  balcony:     false,
                  listingUrl:  obj.propertyUrl ? BASE + obj.propertyUrl : url,
                });
              } catch (_) {}
            }
          } catch (_) {}
        });
        break; // Only one page needed if we got JSON
      }

      // Standard HTML path
      for (const card of cards) {
        const el = $(card);
        const href    = el.find('a[href*="/property/"]').first().attr('href') || '';
        const fullUrl = href.startsWith('http') ? href : BASE + href;
        const price   = parsePrice(el.find('[class*="price"]').first().text());
        if (!price) continue;
        const address  = el.find('[class*="address"], h2, h3').first().text().trim();
        const postcode = extractPostcode(address);
        const area     = guessArea(address, postcode);
        if (area === 'Manchester' && !address.toLowerCase().includes('manchester')) continue;
        const desc     = el.find('p').first().text().trim();
        listings.push({
          externalId: href.replace(/\/$/, '').split('/').pop() || href,
          title: address, price,
          beds: parseBeds(el.find('[class*="bed"]').first().text() || address),
          type: parseType(address), area,
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
      if (listings.length) break; // Got results from first URL
    }

    return listings;
  },
};
