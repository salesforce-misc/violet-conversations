var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violet core', function() {

  describe('lifecycle', function() {

    it('should be able to launch a session', function() {
      vh.initialize();
      return vh.sendRequest('<<Launch>>').then(({rcvdStr, body})=>{
        assert(vh.contains(rcvdStr, ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']));
      });
    });

    it('should be able to customize launch prompt', function() {
      vh.violet.setLaunchPhrases(['Yo'])
      vh.initialize();
      return vh.sendRequest('<<Launch>>').then(({rcvdStr, body})=>{
        assert.equal(rcvdStr, 'Yo');
      });
    });

    it('user should be able to close a session', function() {
      vh.initialize();
      return vh.sendIntent('Thanks').then(({rcvdStr, body})=>{
        assert(body.response.shouldEndSession);
      });
    });

  });

  describe('respondTo', function() {

    it('default usage should keep end session', function() {
      vh.violet.respondTo('Hello', (response) => { response.say('Hi'); });
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        assert.equal(true, body.response.shouldEndSession);
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

    it('should be able to accept user parameters and add it to the session', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => { response.say('Hi [[firstName]]'); });
      vh.initialize();
      return vh.sendIntent('Hello', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('Hi John', rcvdStr);
        assert.equal('John', body.sessionAttributes.firstName);
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

    it('should be able to retrieve session parameters', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => {
        if (response.get('firstName') === 'John')
          response.say('I know you');
        else
          response.say('Hi [[firstName]]');
      });
      vh.initialize();
      return vh.sendIntent('Hello', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('I know you', rcvdStr);
      });
    });

    it('should be able to set session parameters', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => {
        if (response.get('firstName') === 'John')
          response.set('friend', true);
        response.say('Hi [[firstName]]');
      });
      vh.initialize();
      return vh.sendIntent('Hello', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('Hi John', rcvdStr);
        assert.equal(true, body.sessionAttributes.friend);
      });
    });

    it('should be able to clear session parameters', function() {
      vh.violet.addInputTypes({'firstName': 'AMAZON.US_FIRST_NAME' });
      vh.violet.respondTo('Hello [[firstName]]', (response) => {
        response.clear('firstName');
        response.say('Hi');
      });
      vh.initialize();
      return vh.sendIntent('Hello', {firstName: 'John'}).then(({rcvdStr, body})=>{
        assert.equal('Hi', rcvdStr);
        assert.notEqual('John', body.sessionAttributes.firstName);
      });
    });


  });

});
