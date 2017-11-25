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

    it('should be able to respond to a multiple user requests', function() {
      vh.violet.respondTo(['Hello', 'Hi'], (response) => { response.say('Good morning'); });
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        assert.equal('Good morning', rcvdStr);
      }).then(()=>{
        return vh.sendIntent('Hi').then(({rcvdStr, body})=>{
          assert.equal('Good morning', rcvdStr);
        });
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

    it('should be able to support equivalent phrases', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.addPhraseEquivalents([
        ['My name is', 'I call myself'],
      ]);
      vh.violet.respondTo('My name is [[firstName]]', (response) => { response.say('I like the name [[firstName]]'); });
      vh.initialize();
      return vh.sendIntent('My name is', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('I like the name John', rcvdStr);
      }).then(()=>{
        return vh.sendIntent('I call myself', {firstName: 'John'}).then(({rcvdStr, body})=>{
          assert.equal('I like the name John', rcvdStr);
        });
      });
    });



  });

});
