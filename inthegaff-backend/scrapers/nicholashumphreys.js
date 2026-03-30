const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature } = require('./_helpers');

const BASE = 'https://www.nicholashumphreys.com';

module.exports = {
  id: 'nicholashumphreys',
  name: 'Nicholas Humphreys',
  website: BASE,
  areas: ['Fallowfield', 'Withington', 'Rusholme', 'Didsbury'],

  async scrape() {
    const listings = [];
    let page = 1;

    while (true) {
      const url = page === 1
        ? `${BASE}/properties/for-letting/in-united-kingdom/`
        : `${BASE}/properties/for-letting/in-united-kingdom/?page=${page}`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      // Nurtur platform: .property-card containers
      let cards = $('.property-card').toArray();
      if (!cards.length) {
        cards = $('[class*="property-card"]').filter((i, el) => {
          const tag = el.tagName || el.name || '';
          return tag !== 'img' && tag !== 'IMG';
        }).toArray();
      }
      if (!cards.length) break;

      const seen = new Set();
      for (const card of cards) {
        try {
          const el = $(card);
          const statusText = el.text();
          if (statusText.includes('For Sale') && !statusText.includes('To Let')) continue;

          const link = el.find('a[href*="/property"]').first();
          const href = link.attr('href') || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);

          const fullUrl = href.startsWith('http') ? href : BASE + href;
          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceMatch = statusText.match(/\u00a3([\d,]+)\s*(?:PCM|pcm|pm)/);
          const priceStr = priceMatch ? priceMatch[0]
            : el.find('[class*="price"]').first().text().trim();
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          const address = el.find('[class*="address"], [class*="title"], h2, h3, h4, h5').first().text().trim()
            || el.find('img').first().attr('alt') || '';
          const addressLower = address.toLowerCase();
          const isManchester = addressLower.includes('manchester') ||
            addressLower.includes('m1') || addressLower.includes('fallowfield') ||
            addressLower.includes('withington') || addressLower.includes('rusholme') ||
            addressLower.includes('didsbury') || addressLower.includes('chorlton') ||
            addressLower.includes('salford') || addressLower.includes('hulme') ||
            addressLower.includes('levenshulme') || addressLower.includes('burnage') ||
            addressLower.includes('longsight') || addressLower.includes('gorton') ||
            addressLower.includes('moss side') || addressLower.includes('stretford') ||
            addressLower.includes('old trafford') || addressLower.includes('ancoats') ||
            addressLower.includes('ardwick') || addressLower.includes('whalley') ||
            /\bm\d{1,2}\b/i.test(address);
          if (!isManchester && address) continue;

          const beds = parseBeds(statusText);

          // FIX: Use extractImage helper for proper lazy-load handling
          const img = el.find('img').first();
          const photo = extractImage(img);

          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);

          listings.push({
            externalId: extId,
            title: address,
            price,
            beds,
            type: parseType(statusText),
            area,
            street: address,
            postcode,
            description: '',
            photos: photo ? [photo] : [],
            features: [],
            furnished: hasFeature(statusText, ['furnished']),
            parking: hasFeature(statusText, ['parking']),
            pets: hasFeature(statusText, ['pets']),
            garden: hasFeature(statusText, ['garden']),
            balcony: hasFeature(statusText, ['balcony']),
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }

      const hasNext = $('a:contains("Next"), a[rel="next"], .next, [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
