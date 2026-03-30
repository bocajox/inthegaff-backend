const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature, findCards } = require('./_helpers');

const BASE = 'https://jordanfishwick.co.uk';

module.exports = {
  id: 'jordanfishwick',
  name: 'Jordan Fishwick',
  website: BASE,
  areas: ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Altrincham'],

  async scrape() {
    const listings = [];
    const seen = new Set();

    // Try multiple URL patterns -- site may use different paths
    const urlPatterns = [
      `${BASE}/search/?department=residential-lettings`,
      `${BASE}/property-search/?department=residential-lettings`,
      `${BASE}/for-rent/`,
    ];

    let startUrl = null;
    let $;

    // Find the first URL that works and has listings
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
        let url;
        if (startUrl.includes('/search/')) {
          url = `${BASE}/search/page/${page}/?department=residential-lettings`;
        } else if (startUrl.includes('/property-search/')) {
          url = `${BASE}/property-search/page/${page}/?department=residential-lettings`;
        } else {
          url = `${BASE}/for-rent/page/${page}/`;
        }
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
        'a.card',
        '.card.text-decoration-none',
        '[class*="property-card"]',
        '[class*="property_card"]',
        'article.property',
      ]);

      if (!cards.length) {
        cards = $('.card').filter((i, el) => {
          const $el = $(el);
          const text = $el.text();
          return (text.includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                 ($el.find('a').length > 0 || $el.is('a'));
        }).toArray();
      }

      if (!cards.length) {
        cards = $('div, article, li').filter((i, el) => {
          const $el = $(el);
          return $el.find('a[href*="/property/"]').length > 0 &&
                 ($el.text().includes('\u00a3') || $el.find('[class*="price"]').length > 0) &&
                 $el.find('img').length > 0 &&
                 $el.children().length >= 2 &&
                 $el.children().length < 20 &&
                 $el.text().length < 2000;
        }).toArray();
      }

      if (!cards.length) break;

      for (const card of cards) {
        try {
          const el = $(card);

          let href = el.is('a') ? el.attr('href') : '';
          if (!href) {
            href = el.find('a[href*="/property/"]').first().attr('href') ||
                   el.find('a').first().attr('href') || '';
          }
          if (!href || href === '#') continue;

          const fullUrl = href.startsWith('http') ? href : BASE + href;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          const extId = href.replace(/\/$/, '').split('/').pop() || href;

          const priceStr = el.find('.price, [class*="price"]').first().text().trim() ||
                          el.text().match(/\u00a3[\d,]+\s*(?:pcm|pm|PCM|PM)?/)?.[0] || '';
          const price = parsePrice(priceStr);
          if (!price || price > 10000) continue;

          const address = el.find('h5.card-title, .card-title, h5, h4, h3, h2, [class*="address"], [class*="title"]').first().text().trim();

          const bedsStr = el.find('[class*="bed"], .beds').first().text().trim() ||
                         el.text().match(/(\d+)\s*bed/i)?.[0] || '';

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
            furnished: hasFeature(desc || address, ['furnished']),
            parking: hasFeature(desc || address, ['parking', 'garage']),
            pets: hasFeature(desc || address, ['pets']),
            garden: hasFeature(desc || address, ['garden']),
            balcony: hasFeature(desc || address, ['balcony', 'terrace']),
            listingUrl: fullUrl,
          });
        } catch (e) {
          continue;
        }
      }

      const hasNext = $('a[rel="next"], .next, .pagination .next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }

    return listings;
  },
};
