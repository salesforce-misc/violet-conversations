console.log('*******************************');
console.log('Using deprecated module. Please:');
console.log("1. change any: require('../lib/violetSFStore.js') to: require('../lib/violetStoreSF.js')(violet)");
console.log("2. remove any lines in your scripts that say: violet.setPersistentStore(violetSFStore.store);");
console.log('*******************************');
module.exports = require('./violetStoreSF.js')();
