var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violet core', function() {

  describe('respondTo', function() {

    it('default usage should keep sessions going', function() {
      vh.violet.respondTo('Hello', (response) => { response.say('Hi'); });
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        assert.equal(false, body.response.shouldEndSession);
      });
    });

    it('should be able to respond to a basic user request', function() {
      vh.violet.respondTo('Hello', (response) => { response.say('Hi'); });
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        assert.equal('Hi', rcvdStr);
      });
    });

    it('should be able to accept user parameters', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => { response.say('Hi [[firstName]]'); });
      vh.initialize();
      return vh.sendIntent('Hello', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('Hi John', rcvdStr);
      });
    });

  });

});
