'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'einstein' );


app.launch( function( request, response ) {
	response
      .say( 'Welcome to Einstein. What is your name and how old are you?' )
      .shouldEndSession( false );
} );


app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	response.say( 'Sorry an error occured ' + error.message);
};

app.intent("welcome", {
    "slots": {
      "name": "AMAZON.US_FIRST_NAME",
      "age": "NUMBER"
    },
    "utterances": [
      "my {name is|name's} {-|name} and {I am|I'm} {-|age}{ years old|}"
    ]
  },
  function(request, response) {
    var name = request.slot('name');
    var age = request.slot('age');
    //session.getSession().set('age', age);
    response.say("Welcome " + name + " I will remember that you are " + age);
  }
);

app.intent("myAge", {
    "utterances": [
      "how old am I",
      "do you know my age",
      "what is my age"
    ]
  },
  function(request, response) {
    var age = request.getSession().get('age');
    if (age)
      response.say("I remember you telling me that you are " + age);
    else
      response.say("I do not know your age.");
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
    response.say("A random number that you asked for is " + getRandomInt(0,100));
  }
);

module.exports = app;
