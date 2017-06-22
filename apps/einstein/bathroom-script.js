'use strict';

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);
var violetSFStore = require('../../lib/violetSFStore.js');
violet.setPersistentStore(violetSFStore.store);
violetSFStore.store.propOfInterest = {
  'appointment': ['doctor_name', 'appointment_date_time']
}



//Violet queries for list of doctors associated with me and creates an array of expected results

violet.addKeyTypes({
  'doctor': 'AMAZON.US_FIRST_NAME',
});

//common across multiple goals
violet.addPhraseEquivalents([
  ['When\'s', 'When is'],
  ['I\'d', 'I would']
]);

violet.respondTo({
  expecting: ['When is my appointment with [[doctor]]?', 'When do I see [[doctor]] next', 'Do I have an upcoming appointment with [[doctor]]'],
  resolve: (response) => {
    response.load('<<appointment>>', 'doctor_name', response.get('[[doctor]]'), 'ORDER BY appointment_date_time__c ASC NULLS FIRST LIMIT 1')
      .then(()=>{
        response.say('You received a bill from <<appointment.appointment_date_time>>');
      });
  }  
    
});

violet.respondTo({
  expecting: ['Can you set a reminder for me?', 'I would like to set a reminder'],
  resolve: (response) => {
    response.say('I can do that for you. Please start recording your reminder after the beep.');
}});


module.exports = app;
