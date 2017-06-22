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

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months = ['January','February','March','April','May','June','July', 'August', 'September', 'October', 'November', 'December'];

Date.daysBetween = function( date1, date2 ) {
  //Get 1 day in milliseconds
  var one_day=1000*60*60*24;

  // Convert both dates to milliseconds
  var date1_ms = date1.getTime();
  var date2_ms = date2.getTime();

  // Calculate the difference in milliseconds
  var difference_ms = date2_ms - date1_ms;
    
  // Convert back to days and return
  return Math.round(difference_ms/one_day); 
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
  resolve: function *(response) {
    yield response.load('<<appointment>>', '<<appointment.doctor_name>>', response.get('[[doctor]]'), null, 'AND appointment_date_time__c >= today ORDER BY appointment_date_time__c ASC NULLS FIRST LIMIT 1')
    var apptDateArray = response.get('<<appointment>>');

    if (apptDateArray.length > 0) {
      var apptDateTime = response.get('<<appointment>>')[0].appointment_date_time;

      if (apptDateTime) {
        var apptDate = new Date(apptDateTime);
        var noDayOfWeek = apptDate.getDay();
        var dayOfTheWeek = days[noDayOfWeek];
        var daysBetween = Date.daysBetween(new Date(), apptDate);
        var apptMonth = months[apptDate.getMonth()];
        var apptDayOfTheMonth = apptDate.getDate();
        var hour = apptDate.getHours();
        var minutes = apptDate.getMinutes();
        var minutesString = minutes;

        var amOrPm = 'A M';

        if (hour >= 12) {
          amOrPm = 'P M'
        }

        if (hour > 12) {
          hour = hour - 12;
        }

        if (minutes == 0) {
          minutesString = '';
        }


        console.log(daysBetween);
          
        if (daysBetween == 0) {
          response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is today at ' + hour + " " + minutesString + ' ' + amOrPm);    
        } else if (daysBetween == 1) {
          response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is tomorrow at ' + hour + " " + minutesString + ' ' + amOrPm);  
        }
        else if (daysBetween < 7) {
          response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is on ' + dayOfTheWeek + ' at ' + hour + " " + minutesString + ' ' + amOrPm);  
        } else {
          response.say('Your next appointment with ' + response.get('[[doctor]]') + ' is on ' + dayOfTheWeek + ' ' + apptMonth + ' ' + apptDayOfTheMonth + ' at ' + hour + " " + minutes+ ' ' + amOrPm);  
        }
      }
    }
    else {
      response.say('I do not see an appointment with ' + response.get('[[doctor]]') + ' on your calendar. Would you like me to schedule one?');
    }

    
  }
});

violet.respondTo({
  expecting: ['Can you set a reminder for me?', 'I would like to set a reminder'],
  resolve: (response) => {
    response.say('I can do that for you. Please start recording your reminder after the beep.');
}});


module.exports = app;
