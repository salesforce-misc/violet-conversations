'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);

violet.respondTo([
      "{Are|} you there"
    ], (response) => {
    response.say(["Yep.  How can I help?", "I am"]);
});

violet.respondTo([
      "{Tell me|} {about|} How does Executive Immersion view technology"
    ], (response) => {
    response.say([`
      Experiences that use cutting edge tools like myself are a foundation for
      driving conversation, opening executive minds to the breadth of Salesforce
      and the opportunity to influence change.  We love impact and results -
      technology is just the vehicle.  Was that helpful?`]);
});

violet.respondTo([
      "{Perfect|} {Wait|} was this a conversation",
    ], (response) => {
    response.say(["Yes, it was.  Very astute observation."]);
});

violet.respondTo([
      "Alexa doesn't do that {though|}",
    ], (response) => {
    response.say(["Think of Alexa and I as good buddies - we just work together to be better.  I also natively talk to Salesforce"]);
});

violet.respondTo([
      "{Perfect|} {Wow|} {That is great|} Thanks {for sharing|}",
      "Thank you"
    ], (response) => {
    response.say(["My pleasure.  Hope everyone is enjoying the session"]);
});

module.exports = violet;
