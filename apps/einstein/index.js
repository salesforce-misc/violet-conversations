'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'einstein' );

// violet services - to modulazie later >>>
// a little kludgy - but it works
var broadcast = () => {console.log('Broadcasting not initialized...');}
app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

var say = function(response, str) {
  broadcast({
    response: str
  });
  response.say(str);
  response.shouldEndSession(false);
}

app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	say(response, 'Sorry an error occured ' + error.message);
};
// <<< violet services

app.launch( function( request, response ) {
	say(response, 'Welcome to Einstein. What is your name and how old are you?');
});

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
    request.getSession().set('name', name);
    request.getSession().set('age', age);
    say(response, "Welcome " + name + " I heard that you are " + age + ". I will remember you.");
  }
);

app.intent("myAge", {
    "utterances": [
      "how old am I",
      "{do you know|what is} my age"
    ]
  },
  function(request, response) {
    var age = request.getSession().get('age');
    if (age)
      say(response, "I remember you telling me that you are " + age);
    else
      say(response, "I do not know your age.");
});

app.intent("myName", {
    "utterances": [
      "what do I call myself",
      "{do you know|what is} my name"
    ]
  },
  function(request, response) {
    var name = request.getSession().get('name');
    if (name)
      say(response, "I remember you telling me that you are " + name);
    else
      say(response, "I do not know your name.");
});

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
    say(response, "You asked for the number "+number);
});

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
    say(response, "A random number that you asked for is " + getRandomInt(0,100));
});

module.exports = app;
