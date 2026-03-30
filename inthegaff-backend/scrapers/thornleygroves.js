// DISABLED: Thornley Groves is a fully client-side rendered SPA
// /properties/to-let returns 404, /find-a-property is SPA with no SSR content
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'thornleygroves',
  name: 'Thornley Groves',
  website: 'https://www.thornleygroves.co.uk',
  areas: ['Chorlton', 'Didsbury', 'Withington', 'Sale', 'Ancoats', 'Northern Quarter'],
  async scrape() { return []; },
};
