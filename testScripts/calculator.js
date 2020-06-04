/*
 * Calculator Test Script - targeting testing of Platforms
 */

var violet = require('../lib/violet').script({invocationName:'calculator'});
require('../test/scientificCalculatorHelper.js')(violet);
violet.loadForContentMap(__dirname + '/calculatorContent.yaml');
// violet.loadExpectings(__dirname + '/calculatorContent.yaml');
