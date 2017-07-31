'use strict';

var violet = require('../lib/violet.js')('einstein');
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);

var violetSFStore = require('../lib/violetStoreSF.js')(violet);

violetSFStore.store.propOfInterest = {
  'diabetesLog': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
}

const preference = "photography";
const skill = "sales force";
const hours = "4";

violet.addKeyTypes({
});

//common across multiple goals
violet.addPhraseEquivalents([
]);

violet.addTopLevelGoal();

violet.respondTo({
  expecting: ['Can you help me find a new volunteer opportunity', 'Find a new volunteer opportunity', 'I would like to find a volunteer opportunity'],
  resolve: (response) => {
   response.say('Sure.');
   response.addGoal('{{startInterest}}');
}});

violet.defineGoal({
  goal: '{{startInterest}}',
  prompt: ['I see that we have someone who is interested in ' + preference + '<break time=“500ms”/> Would you be interested in volunteer opportunities related to ' + preference],
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
  prompt: ['Okay, I see that we have someone who is good at ' + skill + '<break time=“500ms”/> Would you be interested in volunteer opportunities related to ' + skill],
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
  prompt: ['Okay, I see that you have ' + hours + ' hours left to meet this quarter\'s volunteeer opportunity. <break time=“500ms”/>Should I look for opportunities that meet those hours'],
  respondTo: [{
    expecting: ['Yes', 'Sure'],
    resolve: (response) => {
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

module.exports = violet;
