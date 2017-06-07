///////////
// utility functions
///////////
var _getRand = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};
var _registeredIntents = 0;
var _genIntentName = _getAlphabeticStr = function() {
  // trying to generate: A, B, C, ... Z, AA, AB, AC, ... AZ, BA, BB, ...
  // intent names cannot have digits in them
  var validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var indices = _registeredIntents.toString(validChars.length);
  var retStr = 'Intent';
  for(var ndxOfIndices=0; ndxOfIndices<indices.length; ndxOfIndices++) {
    retStr += validChars.charAt(parseInt(indices.charAt(ndxOfIndices), validChars.length));;
  }
  _registeredIntents++;
  return retStr;
};
var _interpolate = function(originalStr, foundStr, foundStrPos, replaceStr) {
  return originalStr.substring(0, foundStrPos) + replaceStr + originalStr.substring(foundStrPos + foundStr.length);
}


///////////
// this is the main object that is exposed by the module
///////////
// a little kludgy - but it works
module.exports = function(app) {
  var broadcast = () => {console.log('Broadcasting not initialized...');}
  app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

  const paramsRE = /\(\(([a-z]*)\)\)/g; // from user input
  const sessionRE = /{{([a-z]*)}}/g;    // from the session
  const storeRE = /<<([a-z]*)>>/g;      // from permanent store (database, etc)

  // variable names and their types
  var keyTypes = {};

  // list(array) of equivalent phrases
  var phraseEquivalents = [];

  var outBuffer = '';

  var _sayInit = function() {
    outBuffer = '';
  }
  var _say = function(response, potResponses, params=()=>{return 'err';}) {
    var str = potResponses;
    if (Array.isArray(potResponses)) {
      str = potResponses[_getRand(0, potResponses.length)];
    }
    var getParamValuesFromStore = function(str, varExtractionRE, store) {
      var varMatch;
      while ((varMatch = varExtractionRE.exec(str)) != null) {
        // varMatch[0] - {{varName}}
        // varMatch[1] - varName
        // varMatch.index - match position
        // input - input string
        str = _interpolate(str, varMatch[0], varMatch.index, store.get(varMatch[1]));
      }
      return str;
    };
    str = getParamValuesFromStore(str, paramsRS, params);
    str = getParamValuesFromStore(str, sessionRE, session);

    outBuffer += str;
  }
  var _sayFinish = function(repsonse, potResponses) {
    _say(response, potResponses);
    broadcast({
      response: outBuffer
    });
    response.say(outBuffer);
    response.shouldEndSession(false);
    outBuffer = '';
  }
  var _extractParamsFromSpeech = function(userSpeech) {
    var expectedParams = {};
    userSpeech.forEach((speechStr) => {
      var extractedVars = speechStr.match(/{-\|[a-z]*}/g);
      if (!extractedVars) return;
      extractedVars.forEach((extractedVar) => {
        var ev = extractedVar.slice(3,-1); // strip first-three and last characters
        if (ev.length == 0) return;
        if (keyTypes[ev]) {
          expectedParams[ev] = keyTypes[ev];
        } else {
          console.log('Received unexpected type :', ev);
          expectedParams[ev] = 'AMAZON.LITERAL';
        }
      });
    });
    return expectedParams;
  }

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

    meetGoal: function(goalObj) {
      console.log('*** violet.meetGoal - NOT IMPLEMENTED YET!!');
      if (goalObj.respondTo) {
        goalObj.respondTo.forEach((respondObj) => {
          violet.respondTo(respondObj);
        });
      }
    },

    respondTo: function(userSpeech, responseImplCB) {
      var processForPunctuation = function(userSpeech) {
        //change to variable/slot format: {{varName}} -> {-|varName}
        userSpeech = userSpeech.map(function(userSpeechItem) {
          return userSpeechItem.replace(/[,?]/g,'');
        });
        return userSpeech;
      }
      var processForSlots = function(userSpeech) {
        //change to variable/slot format: ((varName)) -> {-|varName}
        userSpeech = userSpeech.map(function(userSpeechItem) {
          return userSpeechItem.replace(paramsRE,'{-|\$1}');
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
                  userSpeech.push(_interpolate(userSpeechItem, foundPhrase, foundPhrasePos, phraseToInclude));
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
      if (typeof userSpeech == 'object' && !Array.isArray(userSpeech)) {
        var respondObj = userSpeech;
        violet.respondTo(respondObj.expecting, respondObj.resolve);
        return;
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
      app.intent(_genIntentName(), intentParams, (req, resp) => {
        var params = {
          get: (varName) => { return req.slot(varName); }
        };
        var session = req.getSession();
        var response = {
          out: (potResponses) => {_say(resp, potResponses, params, session)},
          get: (varStr) => {
            var varMatch;
            varMatch = paramsRE.exec(varStr);
            if (varMatch != null)
              return params.get(varMatch[1]);

            varMatch = sessionRE.exec(varStr);
            if (varMatch != null)
              return session.get(varMatch[1]);

            return "store type not found";
          },
          set: () => {console.log('*** response.set - NOT IMPLEMENTED YET!!');},
          addGoal: () => {console.log('*** response.addGoal - NOT IMPLEMENTED YET!!');},
          goalFilled: (destParamName, srcParamName) => {
            if (response.get(destParamName))
              return true;
            if (response.get(srcParamName)) {
              response.set(destParamName, response.get(srcParamName));
              return true;
            }
            response.addGoal(destParamName);
            return false;
          }
        };
        _sayInit();
        responseImplCB(respond, params, session, req, resp);
        _sayFinish(resp);
      });
    }
  }

  app.error = function( exception, request, response ) {
  	console.log(exception)
  	console.log(request);
  	console.log(response);
    _sayFinish(response, 'Sorry an error occured ' + exception.message);
  };

  var fAlert = false;
  app.launch( function( request, response ) {
    if (fAlert) {
      _sayFinish(response, 'You have an alert.');
      return;
    }
    _sayFinish(response, ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
  });
  var broadcastAlertState = () => {
    broadcast({alert: fAlert});
  };
  app.intent('setAlert', {"utterances": ["set alert"]}, (req, resp) => {fAlert=true; broadcastAlertState();});
  app.intent('unsetAlert', {"utterances": ["disable alert", "clear alert"]}, (req, resp) => {fAlert=false; broadcastAlertState();});

  app.intent('closeSession', {"utterances": ["I am good", "No I am good", "Thanks", "Thank you"]}, () => {}); // by default session ends

  return violet;
};
