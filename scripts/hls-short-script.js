'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);

violet.addInputTypes({
  "patient": {
    "type": "AMAZON.US_FIRST_NAME"
  }
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
  resolve: (response) => {
    response.say('[[patient]]')
    response.say('I am concerned that it has been a long time since we last talked');
}});

violet.respondTo({
  name: 'SecondEncIntent',
  expecting: [
      "This is [[patient]] We meet again"
    ],
  resolve: (response) => {
    response.say('[[patient]]')
    response.say('Did you try to sneak away')
    response.say('I am glad that you are back')
}});

module.exports = violet;
