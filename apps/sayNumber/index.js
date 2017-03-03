'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'say-number' );


app.launch( function( request, response ) {
	response.say( 'Welcome to your test skill' ).reprompt( 'Way to go. You got it to run. Bad ass.' ).shouldEndSession( false );
} );


app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	response.say( 'Sorry an error occured ' + error.message);
};

app.intent("welcome", {
    "slots": {
      "NAME": "AMAZON.US_FIRST_NAME",
      "AGE": "NUMBER"
    },
    "utterances": [
      "my {name is|name's} {NAME} and {I am|I'm} {-|AGE}{ years old|}"
    ]
  },
  function(request, response) {
    var age = request.slot('AGE');
    var name = request.slot('NAME');
    response.say("Welcome " + name + " I will remember that you are " + age);
  }
);

app.intent('saySpecificNumber',
  {
    "slots":{"number":"NUMBER"},
  	"utterances":[
  		"say the number {1-100|number}",
      "give me the number {1-100|number}",
  		"tell me the number {1-100|number}",
  		"I want to hear you say the number {1-100|number}"]
  },
  function(request,response) {
    var number = request.slot('number');
    response.say("You asked for the number "+number);
  }
);
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
app.intent('sayRandomNumber',
  {
	  "utterances":[
  		"say a random number",
      "give me a random number",
  		"tell me a random number",
  		"I want to hear you say a random number"]
  },
  function(request,response) {
    response.say("You asked for the number "+getRandomInt(0,100));
  }
);

module.exports = app;
