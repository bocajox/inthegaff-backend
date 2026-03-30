// DISABLED: Beyond Property loads listings client-side only (SPA)
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'beyond',
  name: 'Beyond Property',
  website: 'https://beyond-property.co.uk',
  areas: ['Salford Quays', 'Altrincham', 'Sale', 'Stretford'],
  async scrape() { return []; },
};
