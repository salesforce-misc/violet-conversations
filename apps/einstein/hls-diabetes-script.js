'use strict';

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);

var violetSFStore = require('../../lib/violetSFStore.js');
violet.setPersistentStore(violetSFStore.store);
violetSFStore.store.propOfInterest = {
  'diabetesLog': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
}


/*
 * TODO: Get UX better. Right now it is a literal translation of the stop light card
 *       need to make it more conversational. Once this is working we says this
 *       as v1 and improve UX
 */

const yCall = 'Take action today. Call: 123-456-7890';
const yBloodSugarLo = 70;
const yBloodSugarHi = 130;

const rCall = 'Call your doctor now: 555-555-5555';
const rBloodSugarLo = 70;
const rBloodSugarHi = 130;

violet.addKeyTypes({
  "bloodSugarLvl": "NUMBER",
});

violet.addPhraseEquivalents([
]);

violet.meetGoal({
  goal: '{{checkIn}}',
  prompt: ['Did you check your blood sugar level today?'],
  respondTo: [{
    expecting: ['I tested my blood sugar level'],
    resolve: (response) => {
     response.say('Great.');
     response.addGoal('{{checkInDetails}}');
  }}, {
    expecting: ['I cannot test my blood sugar level'],
    resolve: (response) => {
      response.addGoal('{{whyCannotTestBloodSugar}}');
  }}]
});

violet.setTopLevelGoal('{{checkIn}}');

violet.meetGoal({
  goal: '{{checkInDetails}}',
  resolve: (response) => {
    if (!response.goalFilled('{{timeOfCheckin}}', '[[timeOfCheckin]]')
        || !response.goalFilled('{{bloodSugarLvl}}', '[[bloodSugarLvl]]')
        || !response.goalFilled('{{feetWounds}}', '[[feetWounds]]')
        || !response.goalFilled('{{missedDosages}}', '[[missedDosages]]') ) {
          return false; // dependent goals not met
        }

    if (response.get('{{bloodSugarLvl}}') < rBloodSugarLo) {
      response.say(rCall);
    } else if (response.get('{{bloodSugarLvl}}') < yBloodSugarLo) {
      response.say(yCall);
    }

    if (response.get('{{bloodSugarLvl}}') > rBloodSugarHi) {
      response.say(rCall);
    } else if (response.get('{{bloodSugarLvl}}') > yBloodSugarHi) {
      response.say(yCall);
    }
    // if (response.get('{{timeOfCheckin}}') == 'before-my-meal') {
    // } else {
    //   // 2hrs-after-my-meal
    // }

    if (response.get('{{feetWounds}}') == 'yes') {
      // TODO: implement logic correctly based on historical data
      response.load('<<diabetesLog>>', '<<diabetesLog.user>>', response.get('[[userId]]'), 'CreatedDate = LAST_N_DAYS:7');
      if (response.get('<<diabetesLog.feetWounds>>') > 7)
        response.say(rCall);
      else
        response.say(yCall);
    }

    if (response.get('{{missedDosages}}') == 'yes') {
      response.say(yCall);
      // TODO: implement rCall for dosages
    }

    // TODO: log data - because we need to check back for 7-14 days
    response.set('<<diabetesLog.user>>', response.get('[[userId]]') );
    response.set('<<diabetesLog.timeOfCheckin>>', response.get('{{timeOfCheckin}}') );
    response.set('<<diabetesLog.bloodSugarLvl>>', response.get('{{bloodSugarLvl}}') );
    response.set('<<diabetesLog.feetWounds>>', response.get('{{feetWounds}}') );
    response.set('<<diabetesLog.missedDosages>>', response.get('{{missedDosages}}') );
    response.store('<<diabetesLog>>');

}});

violet.meetGoal({
  goal: '{{timeOfCheckin}}',
  prompt: 'Was this before a meal or 2 hours after a meal?',
  respondTo: [{
    expecting: ['Before my meal'],
    resolve: (response) => {
      response.set('{{timeOfCheckin}}', 'before-my-meal');
  }}, {
    expecting: ['2 hours after my meal'],
    resolve: (response) => {
      response.set('{{timeOfCheckin}}', '2hrs-after-my-meal');
  }}]
});

violet.meetGoal({
  goal: '{{bloodSugarLvl}}',
  prompt: 'What was your blood sugar level?',
  respondTo: [{
    expecting: ['[[bloodSugarLvl]]'],
    resolve: (response) => {
      response.set('{{bloodSugarLvl}}', response.get('[[bloodSugarLvl]]') );
  }}]
});

violet.meetGoal({
  goal: '{{feetWounds}}',
  prompt: 'Do you have any wounds on your feet?',
  respondTo: [{
    expecting: ['GLOBAL No'],
    resolve: (response) => {
      response.set('{{feetWounds}}', false );
  }}, {
    expecting: ['GLOBAL Yes'],
    resolve: (response) => {
      response.set('{{feetWounds}}', true );
  }}]
});

violet.meetGoal({
  goal: '{{missedDosages}}',
  prompt: 'Did you miss any doses of medicine?',
  respondTo: [{
    expecting: ['GLOBAL No'],
    resolve: (response) => {
      response.set('{{missedDosages}}', false );
  }}, {
    expecting: ['GLOBAL Yes'],
    resolve: (response) => {
      response.set('{{missedDosages}}', true );
  }}]
});


violet.meetGoal({
  goal: '{{whyCannotTestBloodSugar}}',
  prompt: 'Are you out of strips, not sure how to test, sweaty, shaky, lightheaded, or confused?',
  respondTo: [{
    expecting: ['{I am|} out of strips', '{I have|} no strips'],
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'out-of-strips'); response.say(yCall);
  }}, {
    expecting: '{I am not sure|not sure|} how to test',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'not-sure-how-to-test'); response.say(yCall);
    }}, {
    expecting: '{I am|} sweaty',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'sweaty'); response.say(rCall);
    }}, {
    expecting: '{I am|} shaky',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'shaky'); response.say(rCall);
    }}, {
    expecting: '{I am|} sweaty and shaky',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'sweaty-and-shaky'); response.say(rCall);
    }}, {
    expecting: '{I am|} lightheaded',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'lightheaded'); response.say(rCall);
    }}, {
    expecting: '{I am|} confused',
    resolve: (response) => {
      response.set('{{cannotTestBloodSugarReason}}', 'confused'); response.say(rCall);
  }}]
});

violetUtils.repeat(48*60, ()=>{ violet.addGoal('{{checkIn}}'); });

module.exports = app;
