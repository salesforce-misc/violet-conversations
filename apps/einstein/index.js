'use strict';

var alexa = require( 'alexa-app' );
var app = new alexa.app( 'einstein' );

// violet services - to modularize later >>>
// a little kludgy - but it works
var broadcast = () => {console.log('Broadcasting not initialized...');}
app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

var _getRand = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

var _say = function(response, potResponses) {
  var str = potResponses;
  if (Array.isArray(potResponses)) {
    str = potResponses[_getRand(0, potResponses.length)];
  }
  broadcast({
    response: str
  });
  response.say(str);
  response.shouldEndSession(false);
}
var _extractParamsFromSpeech = function(userSpeech) {
  var expectedParams = {};
  userSpeech.forEach((speechStr) => {
    var extractedVars = speechStr.match(/\|[a-z]*}/g);
    if (!extractedVars) return;
    extractedVars.forEach((extractedVar) => {
      var ev = extractedVar.slice(1,-1); // strip first and last characters
      if (ev.length == 0) return;
      if (keyTypes[ev]) {
        expectedParams[ev] = keyTypes[ev];
      } else {
        console.log('Received undexpected type :', ev);
        expectedParams[ev] = 'AMAZON.LITERAL';
      }
    });
  });
  return expectedParams;
}

var _registeredIntents = 0;
var violet = {
  respondTo: function(userSpeech, responseImplCB) {
    var genIntentName = function() {
      // trying to generate: A, B, C, ... Z, AA, AB, AC, ... AZ, BA, BB, ...
      var validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var indices = _registeredIntents.toString(validChars.length);
      var retStr = 'Intent';
      for(var ndxOfIndices=0; ndxOfIndices<indices.length; ndxOfIndices++) {
        retStr += validChars.charAt(parseInt(indices.charAt(ndxOfIndices), validChars.length));;
      }
      _registeredIntents++;
      return retStr;
    }
    var intentParams = {};
    if (!Array.isArray(userSpeech)) {
      userSpeech = [userSpeech];
    }
    intentParams["utterances"] = userSpeech;
    var expectedParams = _extractParamsFromSpeech(userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams["slots"] = expectedParams;

    console.log('registering: ', intentParams);
    app.intent(genIntentName(), intentParams, (req, resp) => {
      var respond = (potResponses) => {_say(resp, potResponses)};
      var params = (varName) => {return req.slot(varName);};
      var session = req.getSession();
      responseImplCB(respond, params, session, req, resp);
    });
  }
}

app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	_say(response, 'Sorry an error occured ' + exception.message);
};

app.launch( function( request, response ) {
	_say(response, ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
});
// <<< violet services

var keyTypes = {
  "name": "AMAZON.US_FIRST_NAME",
  "age": "NUMBER",
  "number": "NUMBER"
}



violet.respondTo("my {name is|name's} {-|name} and {I am|I'm} {-|age}{ years old|}",
  function(respond, params, session) {
    var name = params('name');
    var age = params('age');
    respond("Welcome " + name + " I heard that you are " + age + ". I will remember you.");
    session.set('name', name);
    session.set('age', age);
});

violet.respondTo(["how old am I", "{do you know|what is} my age"],
  function(respond, params, session) {
    var age = session.get('age');
    if (age)
      respond("I remember you telling me that you are " + age);
    else
      respond("I do not know your age.");
});

violet.respondTo(["what do I call myself", "{do you know|what is} my name"],
  function(respond, params, session) {
    var name = session.get('name');
    if (name)
      respond("I remember you telling me that you are " + name);
    else
      respond("I do not know your name.");
});

violet.respondTo([
       "say the number {1-100|number}",
       "give me the number {1-100|number}",
       "tell me the number {1-100|number}",
       "I want to hear you say the number {1-100|number}"],
  function(respond, params) {
    var number = params('number');
    respond("You asked for the number "+number);
});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

violet.respondTo([
      "say a random number",
      "give me a random number",
      "tell me a random number",
      "I want to hear you say a random number"],
  function(respond) {
    respond("A random number that you asked for is " + getRandomInt(0,100));
});

module.exports = app;
