console.log('*******************************');
console.log('Using deprecated module. Please:');
console.log("* Change any: require('../lib/violetUtils.js')(violet) to: require('../lib/violetTime.js')(violet)");
console.log('*******************************');
module.exports = require('./violetTime.js');
