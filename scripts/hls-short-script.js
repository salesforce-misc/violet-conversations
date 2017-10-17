'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var request = require('request');

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'Patient_Generated_Data': ['FieldName', 'FieldValue', 'LoggedDate', 'LoggedTime']
}
//common across multiple goals
violet.addPhraseEquivalents([
]);
violet.addKeyTypes({
  "patient": {
    "type": "AMAZON.US_FIRST_NAME"
  },
  "bloodSugarLvl": "NUMBER",
});

violet.respondTo([
      "Hello"
    ], (response) => {
    response.say(['Hi!']);
});

violet.respondTo({
  name: 'FirstEncIntent',
  expecting: [
      "I am [[patient]] I see you for the first time"
    ],
  resolve: function *(response) {
    var results = yield response.load('Patient_Generated_Data', 'defaultEmail', 'default@haiku.dev', 'FieldName__c = \'bloodSugar\'', 'ORDER BY LoggedTime__c');
    response.say('[[patient]]')
    response.say('I am concerned that it has been a long time since we last talked');
    response.say("Actually, it looks like you have missed 4 checkins");
    response.say('We are connecting you to your care team now');

    sendSOS();
}});

violet.respondTo({
  name: 'SecondEncIntent',
  expecting: [
      "This is [[patient]] We meet again"
    ],
  resolve: function *(response) {
    response.say('[[patient]]')
    response.say('Did you try to sneak away')
    response.say('I am glad that you are back')
    response.say("It looks like you have missed 4 checkins");
    response.say('We are connecting you to your care team now');

    sendSOS();
}});

violet.respondTo({
  name: 'UnsureIntent',
  expecting: [
      "Who are you [[patient]]"
    ],
  resolve: function *(response) {
    response.say('I am not sure if I know you')
    response.say('You do not seem like [[patient]]')
    response.say('If you see [[patient]], can you tell them that we miss them?')
}});

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
