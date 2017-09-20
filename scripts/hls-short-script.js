'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);

violet.addKeyTypes({
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
  name: 'MajorIntent',
  expecting: [
      "I am [[patient]] What are you doing"
    ],
  resolve: (response) => {
    response.say('Major thing happened, [[patient]]');
}});


module.exports = violet;
