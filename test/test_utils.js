var utils = require('../lib/utils');
var assert = require('assert');

describe('utils', function() {

  it('getArrAsStr be able to pull arrays together', function() {
    assert.equal('1, 2 and 3', utils.getArrAsStr([1, 2, 3]));
  });

  it('getNumAsStr should be able to convert numbers', function() {
    assert.equal(utils.getNumAsStr(23),  'twenty three');
    assert.equal(utils.getNumAsStr(41),  'forty one');
    assert.equal(utils.getNumAsStr(162), 'one hundred sixty two');
    assert.equal(utils.getNumAsStr(390), 'three hundred ninety');
    assert.equal(utils.getNumAsStr(732), 'seven hundred thirty two');
    assert.equal(utils.getNumAsStr(999), 'nine hundred ninety nine');
  });


});
