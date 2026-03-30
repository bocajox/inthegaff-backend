// DISABLED: LetMe loads property data client-side only (SPA)
// Cannot be scraped with cheerio — would need a headless browser
module.exports = {
  id: 'letme',
  name: 'LetMe Manchester',
  website: 'https://letme.agency',
  areas: ['Salford Quays', 'MediaCity', 'Stretford', 'Sale', 'Altrincham'],
  async scrape() { return []; },
};
