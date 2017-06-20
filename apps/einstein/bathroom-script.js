'use strict';

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);

//Violet queries for list of doctors associated with me and creates an array of expected results

violet.addKeyTypes({
  'doctor': 'AMAZON.US_FIRST_NAME',
});

//common across multiple goals
violet.addPhraseEquivalents([
  ['When\'s', 'When is']
]);

violet.respondTo({
  expecting: ['When is my appointment with [[doctor]]?', 'When do I see [[doctor]] next', 'Do I have an upcoming appointment with [[doctor]]'],
  resolve: (response) => {
    var doctor = response.get('[[doctor]]');
    var days = 3;
    var time = '11:30 AM';
    var dayOfTheWeek = 'Thursday';

    response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is in ' + days + ' days, \
      on ' + dayOfTheWeek + ' at ' + time);
}});

module.exports = app;
