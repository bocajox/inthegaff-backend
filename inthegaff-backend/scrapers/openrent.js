/**
 * OpenRent scraper — openrent.co.uk
 *
 * OpenRent is a direct-from-landlord platform with server-rendered HTML.
 * Cards use class ".pli.search-property-card" and contain price, beds,
 * address, and photo data in the initial HTML response.
 *
 * URL: https://www.openrent.co.uk/properties-to-rent/manchester
 */

const {
  fetchHTML, extractImage, parsePrice, parseBeds, parseType,
  extractPostcode, guessArea, isManchesterArea,
} = require('./_helpers');

const SEARCH_URLS = [
  'https://www.openrent.co.uk/properties-to-rent/manchester',
  'https://www.openrent.co.uk/properties-to-rent/salford',
];

async function scrape() {
  const results = [];
  const seen = new Set();

  for (const url of SEARCH_URLS) {
    try {
      const $ = await fetchHTML(url);
      if (!$) continue;

      const cards = $('.pli.search-property-card').toArray();
      if (!cards.length) {
        console.log(`   OpenRent: no cards at ${url}`);
        continue;
      }

      for (const card of cards) {
        try {
          const $c = $(card);

          // Link & external ID
          const href = $c.attr('href') || '';
          if (!href) continue;
          const fullUrl = href.startsWith('http') ? href : `https://www.openrent.co.uk${href}`;
          const idMatch = href.match(/\/(\d+)$/);
          const externalId = idMatch ? idMatch[1] : href;

          if (seen.has(externalId)) continue;
          seen.add(externalId);

          // Get all text content for parsing
          const text = $c.text().replace(/\s+/g, ' ').trim();

          // Price — "£1,340 per month" or "£309 per week"
          const priceMatch = text.match(/£([\d,]+)\s*per\s*month/i);
          const weeklyMatch = text.match(/£([\d,]+)\s*per\s*week/i);
          let price = 0;
          if (priceMatch) {
            price = parseInt(priceMatch[1].replace(/,/g, ''));
          } else if (weeklyMatch) {
            price = Math.round(parseInt(weeklyMatch[1].replace(/,/g, '')) * 52 / 12);
          }
          if (!price || price < 200 || price > 20000) continue;

          // Beds & type — "Studio Flat" or "1 Bed Flat" or "2 Bed House"
          const bedsMatch = text.match(/(\d+)\s*Bed\s+(Flat|House|Apartment|Room|Studio|Maisonette|Penthouse|Duplex)/i);
          const studioMatch = text.match(/Studio\s+(Flat|Apartment|Room)?/i);
          let beds = 0;
          let type = 'flat';
          if (studioMatch) {
            beds = 0; type = 'flat';
          } else if (bedsMatch) {
            beds = parseInt(bedsMatch[1]);
            type = parseType(bedsMatch[2]);
          }

          // Address — get from img alt which is clean, e.g. "Studio Flat, John Dalton St, M2"
          // The img alt is the cleanest source of address on OpenRent cards
          const imgEl = $c.find('img');
          const imgAlt = imgEl.attr('alt') || '';

          // Strip the beds/type prefix from alt to get just the address
          let street = imgAlt.replace(/^\d+\s*Bed\s+\w+,\s*/i, '').replace(/^Studio\s+\w+,\s*/i, '').trim();

          // Fallback: try to parse from text
          if (!street) {
            const addrMatch = text.match(/(?:Studio|Bed)\s+(?:Flat|House|Apartment|Room|Maisonette|Penthouse|Duplex)?,?\s*(.+?)(?:£|Brand|Enjoy|Beautiful|Spacious|Lovely|Modern|Luxury|Large|$)/i);
            if (addrMatch) {
              street = addrMatch[1].replace(/,\s*$/, '').replace(/^,\s*/, '').trim();
            }
          }

          // Postcode from address text
          const postcode = extractPostcode(street || text);

          // Manchester filter
          const fullAddress = `${street} ${postcode}`;
          if (!isManchesterArea(fullAddress) && !postcode.match(/^M\d{1,2}\s/i)) continue;

          // Area
          const area = guessArea(street, postcode);

          // Photo — use shared extractImage helper (handles lazy loading + // URLs)
          const photo = extractImage(imgEl);

          // Description snippet — keep it short and clean
          const description = '';

          results.push({
            externalId,
            title: '',
            price,
            beds,
            type,
            street,
            postcode,
            area,
            description,
            photos: photo ? [photo] : [],
            features: [],
            furnished: /furnished/i.test(text) && !/unfurnished/i.test(text),
            parking: /parking/i.test(text),
            pets: /pets?\s*(ok|allowed|friendly|welcome)/i.test(text),
            garden: /garden/i.test(text),
            balcony: /balcony/i.test(text),
            listingUrl: fullUrl,
          });
        } catch (e) {
          // Skip individual card errors
        }
      }
    } catch (err) {
      console.error(`   OpenRent error (${url}): ${err.message}`);
    }
  }

  console.log(`   OpenRent: ${results.length} Manchester listings found`);
  return results;
}

module.exports = {
  id: 'openrent',
  name: 'OpenRent',
  website: 'https://www.openrent.co.uk',
  areas: ['Manchester', 'Salford', 'All M postcodes'],
  scrape,
};
