// DISABLED: Edward Mellor does not appear to have a lettings section on their website
// Only sales properties are listed
module.exports = {
  id: 'edwardmellor',
  name: 'Edward Mellor',
  website: 'https://edwardmellor.co.uk',
  areas: ['Levenshulme', 'Gorton', 'Stockport', 'Fallowfield'],
  async scrape() { return []; },
};
