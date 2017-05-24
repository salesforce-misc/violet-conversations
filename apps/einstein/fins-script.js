'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'einstein' );
var violet = require('../../lib/violet.js')(app);
var request = require('request');


violet.addKeyTypes({
});

violet.addPhraseEquivalents([
  ["Do you know", "What is"],
  ["say", "give", "give me", "tell", "tell me"]
]);


var postToHaiku = function(showValue) {
  var options = { method: 'POST',
    url: 'https://dalai-lama-core.herokuapp.com/api/rebound',
    headers: { 'content-type': 'application/json' },
    body: { type: 'customapi', title: 'Einstein', value: showValue },
    json: true };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log(body);
  });
}

violet.respondTo([
      "Can you show me all",
      "Einstein, Can you show me all"
    ], function(respond) {
    response.out(["Sure. Will do.", "Ok. Done"]);
    postToHaiku("all");
});

violet.respondTo([
      "Can you show me by category",
      "Einstein, Can you show me by category"
    ], function(respond) {
    response.out(["Sure. Will do.", "Ok. Done"]);
    postToHaiku("category");
});

violet.respondTo([
      "Can you show me by amount",
      "Einstein, Can you show me by amount"
    ], function(respond) {
    response.out(["Sure. Will do.", "Ok. Done"]);
    postToHaiku("amount");
});

violet.respondTo([
      "Can you show me recommendations",
      "Einstein, Can you show me recommendations"
    ], function(respond) {
    response.out(["Sure. Will do.", "Ok. Done"]);
    postToHaiku("recommendations");
});

violet.respondTo([
      "I love you",
      "Einstein, I love you"
    ], function(respond) {
    response.out("I have known that for some time.");
});

module.exports = app;
