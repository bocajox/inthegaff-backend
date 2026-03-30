// DISABLED: Gascoigne Halman lettings search returns 0 results
// /search/?instruction_type=Let shows "0 Property" — no lettings listed
// /property-to-let.html is an info page with no property listings
module.exports = {
  id: 'gascoignehalman',
  name: 'Gascoigne Halman',
  website: 'https://www.gascoignehalman.co.uk',
  areas: ['Didsbury', 'Chorlton', 'Sale', 'Altrincham', 'Wilmslow'],
  async scrape() { return []; },
};
