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
  expecting: ['Check in', 'Can I check in', 'I would like to check in'],
  resolve: (response) => {
   response.say('Sure.');
   response.addGoal('checkIn');
}});

violet.defineGoal({
  goal: 'checkIn',
  prompt: ['Did you check your blood sugar level today?'],
  respondTo: [{
    expecting: ['Yes', 'I tested my blood sugar level'],
    resolve: (response) => {
     response.say('Great.');
  }}, {
    expecting: ['No', 'I cannot test my blood sugar level'],
    resolve: function *(response) {
      var results = yield response.load('Patient_Generated_Data', 'defaultEmail', 'default@haiku.dev', 'FieldName__c = \'bloodSugar\'', 'ORDER BY LoggedTime__c');
      if (results.length == 0) {
        response.say('You have not checked in since your doctors visit. We think you should connect to your care team now.');
        sendSOS();
        return;
      }

      var sugar = 0;
      var cnt = 0;

      results.forEach((rec, i)=>{
        console.log(rec.FieldValue);
        sugar += parseInt(rec.FieldValue);
        cnt = cnt + 1;
      });

      console.log(sugar);
      console.log(cnt);
      console.log(sugar/cnt);

      var speechOutput = 'Your average blood sugar has been ' + Math.floor(sugar/cnt);

      response.say(speechOutput);
      response.say('We think you should connect to your care team now.');
      sendSOS();
  }}]
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
