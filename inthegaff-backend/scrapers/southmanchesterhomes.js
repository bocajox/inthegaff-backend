const { fetchHTML, extractImage, parsePrice, parseBeds, parseType, extractPostcode, guessArea, hasFeature, findCards } = require('./_helpers');

const BASE = 'https://southmanchesterhomes.co.uk';

function extractCardImage($, el) {
  const img = el.find('img').first();
  let src = extractImage(img);
  if (src) return src;
  const bgEls = el.find('[style*="background"]').toArray();
  for (const bgEl of bgEls) {
    const style = $(bgEl).attr('style') || '';
    const match = style.match(/background(?:-image)?\s*:\s*url\(['"]?([^'"\)]+)['"]?\)/i);
    if (match && match[1] && !match[1].startsWith('data:')) {
      return match[1].startsWith('http') ? match[1] : BASE + match[1];
    }
  }
  const noscript = el.find('noscript').html();
  if (noscript) {
    const m = noscript.match(/src=['"]([^'"]+)['"]/);
    if (m && m[1] && !m[1].startsWith('data:')) return m[1];
  }
  const source = el.find('picture source').first();
  if (source.length) {
    const srcset = source.attr('srcset');
    if (srcset) return srcset.split(',')[0].trim().split(' ')[0];
  }
  return '';
}

module.exports = {
  id: 'southmanchesterhomes',
  name: 'South Manchester Homes',
  website: BASE,
  areas: ['Chorlton', 'Didsbury', 'Withington', 'Whalley Range'],

  async scrape() {
    const listings = [];
    const seen = new Set();
    const urlPatterns = [
      `${BASE}/rent/`,
      `${BASE}/property-search/?department=residential-lettings`,
      `${BASE}/properties/to-let/`,
      `${BASE}/search/?department=residential-lettings`,
    ];
    let startUrl = null;
    let $;
    for (const testUrl of urlPatterns) {
      try {
        $ = await fetchHTML(testUrl);
        const hasContent = $('[class*="property"]').length > 0 ||
                          $('body').text().includes('\u00a3') ||
                          $('a[href*="/property/"]').length > 0;
        if (hasContent) { startUrl = testUrl; break; }
      } catch (e) { continue; }
    }
    if (!startUrl || !$) return listings;
    let page = 1;
    let firstPage = true;
    while (true) {
      if (!firstPage) {
        let url;
        if (startUrl.includes('/rent/')) {
          url = `${BASE}/rent/page/${page}/`;
        } else {
          const b = startUrl.split('?')[0];
          const p = startUrl.includes('?') ? '?' + startUrl.split('?')[1] : '';
          url = `${b}page/${page}/${p}`;
        }
        try { $ = await fetchHTML(url); } catch (e) { break; }
      }
      firstPage = false;
      let cards = findCards($, [
        '[class*="property-card"]', '[class*="property_card"]',
        '.property', 'article.property', 'ul.properties li', '.propertyhive-property',
      ]);
      if (!cards.length) {
        cards = $('article, .card, [class*="listing"]').filter((i, el) => {
          return $(el).text().includes('\u00a3') && $(el).find('a[href*="propert"]').length > 0;
        }).toArray();
      }
      if (!cards.length) {
        cards = $('div').filter((i, el) => {
          const $el = $(el);
          return $el.find('img').length > 0 && $el.find('a').length > 0 &&
                 $el.text().includes('\u00a3') && $el.children().length >= 2 &&
                 $el.children().length < 20 && $el.text().length < 2000;
        }).toArray();
      }
      if (!cards.length) break;
      for (const card of cards) {
        try {
          const el = $(card);
          const link = el.find('a[href*="propert"], a[href*="rent"], a').first();
          const href = link.attr('href') || '';
          if (!href || href === '#') continue;
          const fullUrl = href.startsWith('http') ? href : BASE + href;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);
          const extId = href.replace(/\/$/, '').split('/').pop() || href;
          const priceStr = el.find('[class*="price"], [class*="Price"]').first().text().trim()
            || el.text().match(/\u00a3[\d,]+/)?.[0] || '';
          const address = el.find('[class*="address"], h2, h3, h4, .card-title, [class*="title"]').first().text().trim();
          const bedsStr = el.find('[class*="bed"]').first().text().trim();
          const imgSrc = extractCardImage($, el);
          const price = parsePrice(priceStr);
          if (!price) continue;
          const postcode = extractPostcode(address);
          const area = guessArea(address, postcode);
          const desc = el.find('p, [class*="desc"]').first().text().trim();
          listings.push({
            externalId: extId, title: address, price,
            beds: parseBeds(bedsStr || address), type: parseType(address),
            area, street: address, postcode, description: desc,
            photos: imgSrc ? [imgSrc] : [], features: [],
            furnished: hasFeature(desc, ['furnished']),
            parking: hasFeature(desc, ['parking']),
            pets: hasFeature(desc, ['pets']),
            garden: hasFeature(desc, ['garden']),
            balcony: hasFeature(desc, ['balcony']),
            listingUrl: fullUrl,
          });
        } catch (e) { continue; }
      }
      const hasNext = $('a[rel="next"], .next, a:contains("Next"), [aria-label="Next"]').length > 0;
      if (!hasNext || page >= 10) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }
    return listings;
  },
};
