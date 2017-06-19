'use strict';

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);

//Violet queries for list of doctors associated with me and creates an array of expected results

violet.addKeyTypes({
  'doctor': 'AMAZON.US_FIRST_NAME'
});

//common across multiple goals
violet.addPhraseEquivalents([
  ['When\'s', 'When is']
]);

violet.respondTo({
  expecting: ['When is my appointment with [[doctor]]?', 'When do I see [[doctor]] next', 'Do I have an upcoming appointment with [[doctor]]'],
  resolve: (response) => {
    response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is in 3 days, on Thursday at 1130 AM.')
}});

module.exports = app;
