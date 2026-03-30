const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.purplebricks.co.uk';

module.exports = {
  id: 'purplebricks',
  name: 'Purple Bricks',
  website: BASE,
  areas: ['Manchester', 'Salford', 'Chorlton', 'Didsbury', 'Fallowfield'],

  async scrape() {
    const listings = [];

    const urls = [
      `${BASE}/search/property-to-rent?searchLocation=Manchester&radius=5`,
      `${BASE}/property-to-rent/search?searchLocation=Manchester`,
    ];

    let $ = null;
    for (const url of urls) {
      try {
        $ = await fetchHTML(url);
        if ($.text().includes('\u00a3') || $('[class*="property"]').length > 0) break;
        $ = null;
      } catch (e) { continue; }
    }
    if (!$) return listings;

    // Try standard HTML cards first
    let cards = $('[class*="PropertyCard"], [data-testid*="property"], [class*="listing"], [class*="property-card"]').toArray();

    if (!cards.length) {
      // Fallback: scan script tags for embedded JSON property data
      $('script').each((i, el) => {
        const txt = $(el).html() || '';
        if (!txt.includes('"price"') && !txt.includes('"rent"')) return;
        try {
          const matches = txt.match(/\{[^{}]*"price"[^{}]*\}/g) || [];
          for (const m of matches) {
            try {
              const obj = JSON.parse(m);
              if (!obj.price) return;
              listings.push({
                externalId: String(obj.id || obj.propertyId || Math.random()),
                title: obj.address || obj.displayAddress || '',
                price: parseInt(String(obj.price).replace(/[^0-9]/g, '')) || 0,
                beds: parseInt(obj.bedrooms || obj.beds) || 1,
                type: parseType(obj.address || ''),
                area: guessArea(obj.address || '', obj.postcode || ''),
                street: obj.address || '',
                postcode: obj.postcode || extractPostcode(obj.address || ''),
                description: obj.summary || obj.description || '',
                photos: obj.mainImage ? [obj.mainImage] : (obj.images || []).slice(0, 3),
                features: [],
                furnished: false, parking: false, pets: false, garden: false, balcony: false,
                listingUrl: obj.propertyUrl ? BASE + obj.propertyUrl : '',
              });
            } catch (_) {}
          }
        } catch (_) {}
      });
      if (listings.length) return listings;
    }

    // Standard HTML path
    for (const card of cards) {
      const el = $(card);
      const href = el.find('a[href*="/property/"]').first().attr('href') || el.find('a').first().attr('href') || '';
      const fullUrl = href.startsWith('http') ? href : BASE + href;
      const extId = href.replace(/\/$/, '').split('/').pop() || href;

      const priceStr = el.find('[class*="price"]').first().text().trim();
      const address = el.find('[class*="address"], h2, h3').first().text().trim();
      const bedsStr = el.find('[class*="bed"]').first().text().trim();
      const imgSrc = extractImage(el.find('img').first());

      const price = parsePrice(priceStr);
      if (!price) continue;

      const postcode = extractPostcode(address);
      const area = guessArea(address, postcode);

      listings.push({
        externalId: extId,
        title: address,
        price,
        beds: parseBeds(bedsStr || address),
        type: parseType(address),
        area,
        street: address,
        postcode,
        description: '',
        photos: imgSrc ? [imgSrc] : [],
        features: [],
        furnished: false, parking: false, pets: false, garden: false, balcony: false,
        listingUrl: fullUrl,
      });
    }

    return listings;
  },
};
