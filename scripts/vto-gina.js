'use strict';

var violet = require('../lib/violet.js')('einstein');
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);

var violetSFStore = require('../lib/violetStoreSF.js')(violet);

violetSFStore.store.propOfInterest = {
  'VTO_Preference': ['Id*', 'name', 'hours', 'likes', 'skills'],
  'Activity': ['Id*', 'Likes', 'Hours', 'Skills']
}

var likes = "photography";
var skill = "sales force";
var hours = "4";
var personName = "Gina";

violet.addKeyTypes({
});

//common across multiple goals
violet.addPhraseEquivalents([
]);

violet.addTopLevelGoal();

violet.respondTo({
  expecting: ['Can you help me find a new volunteer opportunity', 'Find a new volunteer opportunity', 'I would like to find a volunteer opportunity'],
  resolve: function *(response) {
   var VTOPreferenceObject = yield response.load('<<VTO_Preference>>', '<<VTO_Preference.name>>', personName, null, null);
   response.say('Sure.');
   console.log(VTOPreferenceObject);
   if (VTOPreferenceObject.length > 0) {
     likes = VTOPreferenceObject[0].likes;
     console.log(likes);
     response.set('{{likes}}', likes);
     skill = VTOPreferenceObject[0].skills;
     console.log(skill);
     response.set('{{skill}}', skill);
     hours = VTOPreferenceObject[0].hours;
     console.log(hours);
     response.set('{{hours}}', hours);
     response.addGoal('{{startInterest}}');
   }
}});

violet.defineGoal({
  goal: '{{startInterest}}',
  prompt: ['I see that we have someone who is interested in {{likes}} <break time=“500ms”/> Would you be interested in volunteer opportunities related to {{likes}}' ],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: (response) => {
     response.addGoal('{{checkHours}}');
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.addGoal('{{startSkill}}');
  }}]
});

violet.defineGoal({
  goal: '{{startSkill}}',
  prompt: ['Okay, I see that we have someone who is good at {{skills}} <break time=“500ms”/> Would you be interested in volunteer opportunities related to {{skills}}'],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: (response) => {
     response.addGoal('{{checkHours}}');
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.say('I am sorry.');
      response.say('I do not think I can help you today');
  }}]
});

violet.defineGoal({
  goal: '{{checkHours}}',
  prompt: ['Okay, I see that you have {{hours}} hours left to meet this quarter\'s volunteeer opportunity. <break time=“500ms”/>Should I look for opportunities that meet those hours'],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: function *(response) {
      var s1 = '\'%' + response.get('{{likes}}') + '%\'';
      console.log(s1);
      var results = yield response.load('Activity', null, null, ' Likes__c LIKE  ' + s1﻿);
      response.addGoal('{{searchVTOMatchingHours}}');
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.addGoal('{{searchVTOAllHours}}');
  }}]
});

violet.defineGoal({
  goal: '{{searchVTOMatchingHours}}',
  prompt: ['Here are the opportunities that I found near you. Would you like me to email them to you'],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: (response) => {
     response.say('I will email to you');
     response.say('Have fun');
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.say('Okay. Sounds good');
  }}]
});

violet.defineGoal({
  goal: '{{searchVTOAllHours}}',
  prompt: ['Here are the opportunities that I found near you. Would you like me to text them to you'],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: (response) => {
     response.say('I will text them to you');
     response.say('Have fun');
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.say('Okay. Sounds good');
  }}]
});

module.exports = violet;
