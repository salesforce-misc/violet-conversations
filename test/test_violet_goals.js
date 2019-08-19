var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violet goals', function() {

  describe('response mechanics', function() {

    it('a goals needs to be set for it to be flagged', function() {
      vh.violet.respondTo('Hello', (response) => {
        assert.equal(false, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('once a goals is set they can be checked', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        assert.equal(true, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('once a goals is set and it is cleared they cannot be checked', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        response.clearGoal('welcome');
        assert.equal(false, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('multiple goals still allow the first goal to be verified', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        response.addGoal('inform');
        assert.equal(true, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });


  });

  var basicPromptGoalDef = (violet)=>{
    violet.respondTo('Hello', (response) => {
      response.say('Hi');
      response.addGoal('welcome');
    });
    violet.defineGoal({
      goal: 'welcome',
      prompt: 'How are you doing',
      respondTo: [{
        expecting: 'doing well',
        resolve: (response) => {
          response.say('Glad to hear that');
      }},{
        expecting: 'not well',
        resolve: (response) => {
          response.say('Sorry to hear that');
      }}]
    });
  }

  describe('defineGoal mechanics', function() {

    /*
    // TODO: needs to be spec'd out
    it('intents inside a defined goal to ?not? get triggered by themselves', function() {
      basicPromptGoalDef(vh.violet);
      vh.initialize();
      return vh.sendIntent('doing well').then(({rcvdStr, body})=>{
        assert.notEqual('Glad to hear that', rcvdStr);
      });
    });
    */

    it('once a goal is set it triggers a prompt from a defined goal', function() {
      basicPromptGoalDef(vh.violet);
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        assert.equal('Hi <break time="500ms"/> How are you doing', rcvdStr);
      });
    });

    it('once a goal is set you can trigger nested intents', function() {
      basicPromptGoalDef(vh.violet);
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, body})=>{
        return vh.sendIntent('doing well').then(({rcvdStr})=>{
          assert.equal('Glad to hear that', rcvdStr);
        });
      });
    });

    it('when two goals have been added with a shared prompt then the most recent one is called', function() {
      vh.violet.defineGoal({
        goal: 'goalA',
        prompt: 'A',
        respondTo: [{
          expecting: 'A One',
          resolve: (response) => {
            response.say('Saying A One');
        }},{
          expecting: 'A Two',
          resolve: (response) => {
            response.say('Saying A Two');
        }}]
      });
      vh.violet.defineGoal({
        goal: 'goalB',
        prompt: 'B',
        respondTo: [{
          expecting: 'A One',
          resolve: (response) => {
            response.say('Saying B One');
        }},{
          expecting: 'B Two',
          resolve: (response) => {
            response.say('Saying B Two');
        }}]
      });
      vh.violet.respondTo('Hello', (response) => {
        response.say('Hi');
        response.addGoal('goalA');
        response.addGoal('goalB');
      });
      vh.initialize();
      return vh.sendIntent('Hello').then(({rcvdStr, sessionAttributes, body})=>{
        return vh.sendIntent('A One', null, sessionAttributes).then(({rcvdStr})=>{
          assert.equal('Saying B One', rcvdStr);
        });
      });
    });


    // TODO: adapt below for goals

    // it('once a goals is set and it is cleared then goal prompts are not triggered', function() {
    // });

    // it('multiple goals will mean prompts get triggered from the first goal first', function() {
    // });

    // it('goals that get triggered without a prompt will have their resolve being called', function() {
    // });


  });

});
