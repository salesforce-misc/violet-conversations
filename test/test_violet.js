var assert = require('assert');

var violetSvc = require('../lib/violet');
var violetHelper = require('./violetHelper.js');
/*var templates = */require('../tester-views/templates-json.js');
var srvrInstance, violet;

beforeEach(()=>{
  srvrInstance = violetHelper.startServer('test');
  violetSvc.clearAppInfo('test');
  violet = violetSvc.script('test');
})


afterEach(()=>{
  srvrInstance.close();
  srvrInstance = null;
  violet = null;
});

describe('violet core', function() {

  describe('respondTo', function() {

    it('default usage should keep sessions going', function() {
      violet.respondTo('Hello', (response) => { response.say('Hi'); });
      violetHelper.initialize(violet);
      return violetHelper
                .getIntent('Hello')
                .then(intentName=>{return violetHelper.sendRequest(intentName)})
                .then(({rcvdStr, body})=>{
                  assert.equal(false, body.response.shouldEndSession);
                });
    });

    it('should be able to respond to a basic user request', function() {
      violet.respondTo('Hello', (response) => { response.say('Hi'); });
      violetHelper.initialize(violet);
      return violetHelper
                .getIntent('Hello')
                .then(intentName=>{return violetHelper.sendRequest(intentName)})
                .then(({rcvdStr, body})=>{
                  assert.equal('Hi', rcvdStr);
                });
    });

    it('should be able to accept user parameters', function() {
      violet.respondTo('Hello [[firstName]]', (response) => { response.say('Hi [[firstName]]'); });
      violetHelper.initialize(violet);
      return violetHelper
                .getIntent('Hello')
                .then(intentName=>{return violetHelper.sendRequest(intentName, {firstName: 'John'})})
                .then(({rcvdStr, body})=>{
                  assert.equal('Hi John', rcvdStr);
                });
    });

  });
});
