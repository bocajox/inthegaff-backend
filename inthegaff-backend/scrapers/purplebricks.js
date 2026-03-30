const axios = require('axios');
const cheerio = require('cheerio');
const {
  parseType, extractPostcode, guessArea, hasFeature,
} = require('./_helpers');

const BASE = 'https://www.purplebricks.co.uk';

// Purplebricks is a Next.js app, but __NEXT_DATA__ contains full property data
// at props.pageProps.ssrResultData.properties — no headless browser needed.

module.exports = {
  id: 'purplebricks',
  name: 'Purplebricks',
  website: BASE,
  areas: ['Manchester', 'Salford', 'Chorlton', 'Didsbury', 'Fallowfield'],

  async scrape() {
    const listings = [];

    // This URL redirects to the search results page with lat/long params
    const url = `${BASE}/property-to-rent/Manchester`;

    let html;
    try {
      const resp = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        timeout: 18000,
        maxRedirects: 5,
      });
      html = resp.data;
    } catch (e) {
      console.log('   Purplebricks: fetch failed -', e.message);
      return listings;
    }

    // Extract __NEXT_DATA__ JSON from the HTML
    const $ = cheerio.load(html);
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (!nextDataScript) {
      console.log('   Purplebricks: no __NEXT_DATA__ found');
      return listings;
    }

    let properties;
    try {
      const nextData = JSON.parse(nextDataScript);
      properties = nextData.props?.pageProps?.ssrResultData?.properties || [];
    } catch (e) {
      console.log('   Purplebricks: failed to parse __NEXT_DATA__ -', e.message);
      return listings;
    }

    if (!properties.length) {
      console.log('   Purplebricks: 0 properties in __NEXT_DATA__');
      return listings;
    }

    for (const prop of properties) {
      try {
        // Skip sold/let properties
        if (prop.sold || prop.underOffer) continue;

        const price = prop.marketPrice || 0;
        if (!price || price > 10000) continue;

        const address = prop.address || '';
        const postcode = prop.postcode || extractPostcode(address);
        const area = guessArea(address, postcode);

        // Extract bed count from title like "3 bedroom semi-detached house"
        const bedMatch = (prop.title || '').match(/(\d+)\s*bed/i);
        const beds = bedMatch ? parseInt(bedMatch[1]) : (prop.title?.toLowerCase().includes('studio') ? 0 : 1);

        // Image — prefer mediumImage for good quality without huge downloads
        const photo = prop.image?.mediumImage || prop.image?.thumbnail || '';

        // Description from the listing
        const description = (prop.description || '').substring(0, 1000);

        // Features array
        const features = prop.propertyFeatures || [];

        // Build listing URL
        const listingUrl = prop.listingUrl
          ? (prop.listingUrl.startsWith('http') ? prop.listingUrl : BASE + prop.listingUrl)
          : '';

        if (!listingUrl) continue;

        const fullText = `${prop.title || ''} ${description} ${features.join(' ')}`;

        listings.push({
          externalId: String(prop.id || prop.listingId || ''),
          title: prop.title || '',
          price,
          beds,
          type: parseType(prop.title || prop.style || ''),
          area,
          street: address,
          postcode,
          description,
          photos: photo ? [photo] : [],
          features,
          furnished: hasFeature(fullText, ['furnished']),
          parking: hasFeature(fullText, ['parking', 'garage', 'driveway']),
          pets: hasFeature(fullText, ['pets']),
          garden: hasFeature(fullText, ['garden']),
          balcony: hasFeature(fullText, ['balcony']),
          listingUrl,
        });
      } catch (e) {
        continue;
      }
    }

    return listings;
  },
};
