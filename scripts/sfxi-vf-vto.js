'use strict';

var moment = require('moment-timezone');
var pluralize = require('pluralize');

var violet = require('../lib/violet.js')('einstein');
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'Activity': ['Name*', 'City']
}

violet.addKeyTypes({
  "activityName": {
      "type": "AMAZON.LITERAL",
      "sampleValues": ["Redwood State Park Clean Up", "Family House Taco Thursday", "Richmond Elementary Corridor Repaint"]
  },
  "activityCity": {
      "type": "AMAZON.LITERAL",
      "sampleValues": ["Palo Alto", "Mission Bay", "Richmond"]
  },
  "teamSize": "NUMBER",
  "activityDuration": "NUMBER"
});

var ack = (response) => { response.say(['Got it.', 'Great.', 'Awesome']); }

// start here
violet.respondTo({
  expecting: [
      'Find a team activity'
  ],
  resolve: function (response) {
    ack(response);
    response.addGoal('findActivity');
}});

//accept number of people
violet.defineGoal({
  goal: 'teamSize',
  prompt: ["For how many people?"],
  respondTo: [{
    expecting: ['[[teamSize]] people.'],
    resolve: (response) => {
      ack(response);
      response.say("For [[teamSize]] people.", /*quick*/true);
      response.set('teamSize', response.get('teamSize'));
  }}]
});

//accept number of hours
violet.defineGoal({
  goal: 'activityDuration',
  prompt: ["How many hours would you like to volunteer for?"],
  respondTo: [{
    expecting: ['[[activityDuration]] hours.'],
    resolve: (response) => {
      ack(response);
      response.say("[[activityDuration]] hours.", /*quick*/true);
      response.set('activityDuration', response.get('activityDuration'));
  }}]
});

violet.defineGoal({
  goal: 'findActivity',
  resolve: function *(response) {
  if (!response.ensureGoalFilled('teamSize') || !response.ensureGoalFilled('activityDuration') ) {
    return false; // dependent goals not met
    }
    var results = yield response.load('Activity', null, null, null);
    if (results.length == 0) {
      response.say('Sorry, there were no activities found.');
      return;
    }
    console.log(results);
    var speechOutput = 'I found ' + results.length + ' new ' + pluralize('activity', results.length) + 'in the next few days';
    results.forEach((rec, i)=>{
      speechOutput +=  i+1 + ', ' + rec.Name + ' in ' + rec.City + ', ';
      if (i === results.length-2) speechOutput += ' and ';
    });
    speechOutput += '. Click on the screen to sign up or email the ones that interest you. Enjoy your VTO!';
    response.say(speechOutput);
}});

module.exports = violet;
