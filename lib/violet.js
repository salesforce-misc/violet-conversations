

var violetSvc = function(app) {
  // violet services - to modularize later >>>
  // a little kludgy - but it works
  var broadcast = () => {console.log('Broadcasting not initialized...');}
  app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

  // variable names and their types
  var keyTypes = {};

  // list(array) of equivalent phrases
  var phraseEquivalents = [];

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
    addKeyTypes: function(_keyTypes) {
      keyTypes = _keyTypes;
    },

    addPhraseEquivalents: function(_phraseEquivalents) {
      // add to phraseEquivalents after lowering case
      _phraseEquivalents.forEach((_equivSets) => {
        var newEquivSet = [];
        _equivSets.forEach((_phrase) => {
          newEquivSet.push(_phrase.toLowerCase());
        });
        phraseEquivalents.push(newEquivSet);
      });
    },

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
      };
      var processForPunctuation = function(userSpeech) {
        //change to variable/slot format: {{varName}} -> {-|varName}
        userSpeech = userSpeech.map(function(userSpeechItem) {
          return userSpeechItem.replace(/[,?]/g,'');
        });
        return userSpeech;
      }
      var processForSlots = function(userSpeech) {
        //change to variable/slot format: {{varName}} -> {-|varName}
        userSpeech = userSpeech.map(function(userSpeechItem) {
          return userSpeechItem.replace(/{{([a-z]*)}}/g,'{-|\$1}');
        });
        return userSpeech;
      }
      var processForPhraseEquivalents = function(userSpeech) {
        // return userSpeech;
        var max = userSpeech.length;
        for (var ndx = 0; ndx<max; ndx++) {
          var userSpeechItem = userSpeech[ndx];
          phraseEquivalents.forEach((equivSets) => {
            equivSets.forEach((phrase, phraseNdx) => {
              var addToUserSpeech = function(phraseEquivSet, foundPhrase, foundPhrasePos, foundPhraseNdx) {
                // go through everything in phraseEquivSet except foundPhraseNdx
                phraseEquivSet.forEach((phraseToInclude, phraseToIncludeNdx) => {
                  if (phraseToIncludeNdx == foundPhraseNdx) return;
                  var newPhrase = userSpeechItem.substring(0, foundPhrasePos) + phraseToInclude + userSpeechItem.substring(foundPhrasePos + foundPhrase.length);
                  userSpeech.push(newPhrase);
                });
              }
              var phrasePos = userSpeechItem.indexOf(phrase);
              if (phrasePos == -1) return;
              addToUserSpeech(equivSets, phrase, phrasePos, phraseNdx);
            });
          });
        }
        return userSpeech;
      }
      var intentParams = {};
      if (!Array.isArray(userSpeech)) {
        userSpeech = [userSpeech];
      }
      userSpeech = processForPunctuation(userSpeech);
      userSpeech = processForSlots(userSpeech);
      userSpeech = processForPhraseEquivalents(userSpeech);
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

  var fAlert = false;
  app.launch( function( request, response ) {
    if (fAlert) {
      _say(response, 'You have an alert.');
      return;
    }
  	_say(response, ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
  });
  var broadcastAlertState = () => {
    broadcast({alert: fAlert});
  };
  app.intent('setAlert', {"utterances": ["set alert"]}, (req, resp) => {fAlert=true; broadcastAlertState();});
  app.intent('unsetAlert', {"utterances": ["disable alert", "clear alert"]}, (req, resp) => {fAlert=false; broadcastAlertState();});

  app.intent('closeSession', {"utterances": ["I am good", "No I am good", "Thanks", "Thank you"]}, () => {}); // by default session ends
  // <<< violet services

  return violet;
};

module.exports = violetSvc;
