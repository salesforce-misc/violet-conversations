'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'einstein' );
var violet = require('../../lib/violet.js')(app);


violet.addKeyTypes({
  "name": "AMAZON.US_FIRST_NAME",
  "age": "NUMBER",
  "number": "NUMBER"
});

violet.addPhraseEquivalents([
  ["name is", "name's"],
  ["I am", "I'm"],
  ["Do you know", "What is"],
  ["say", "give", "give me", "tell", "tell me"]
]);









violet.respondTo([
      "Is there anything interesting on Chatter?"
    ], (response) => {
    response.out("Yes. There is a post on the All Salesforce group and the SE Trailblazer group.");
});

violet.respondTo([
      "What is the post on the All Salesforce group about?"
    ], (response) => {
    response.out("Jim Cavalieri posted: Team - I am please to announce that V2MAX has been updated with FY18 V2MOM. Feel free to check out your V2MOM alignment with your team, manager, division, and the company. Should I continue, or would you like this post sent to you?");
});

violet.respondTo([
      "Yes, please email it to me."
    ], (response) => {
    response.out("Done. Anything else I can help you with?");
});








violet.respondTo([
      "What's up?",
      "What is happening?",
      "What is the alert about?"
    ], (response) => {
    response.out("You received an e-mail from David Torchiana. Your notes say that he is the CEO of Partners Healthcare.");
});

violet.respondTo([
      "I am busy. Can you forward it to Ash?"
    ], (response) => {
    response.out("Sure. Will do.");
    setTimeout(()=>{response.out("I do not see an Ash in your address book. Do you have an e-mail address?")}, 5000);
});

violet.respondTo([
      "Is there an Ashita Saluja in my address book?"
    ], (response) => {
    response.out("Found it. Should I forward the e-mail to her? And should I set up an Alias for Ash?");
});

violet.respondTo([
      "Yes and Yes"
    ], (response) => {
    response.out("Done and Done");
});



violet.respondTo("My name is ((name)) and I am ((age)) {years old|}",
  (response) => {
    response.out("Welcome ((name)) I heard that you are ((age)). I will remember you.");
    response.do(['saveInputIntoSession:name', 'saveInputIntoSession:age']);
});

violet.respondTo(["how old am I", "do you know my age"],
  (response) => {
    if (response.get('{{age}}'))
      response.out("I remember you telling me that you are {{age}}");
    else
      response.out("I do not know your age.");
});

violet.respondTo(["what do I call myself", "do you know my name"],
  (response) => {
    if (response.get('{{name}}'))
      response.out("I remember you telling me that you are {{name}}");
    else
      response.out("I do not know your name.");
});

violet.respondTo([
       "say the number {1-100|number}",
       "I want to hear you say the number {1-100|number}"],
  (response) => {
    response.out("You asked for the number ((number))");
});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

violet.respondTo([
      "say a random number",
      "I want to hear you say a random number"],
  (response) => {
    response.out("A random number that you asked for is " + getRandomInt(0,100));
});

module.exports = app;
