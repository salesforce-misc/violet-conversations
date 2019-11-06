/*
 * Calculator Test Script - targeting testing of Platforms
 */

var violet = require('../lib/violet').script({invocationName:'calculator'});
require('../test/scientificCalculatorHelper.js')(violet);
