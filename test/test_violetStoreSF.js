var co = require('co');
var assert = require('assert');
var vh = require('./violetHelper.js');
var storeHelper = require('./violetStoreHelper.js');

describe('violetStoreSF', function() {
  this.timeout(10*1000);

  /*
  Assumes that there is a Automated_Tests object created in the
  Org with Status as a picklist[New, Waiting, Running, Failed,
  Passed] and Verified as a Checkbox
  */

  var defineAndCallBasicStoreIntent = function(testPropOfInterest, responseCB) {
    var violetSFStore = require('../lib/violetStoreSF')(vh.violet);
    if (testPropOfInterest)
      violetSFStore.store.propOfInterest = testPropOfInterest;
    vh.violet.respondTo('Hello', function(response) {
      response.say('Hi');
      return co(responseCB(response, violetSFStore));
    });
    vh.initialize();
    return violetSFStore.connected().then(()=>{
      return vh.sendIntent('Hello');
    }).then(({rcvdStr, body})=>{
      console.log('Received: ' + rcvdStr);
      assert.equal('Hi', rcvdStr);
    });
  };

  var defineAndCallAutomatedTestsStoreIntent = function(responseCB) {
    var automatedTestsPropOfInterest = {
      'Automated_Tests': ['Name*', 'Status', 'Verified']
    };
    return defineAndCallBasicStoreIntent(automatedTestsPropOfInterest, responseCB);
  };

  describe('query multiple ways', function() {

    it('should be able to do a query using basic query parameters', function() {
      return defineAndCallAutomatedTestsStoreIntent(function *(response) {
        var results = yield response.load('Automated_Tests', 'Status', 'New');
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
    });

    it('should be able to do a query using object parameters', function() {
      return defineAndCallAutomatedTestsStoreIntent(function *(response) {
        var results = yield response.load({
          objName: 'Automated_Tests',
          keyName: 'Status',
          keyVal: 'New'
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
    });

    it('should be able to do a query using raw soql query', function() {
      return defineAndCallBasicStoreIntent(null, function *(response) {
        var results = yield response.load({
          query: "CreatedDate, Status__c, Verified__c FROM Automated_Tests__c WHERE Status__c = 'New'  limit 100"
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
    });
    
    it('should be able to do an aggregate query using raw soql query', function() {
      return defineAndCallBasicStoreIntent(null, function *(response) {
        var results = yield response.load({
          query: "Count(Id) from Automated_Tests__c",
          queryXtra: false
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
    });
    
    it('should be able to do an aggregate group by query using raw soql query', function() {
      return defineAndCallBasicStoreIntent(null, function *(response) {
        var results = yield response.load({
          query: "Count(Id), Status__c from Automated_Tests__c",
          queryXtra: "group by Status__c limit 2"
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
      });
    });

  });

  describe('basic crud support', function() {

    it('should be able to create a record and read to verify that it has been inserted', function() {
      var recName = `Important Record: ${Math.round(Math.random()*1000*1000)}`
      return defineAndCallAutomatedTestsStoreIntent(function *(response) {
        return co(storeHelper.testCRUD({response, colTx: (x)=>{
          if (x=='Name') return 'Name*'; else return x;
        }}));
      });
    });

  });

  describe('basic search support', function() {

    it('should be able to create a record and read to verify that it has been inserted', function() {
      var kavPropOfInterest = {
        'KnowledgeArticleVersion*': ['Id*', 'Title*', 'Summary*', 'UrlName*', 'LastPublishedDate*']
      }
      return defineAndCallBasicStoreIntent(kavPropOfInterest, function *(response, sfStore) {
        var results = yield sfStore.store.search('KnowledgeArticleVersion*', 'security');
        // console.log('search results:', results);
        // console.log('found ' + results.length + ' results');
        assert.ok(Array.isArray(results));
      });
    });

  });


});
