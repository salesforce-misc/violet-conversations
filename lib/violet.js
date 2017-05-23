

var violetSvc = function(app) {
  // violet services - to modularize later >>>
  // a little kludgy - but it works
  var broadcast = () => {console.log('Broadcasting not initialized...');}
  app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

  var keyTypes = {};

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

  app.intent('closeSession', {"utterances": ["I am good", "No, I am good", "Thanks", "Thank you"]}, () => {}); // by default session ends
  // <<< violet services

  return violet;
};

module.exports = violetSvc;
