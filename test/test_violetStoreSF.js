var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violetStoreSF', function() {

  describe('basic crud support', function() {
    this.timeout(5*1000);

    /*
    Assumes that there is a Automated_Tests object created in the
    Org with Status as a picklist[New, Waiting, Running, Failed,
    Passed] and Verified as a Checkbox
    */

    it('should be able to do a query using basic query parameters', function() {
      var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
      violetSFStore.store.propOfInterest = {
        'Automated_Tests': ['Status', 'Verified']
      }
      vh.violet.respondTo('Hello', function *(response) {
        response.say('Hi');
        var results = yield response.load('Automated_Tests', 'Status', 'New');
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
      vh.initialize();
      return violetSFStore.connected().then(()=>{
        return vh.sendIntent('Hello');
      }).then(({rcvdStr, body})=>{
        assert.equal('Hi', rcvdStr);
      });
    });

    it('should be able to do a query using object parameters', function() {
      var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
      violetSFStore.store.propOfInterest = {
        'Automated_Tests': ['Status', 'Verified']
      }
      vh.violet.respondTo('Hello', function *(response) {
        response.say('Hi');
        var results = yield response.load({
          objName: 'Automated_Tests',
          keyName: 'Status',
          keyVal: 'New'
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
      vh.initialize();
      return violetSFStore.connected().then(()=>{
        return vh.sendIntent('Hello');
      }).then(({rcvdStr, body})=>{
        assert.equal('Hi', rcvdStr);
      });
    });

    it('should be able to do a query using raw soql query', function() {
      var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
      vh.violet.respondTo('Hello', function *(response) {
        response.say('Hi');
        var results = yield response.load({
          query: "CreatedDate, Status__c, Verified__c FROM Automated_Tests__c WHERE Status__c = 'New'  limit 100"
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
      vh.initialize();
      return violetSFStore.connected().then(()=>{
        return vh.sendIntent('Hello');
      }).then(({rcvdStr, body})=>{
        assert.equal('Hi', rcvdStr);
      });
    });


  });


});
