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
      // Correct URL: /properties/for-letting/in-united-kingdom/ (NOT /properties/in-manchester/)
      const url = page === 1
        ? `${BASE}/properties/for-letting/in-united-kingdom/`
        : `${BASE}/properties/for-letting/in-united-kingdom/?page=${page}`;

      let $;
      try { $ = await fetchHTML(url); } catch (e) { break; }

      // Nicholas Humphreys uses Nurtur platform
      let cards = $('[class*="property-card"], .property-card, [class*="property--card"]').toArray();
      if (!cards.length) {
        // Broader: look for result items with property links
        cards = $('[class*="result"], [class*="property"]').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="/property"]').length > 0
            && ($el.text().includes('\u00a3') || $el.text().includes('PCM') || $el.text().includes('pcm'))
            && $el.children().length >= 2
            && $el.children().length < 20;
        }).toArray();
      }
      if (!cards.length) {
        // Broadest: div/article with property data
        cards = $('div, article').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="/property"]').length > 0
            && ($el.find('[class*="price"]').length > 0 || $el.text().match(/\u00a3[\d,]+\s*(?:PCM|pcm|pm)/))
            && ($el.find('img').length > 0 || $el.find('[class*="image"]').length > 0)
            && $el.children().length >= 2
            && $el.children().length < 15
            && $el.text().length < 1500;
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
          const priceStr = priceMatch ? priceMatch[0] : el.find('[class*="price"]').first().text().trim();
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          // Only include Manchester area properties
          const address = el.find('[class*="address"], [class*="title"], h2, h3, h4, h5').first().text().trim()
            || el.find('img').first().attr('alt') || '';
          const addressLower = address.toLowerCase();
          const isManchester = addressLower.includes('manchester') || addressLower.includes('m1')
            || addressLower.includes('fallowfield') || addressLower.includes('withington')
            || addressLower.includes('rusholme') || addressLower.includes('didsbury')
            || addressLower.includes('chorlton') || addressLower.includes('salford');
          if (!isManchester && address) continue;

          const beds = parseBeds(statusText);
          const img = el.find('img').first();
          const imgSrc = img.attr('src') || img.attr('data-src') || '';
          const photo = imgSrc && !imgSrc.startsWith('data:') ? (imgSrc.startsWith('http') ? imgSrc : `https:${imgSrc}`) : '';

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
            parking:   hasFeature(statusText, ['parking']),
            pets:      hasFeature(statusText, ['pets']),
            garden:    hasFeature(statusText, ['garden']),
            balcony:   hasFeature(statusText, ['balcony']),
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
