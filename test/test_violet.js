var assert = require('assert');

var violetSvc = require('../lib/violet');
var vh = require('./violetHelper.js');

describe('violet core', function() {

  describe('respondTo', function() {

    it('default usage should keep sessions going', function() {
      vh.violet.respondTo('Hello', (response) => { response.say('Hi'); });
      vh.initialize();
      return vh
                .getIntent('Hello')
                .then(intentName=>{return vh.sendRequest(intentName)})
                .then(({rcvdStr, body})=>{
                  assert.equal(false, body.response.shouldEndSession);
                });
    });

    it('should be able to respond to a basic user request', function() {
      vh.violet.respondTo('Hello', (response) => { response.say('Hi'); });
      vh.initialize();
      return vh
                .getIntent('Hello')
                .then(intentName=>{return vh.sendRequest(intentName)})
                .then(({rcvdStr, body})=>{
                  assert.equal('Hi', rcvdStr);
                });
    });

    it('should be able to accept user parameters', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => { response.say('Hi [[firstName]]'); });
      vh.initialize();
      return vh
                .getIntent('Hello')
                .then(intentName=>{return vh.sendRequest(intentName, {firstName: 'John'})})
                .then(({rcvdStr, body})=>{
                  assert.equal('Hi John', rcvdStr);
                });
    });

  });

  it('should be testing all plugins', function() {
    // var violetClientTx = require('violet-conversations/lib/violetClientTx')(vh.violet);
    var violetTime = require('../lib/violetTime')(vh.violet);
    var violetList = require('../lib/violetList')(vh.violet);
    var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
    var violetPGStore = require('../lib/violetStorePG')(vh.violet);

    assert.equal(true, true);

    violetTime.clearTimers();
    violetPGStore.client.end();
  });
});
