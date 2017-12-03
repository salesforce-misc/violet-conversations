// having two scripts is not working!


var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violet release', function() {

  it('should be testing all plugins', function() {
    // var violetClientTx = require('../lib/violetClientTx')(vh.violet); // for future release
    var violetTime = require('../lib/violetTime')(vh.violet);
    var violetList = require('../lib/violetList')(vh.violet);
    var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
    var violetPGStore = require('../lib/violetStorePG')(vh.violet);
    violetPGStore.connect();

    assert.equal(true, true);

    violetTime.clearTimers();
    violetPGStore.cleanup();
  });

});
