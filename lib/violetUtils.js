/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

console.log('*******************************');
console.log('Using deprecated module. Please:');
console.log("* Change any: require('../lib/violetUtils.js')(violet) to: require('../lib/violetTime.js')(violet)");
console.log('*******************************');
module.exports = require('./violetTime.js');
