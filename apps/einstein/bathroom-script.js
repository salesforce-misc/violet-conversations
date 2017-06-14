'use strict';

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);

/*
 * TODO: Get UX better. Right now it is a literal translation of the stop light card
 *       need to make it more conversational. Once this is working we says this
 *       as v1 and improve UX
 */

violet.addKeyTypes({
  "bloodSugarLvl": "NUMBER",
});

//common across multiple goals
violet.addPhraseEquivalents([
  ['When\'s', 'When is']
]);

violet.respondTo({
  expecting: ['When is my appointment with Dr. Spock?', 'When do I see Dr. Spock next', 'Do I have an appointment with Dr. Spock'],
  resolve: (response) => {
   response.say('Your next appt is in 3 days, on Thursday at 1130 AM.')
}});

module.exports = app;
