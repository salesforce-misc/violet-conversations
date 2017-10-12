'use strict';

/*
Known challenges:
1. We need to get the ICS file from the appropriate teams
2. We likely want to use subsets of the loaded events, i.e. depending on the
   users request we want to return only the first items starting afer DTSTART
   and DTSTART;VALUE=DATE properties
3. If ics is large, we will likely need to not store everything in the session
   store
*/

var moment = require('moment-timezone');
var request = require('request');
var ical2json = require("ical2json");

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);
var violetVTOEventsList = require('../lib/violetList.js')(violet, 'VTOEvents', 'event', 'events', 'SUMMARY');
var violetOhanaGroupEventsList = require('../lib/violetList.js')(violet, 'OhanaGroupEvents', 'event', 'events', 'SUMMARY');

violet.addPhraseEquivalents([
  ['hear', 'tell me'],
]);

violet.addInputTypes({
  "eventNo": "NUMBER"
});

// load the ics information
var loadICS = (url, cb)=>{
  request(url, (err, resp, body)=>{
    if (err) {
      console.log('err', err);
      return;
    }
    var events = ical2json.convert(body);
    events = events.VCALENDAR[0].VEVENT;
    console.log(`Loaded ${events.length} events from ${url}`);
    cb(events);
  });
};

// vf
var vtoEventsICSurl = 'https://calendar.google.com/calendar/ical/vineet.sinha%40gmail.com/private-1a09cdbd889c101c0a6cda1d6ceab2af/basic.ics';
var vtoEvents = null;
loadICS(vtoEventsICSurl, (eventsVal)=>{vtoEvents=eventsVal});

// og
// var ohanaGroupICSurl = '';
// var ohanaGroupEvents = null;
// loadICS(ohanaGroupICSurl, (eventsVal)=>{ohanaGroupEvents=eventsVal});

var ack = (response) => { response.say(['Got it.', 'Great.', 'Awesome']); }

// define the interactions
violet.defineGoal({
  goal: violetVTOEventsList.interactionGoal(),
  prompt: [`Would you like to hear more about an event or go back`],
  respondTo: [{
    expecting: [`{hear|} more about event [[eventNo]]`],
    resolve: (response) => {
      var article = violetVTOEventsList.getItemFromResults(response, response.get('eventNo'));
      response.say('Event ' + article.SUMMARY + ' has description ' + article.DESCRIPTION);
  }}, {
    expecting: ['go back'],
    resolve: function (response) {
      ack(response);
  }}]
});

violet.defineGoal({
  goal: violetOhanaGroupEventsList.interactionGoal(),
  prompt: [`Would you like to hear more about an event or go back`],
  respondTo: [{
    expecting: [`{hear|} more about event [[eventNo]]`],
    resolve: (response) => {
      var article = violetOhanaGroupEventsList.getItemFromResults(response, response.get('eventNo'));
      response.say('Event ' + article.SUMMARY + ' has description ' + article.DESCRIPTION);
  }}, {
    expecting: ['go back'],
    resolve: function (response) {
      ack(response);
  }}]
});

violet.respondTo({
  expecting: [
      '{what are the|are there} vto events next week'
  ],
  resolve: function (response) {
    ack(response);
    violetVTOEventsList.respondWithItems(response, vtoEvents);
}});

violet.respondTo({
  expecting: [
      '{what are the|are there} ohana group next week'
  ],
  resolve: function (response) {
    ack(response);
    violetOhanaGroupEventsList.respondWithItems(response, ohanaGroupEvents);
}});

module.exports = violet;
