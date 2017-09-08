'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);
var request = require('request');

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'Patient_Generated_Data': ['FieldName', 'FieldValue', 'LoggedDate', 'LoggedTime']
}

violet.addKeyTypes({
  "bloodSugarLvl": "NUMBER",
});

//common across multiple goals
violet.addPhraseEquivalents([
]);

violet.addTopLevelGoal('checkIn');

violet.respondTo({
  expecting: ['Hi', 'Are you there', 'Check in', 'Can I check in', 'I would like to check in'],
  resolve: (response) => {
   response.say('It has been a while.');
   response.addGoal('checkIn');
}});

violet.defineGoal({
  goal: 'checkIn',
  prompt: ['Where have you been?'],
  respondTo: [{
    expecting: ['Busy', 'I cannot test my blood sugar level', 'Not feeling good'],
    resolve: function *(response) {
      var results = yield response.load('Patient_Generated_Data', 'defaultEmail', 'default@haiku.dev', 'FieldName__c = \'bloodSugar\'', 'ORDER BY LoggedTime__c');
      if (results.length == 0) {
        response.say('You have not checked in since your doctors visit. We think you should connect to your care team now.');
        sendSOS();
        return;
      }

      var reallyHigh = 0;
      var reallyLow = 0;
      var high = 0;
      var low = 0;

      results.forEach((rec, i)=>{
        console.log(rec.FieldValue);
        if (parseInt(rec.FieldValue) >= 150) {
          if (parseInt(rec.FieldValue) >= 200) {
            reallyHigh += 1;
          } else {
            high += 1;
          }
        }

        if (parseInt(rec.FieldValue) <= 90) {
          if (parseInt(rec.FieldValue) <= 65) {
            reallyLow += 1;
          } else {
            low += 1;
          }
        }
      });

      response.say("We are concerned that you have missed " + (7 - results.length) + " checkins");

      if (reallyHigh >= 1 && reallyLow >= 1) {
        response.say("Your sugars have been both high and low. This is a sign that you are not managing your blood sugars well.");
      }

      if (high >= 1 && low >= 1) {
        response.say("Your sugars have been both high and low. This is a sign that you are not managing your blood sugars well.");
      }

      if ((high==0 && reallyHigh==0)&&(low>=1 || reallyLow>=1)) {
        response.say("Your sugars have been consistently low. Consistently low blood sugar can result in you being more lethargic. This is a sign that we may need to change your medication to better manage your sugars");
      }

      if ((low==0 && reallyLow==0)&&(high>=1 || reallyHigh>=1)) {
        response.say("Your sugars have been consistently high. We may need to revisit your medication and / or diet.");
      }

      response.say('We are connecting you to your care team now');

      sendSOS();
    }
  }]
});


violetTime.repeat(48*60, ()=>{ });

function sendSOS() {
  var url = 'https://hls-experience-core.herokuapp.com/api/rebound'

  var postData = {
    "type": "hlssos"
  }

  var options = {
    method: 'post',
    body: postData,
    json: true,
    url: url
  }

  request(options, function (err, response, body) {
    if (err) {
      console.log("sadness");
    } else {
      console.log("happiness");
    }
  });
}

module.exports = violet;
