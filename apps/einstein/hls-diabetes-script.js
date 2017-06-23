'use strict';

var violet = require('../../lib/violet.js')('einstein');
var violetUtils = require('../../lib/violetUtils.js')(violet);

var violetSFStore = require('../../lib/violetSFStore.js');
violet.setPersistentStore(violetSFStore.store);
violetSFStore.store.propOfInterest = {
  'diabetesLog': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
}


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

violet.addTopLevelGoal('{{checkIn}}');

violet.respondTo({
  expecting: ['Check in', 'Can I check in', 'I would like to check in'],
  resolve: (response) => {
   response.say('Sure.');
   response.addGoal('{{checkIn}}');
}});

violet.defineGoal({
  goal: '{{checkIn}}',
  prompt: ['Did you check your blood sugar level today?'],
  respondTo: [{
    expecting: ['Yes', 'I tested my blood sugar level'],
    resolve: (response) => {
     response.say('Great.');
     response.addGoal('{{checkInDetails}}');
  }}, {
    expecting: ['No', 'I cannot test my blood sugar level'],
    resolve: (response) => {
      response.addGoal('{{whyCannotTestBloodSugar}}');
  }}]
});

violet.respondTo({
  expecting: ['Is everything running well'],
  resolve: function *(response) {
  }
});

violet.defineGoal({
  goal: '{{checkInDetails}}',
  resolve: function *(response) {
    if (!response.goalFilled('timeOfCheckin')
        || !response.goalFilled('bloodSugarLvl')
        || !response.goalFilled('feetWounds')
        || !response.goalFilled('missedDosages') ) {
          return false; // dependent goals not met
        }

    response.say('Thanks for checking in - I am logging the data for you.');

    if (response.get('{{bloodSugarLvl}}') < rBloodSugarLo) {
      response.say('Your blood sugar level is very low.');
      response.say(rCall);
    } else if (response.get('{{bloodSugarLvl}}') < yBloodSugarLo) {
      response.say('Your blood sugar level is low.');
      response.say(yCall);
    }

    if (response.get('{{bloodSugarLvl}}') > rBloodSugarHi) {
      response.say('Your blood sugar level is very high.');
      response.say(rCall);
    } else if (response.get('{{bloodSugarLvl}}') > yBloodSugarHi) {
      response.say('Your blood sugar level is high.');
      response.say(yCall);
    }
    // if (response.get('{{timeOfCheckin}}') == 'before-my-meal') {
    // } else {
    //   // 2hrs-after-my-meal
    // }

    if (response.get('{{feetWounds}}') == true) {
      var diabetesLog = yield response.load('diabetesLog', 'user', response.get('[[userId]]'), 'CreatedDate = LAST_N_DAYS:14')
      //console.log('load-results', diabetesLog);

      var sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);

      var yWarn = true;
      var rWarn = true;
      diabetesLog.forEach((logItem)=>{
        // we have already filtered for the last 14 days
        if (logItem.feetWounds == false) rWarn = false;
        var itemDate = new Date(logItem.CreatedDate);
        if (itemDate.getTime() > sevenDaysAgo.getTime() && logItem.feetWounds == false) yWarn = false;
      });
      if (rWarn) {
        response.say('Your feet wounds are an indicator of a big problem.');
        response.say(rCall);
      } else if (yWarn){
        response.say('Your feet wounds are an indicator of a problem.');
        response.say(yCall);
      }
    }

    if (response.get('{{missedDosages}}') == 'yes') {
      response.say('Your missed dosage is a problem.');
      response.say(yCall);
      // TODO: implement rCall for dosages
    }

    response.store('diabetesLog', {
      'user': response.get('[[userId]]'),
      'timeOfCheckin': response.get('{{timeOfCheckin}}'),
      'bloodSugarLvl': response.get('{{bloodSugarLvl}}'),
      'feetWounds': response.get('{{feetWounds}}'),
      'missedDosages': response.get('{{missedDosages}}')
    });

}});

violet.defineGoal({
  goal: '{{timeOfCheckin}}',
  prompt: 'Was this before a meal, or 2 hours after a meal?',
  respondTo: [{
    expecting: ['Before', 'Before my meal'],
    resolve: (response) => {
      response.set('{{timeOfCheckin}}', 'before-my-meal');
  }}, {
    expecting: ['After', '2 hours after my meal'],
    resolve: (response) => {
      response.set('{{timeOfCheckin}}', '2hrs-after-my-meal');
  }}]
});

violet.defineGoal({
  goal: '{{bloodSugarLvl}}',
  prompt: 'What was your blood sugar level?',
  respondTo: [{
    expecting: ['My blood sugar level is [[bloodSugarLvl]]', '[[bloodSugarLvl]]'],
    resolve: (response) => {
      response.set('{{bloodSugarLvl}}', response.get('[[bloodSugarLvl]]') );
  }}]
});

violet.defineGoal({
  goal: '{{feetWounds}}',
  prompt: 'Do you have any wounds on your feet?',
  respondTo: [{
    expecting: ['No'],
    resolve: (response) => {
      response.set('{{feetWounds}}', false );
  }}, {
    expecting: ['Yes'],
    resolve: (response) => {
      response.set('{{feetWounds}}', true );
  }}]
});

violet.defineGoal({
  goal: '{{missedDosages}}',
  prompt: 'Did you miss any doses of medicine?',
  respondTo: [{
    expecting: ['No'],
    resolve: (response) => {
      response.set('{{missedDosages}}', false );
  }}, {
    expecting: ['Yes'],
    resolve: (response) => {
      response.set('{{missedDosages}}', true );
  }}]
});


violet.defineGoal({
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

violet.registerIntents();

violetUtils.repeat(48*60, ()=>{ violet.addGoal('{{checkIn}}'); });

module.exports = violet.app;
