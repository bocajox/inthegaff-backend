const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature, findCards } = require('./_helpers');

const BASE = 'https://www.philipjames.co.uk';

module.exports = {
  id: 'philipjames',
  name: 'Philip James',
  website: BASE,
  areas: ['Didsbury', 'Chorlton', 'Fallowfield', 'Withington', 'Manchester City Centre'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    const urlPatterns = [
      `${BASE}/property-search/?department=residential-lettings`,
      `${BASE}/property-search/`,
      `${BASE}/search/?department=residential-lettings`,
      `${BASE}/properties/to-let/`,
    ];

    let startUrl = null;
    let $;

    for (const testUrl of urlPatterns) {
      try {
        $ = await fetchHTML(testUrl);
        const hasContent = $('a[href*="/property/"]').length > 0 ||
                          $('[class*="price"]').length > 0 ||
                          $('body').text().includes('\u00a3');
        if (hasContent) {
          startUrl = testUrl;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!startUrl || !$) return listings;

    let page = 1;
    let firstPage = true;

    while (true) {
      if (!firstPage) {
        const baseForPage = startUrl.split('?')[0];
        const params = startUrl.includes('?') ? '?' + startUrl.split('?')[1] : '';
        const url = `${baseForPage}page/${page}/${params}`;
        try {
          $ = await fetchHTML(url);
        } catch (e) {
          break;
        }
      }
      firstPage = false;

      let cards = findCards($, [
        'ul.properties li',
        '.propertyhive-property',
        '[class*="property-card"]',
        '[class*="property_card"]',
        'article.property',
        'a.card',
        '.card',
      ]);

      if (!cards.length) {
        cards = $('div, article, li').filter((i, el) => {
          const $el = $(el);
          return ($el.find('a[href*="/property/"]').length > 0 || $el.find('a[href*="/properties/"]').length > 0) &&
                 ($el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                 $el.children().length >= 2 &&
                 $el.children().length < 20 &&
                 $el.text().length < 2000;
        }).toArray();
      }

      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);

          const link = el.is('a') ? el : el.find('a[href*="/property/"], a[href*="/properties/"], a').first();
          const href = link.attr('href') || '';
          if (!href || href === '#') continue;

          const fullUrl = href.startsWith('http') ? href : BASE + href;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('.price, [class*="price"]').first().text().trim() ||
                          el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm|PCM|PM)?/)?.[0] || '';
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          const address = el.find('.address, [class*="address"], h2, h3, h4, h5, .card-title, [class*="title"]').first().text().trim();
          const bedsStr = el.find('[class*="bed"], .beds').first().text().trim();
          const imgSrc = extractImage(el.find('img').first());

          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);
          const desc = el.find('p, [class*="desc"]').first().text().trim();

          listings.push({
            externalId: extId,
            title: address,
            price,
            beds: parseBeds(bedsStr || address),
            type: parseType(address),
            area,
            street: address,
            postcode,
            description: desc,
            photos: imgSrc ? [imgSrc] : [],
            features: [],
            furnished: hasFeature(desc, ['furnished']),
            parking: hasFeature(desc, ['parking', 'garage']),
            pets: hasFeature(desc, ['pets']),
            garden: hasFeature(desc, ['garden']),
            balcony: hasFeature(desc, ['balcony', 'terrace']),
            listingUrl: fullUrl,
          });
        } catch (e) {
          continue;
        }
      }

      const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
