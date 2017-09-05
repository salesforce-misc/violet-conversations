'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var request = require('request');
var requestP = require('request-promise');

var showCodeBlock = function() {
  var options = { method: 'POST',
    url: 'https://dalai-lama-core.herokuapp.com/api/thrive/rebound',
    headers: { 'content-type': 'application/json' },
    body: {
      "kiosktype": "message",
      "mode" : "code"
    },
    json: true };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log(body);
  });
}

violet.setSpokenRate('fast');

violet.respondTo([
      "Whats up",
      "{Are|} you there",
      "{Do you|} have a moment"
    ], (response) => {
    var queryForcebitOrderUrl = 'http://haiku-core-parker.herokuapp.com/api/records/Forcebit_Order__c';
    return requestP({uri: queryForcebitOrderUrl, json:true}).then((forcebitOrder)=>{
        console.log(forcebitOrder[0]);
        response.say(`I have a trail map for your ${forcebitOrder[0].expedition_name__c} trip with ${forcebitOrder[0].leader_name__c}. Do you mind if I show you?`);
    });
});

violet.respondTo([
      "Definitely, that would be great"
    ], (response) => {
    showCodeBlock();
    response.say([`
      Great - here it is.
      `]);
});

violet.respondTo([
      "{Perfect|} {Wait|} was this a conversation",
    ], (response) => {
    response.say([`Very astute observation John.`]);
});

violet.respondTo([
      "But Alexa doesn't do that {though|}",
    ], (response) => {
    postToThrive();
    response.say(["Alexa and I as good buddies, but successful conversations are all about knowing the customer.  This is an example of us working together."]);
});

violet.respondTo([
      "{Perfect|Wow} {That is great|} Thanks {for sharing|}",
      "Thank you"
    ], (response) => {
    response.say(["My pleasure.  Hope everyone is enjoying the session"]);
    response.endConversation();
});

module.exports = violet;
