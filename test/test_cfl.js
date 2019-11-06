var assert = require('assert');
var vh = require('./violetHelper.js');
var calcHelper = require('./scientificCalculatorHelper.js');


describe('conversational flow language', function() {

  describe('basic functionality', function() {

    it('addition of two numbers (decisions)', function() {
      calcHelper(vh.violet);
      vh.initialize();
      return vh.sendIntent('I want to add').then(({rcvdStr, sessionAttributes, body})=>{
        // console.log(rcvdStr);
        assert.ok(rcvdStr.indexOf('would you like me to add') > -1);
        return vh.sendIntent('and', {violet_number: 1, violet_number_a:2}, sessionAttributes);
      }).then(({rcvdStr, body})=>{
        // console.log(rcvdStr);
        assert.equal(rcvdStr, 'The sum of 1 and 2 is 3');
      });
    });

    it('calculating exponents (dialogs)', function() {
      calcHelper(vh.violet);
      vh.initialize();
      return vh.sendIntent('I want to calculate the exponent').then(({rcvdStr, sessionAttributes, body})=>{
        // console.log(rcvdStr);
        assert.equal(rcvdStr, 'What is the base number?');
        return vh.sendIntent('The base number is', {NumOne: 3}, sessionAttributes);
      }).then(({rcvdStr, sessionAttributes, body})=>{
        // console.log(rcvdStr);
        assert.equal(rcvdStr, 'What is the exponent?');
        return vh.sendIntent('The exponent is', {NumTwo: 2}, sessionAttributes);
      }).then(({rcvdStr, sessionAttributes, body})=>{
        // console.log(rcvdStr);
        assert.equal(rcvdStr, 'The value of 3 to the power of 2 is 9');
      });
    });

  });

});
