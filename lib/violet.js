///////////
// utility functions
///////////
var _getRand = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};
var _getNumAsStr = function(num) {
  if (typeof num == 'string') num = parseInt(num);
  if (num<0) return 'err';
  if (num<20) switch(num) {
    case 1: return 'one';
    case 2: return 'two';
    case 3: return 'three';
    case 4: return 'four';
    case 5: return 'five';
    case 6: return 'six';
    case 7: return 'seven';
    case 8: return 'eight';
    case 9: return 'nine';
    case 10: return 'ten';
    case 11: return 'eleven';
    case 12: return 'twelve';
    case 13: return 'thirteen';
    case 14: return 'fourteen';
    case 15: return 'fifteen';
    case 16: return 'sixteen';
    case 17: return 'seventeen';
    case 18: return 'eighteen';
    case 19: return 'nineteen';
  };
  if (num<20+10) return 'twenty ' + _getNumAsStr(num-20);
  if (num<30+10) return 'thirty ' + _getNumAsStr(num-30);
  if (num<40+10) return 'forty ' + _getNumAsStr(num-40);
  if (num<50+10) return 'fifty ' + _getNumAsStr(num-50);
  if (num<60+10) return 'sixty ' + _getNumAsStr(num-60);
  if (num<70+10) return 'seventy ' + _getNumAsStr(num-70);
  if (num<80+10) return 'eighty ' + _getNumAsStr(num-80);
  if (num<90+10) return 'ninety ' + _getNumAsStr(num-90);
  if (num<100+100) return 'one hunder ' + _getNumAsStr(num-100);
  if (num<200+100) return 'two hunder ' + _getNumAsStr(num-200);
  if (num<300+100) return 'three hunder ' + _getNumAsStr(num-300);
  if (num<400+100) return 'four hunder ' + _getNumAsStr(num-400);
  if (num<500+100) return 'five hunder ' + _getNumAsStr(num-500);
  if (num<600+100) return 'six hunder ' + _getNumAsStr(num-600);
  if (num<700+100) return 'seven hunder ' + _getNumAsStr(num-700);
  if (num<800+100) return 'eight hunder ' + _getNumAsStr(num-800);
  if (num<900+100) return 'nine hunder ' + _getNumAsStr(num-900);
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
var _interpolateParamsFromStore = function(str, varExtractionRE, store) {
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


///////////
// this is the main object that is exposed by the module
///////////
// a little kludgy - but it works
module.exports = function(app) {
  var broadcast = () => {console.log('Broadcasting not initialized...');}
  app.setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

  const paramsRE   = /\[\[([a-zA-Z]*)\]\]/;  // from user input
  const paramsGRE  = /\[\[([a-zA-Z]*)\]\]/g;
  const sessionRE  = /{{([a-zA-Z]*)}}/;      // from the session
  const sessionGRE = /{{([a-zA-Z]*)}}/g;
  const storeRE    = /<<([a-zA-Z\.]*)>>/;    // from permanent store (database, etc)
  const storeGRE   = /<<([a-zA-Z\.]*)>>/g;

  // variable names and their types
  var keyTypes = {};

  // list(array) of equivalent phrases
  var phraseEquivalents = [];

  var asked = false;
  var outBuffer = '';

  var _sayInit = function() {
    asked = false;
    outBuffer = '';
  }
  var _say = function(response, potResponses) {
    var str = potResponses;
    if (Array.isArray(potResponses)) {
      str = potResponses[_getRand(0, potResponses.length)];
    }
    if (response) { // unlikely, but in error situations response can be null
      str = _interpolateParamsFromStore(str, paramsGRE, response._paramsStore());
      str = _interpolateParamsFromStore(str, sessionGRE, response._sessionStore());
      str = _interpolateParamsFromStore(str, storeGRE, response._persistentStore());
    }

    if (!str) console.log(new Error().stack);
    console.log('Adding to outBuffer: ' + str);
    if (outBuffer.length == 0)
      outBuffer = str;
    else
      outBuffer += ' <break time="500ms"/> ' + str;
  }
  var _ask = function(response, potResponses) {
    _say(response, potResponses);
    asked = true;
  }
  var _sayFinish = function(resp, response, potResponses) {
    if (potResponses) _say(response, potResponses);
    broadcast({
      response: outBuffer
    });
    resp.say(outBuffer);
    resp.shouldEndSession(false);
    _sayInit();
  }
  var _extractParamsFromSpeech = function(userSpeech) {
    var expectedParams = {};
    userSpeech.forEach((speechStr) => {
      var extractedVars = speechStr.match(/{-\|[a-zA-Z]*}/g);
      if (!extractedVars) return;
      extractedVars.forEach((extractedVar) => {
        var ev = extractedVar.slice(3,-1); // strip first-three and last characters
        if (ev.length == 0) return;
        if (keyTypes[ev]) {
          expectedParams[ev] = keyTypes[ev];
          if (typeof expectedParams[ev] == 'object') {
            expectedParams[ev]=expectedParams[ev].type;
          }
        } else {
          console.log('Received unexpected type :', ev);
          expectedParams[ev] = 'AMAZON.LITERAL';
        }
      });
    });
    return expectedParams;
  };

  var __speaking = false;
  var _setSpeaking = () => { __speaking = true; }
  var _clearSpeaking = () => { __speaking = false; }
  var _speaking = () => { return __speaking; }

  var fAlert = [];

  var _setAlert = (cause) => {
    var broadcastAlertState = () => {
      broadcast({alert: fAlert.length > 0});
    };
    fAlert.push(cause);
    broadcastAlertState();
  };
  var _clearAlert = (cause) => {
    var ndx = fAlert.indexOf(cause);
    if (ndx > 0) flert.splice(ndx, 1);
  }

  var registeredGoals = {};
  var goalsToMeet = [];
  var topLevelGoals = [];

  var _addGoal = (goal) => {
    console.log('--> Goal added: ' + goal);
    goalsToMeet.push(goal);
    if (!_speaking()) {
      violet.setAlert('{{unmetGoals}}');
    }
  };
  var _addTopLevelGoal = (goal) => {
    console.log('--> TL Goal added: ' + goal);
    topLevelGoals.push(goal);
  };

  // response - conversationalResponse object
  // tgtGoal - removed from the goalsToMeet list when tgtResolve is done without error; can be null
  // tgtResolve - what triggered us right now
  var _followGoals = (response, tgtGoal, tgtResolve) => {
    // console.log('--> Triggered Goal: ' + triggeredGoal);

    var top = (arr)=>{if (arr.length==0) return undefined; else return arr[arr.length-1];}
    var remove = (arr, obj)=>{var ndx=arr.indexOf(obj); if (ndx!=-1) arr.splice(ndx,1);}
    var resolveGoal = (tgtResolve, tgtGoal, response) => {
      var result = tgtResolve(response);
      if (result==true || result==undefined) remove(goalsToMeet, tgtGoal);
    };

    if (tgtResolve) resolveGoal(tgtResolve, tgtGoal, response);

    var lastGoal = null;
    _clearAlert('{{unmetGoals}}');

    while (asked == false) {
      var tgtGoal = top(goalsToMeet);
      if (!tgtGoal) return;

      var tgtGoalObj = registeredGoals[tgtGoal];
      if (tgtGoal == lastGoal) return; // we did not add goals or remove goals - something is wrong!
      lastGoal = tgtGoal;

      console.log('--> Trying to meet goal: ' + tgtGoal);
      if (tgtGoalObj.resolve) {
        resolveGoal(tgtGoalObj.resolve, tgtGoal, response);
      } else if (tgtGoalObj.prompt) {
        _ask(response, tgtGoalObj.prompt);
      } else {
        console.log('*** Goal: ' + tgtGoal + ' -- does not have resolve or prompt');
      }
    };
  };

  var persistentStore = null;

  // only called by _processIntent
  var __getResponse = (req, resp) => {
    var paramsStore = {
      get: (varName) => { return req.slot(varName); }
    };
    var sessionStore = req.getSession();
    var response = {

      // for advanced users
      _paramsStore: () => {return paramsStore;},
      _sessionStore: () => {return sessionStore;},
      _persistentStore: () => {return persistentStore;},

      say: (potResponses) => {_say(response, potResponses)},
      ask: (potResponses) => {_ask(response, potResponses)},
      get: (varStr) => {
        var varMatch;
        varMatch = paramsRE.exec(varStr);
        if (varMatch != null) {
          if (varMatch[1] == 'userId') return req.userId;
          return paramsStore.get(varMatch[1]);
        }

        varMatch = sessionRE.exec(varStr);
        if (varMatch != null)
          return sessionStore.get(varMatch[1]);

        varMatch = storeRE.exec(varStr);
        if (varMatch != null)
          return _persistentStore.get(varMatch[1]);

        return "store type not found";
      },
      set: (varStr, val) => {
        var varMatch;
        varMatch = paramsRE.exec(varStr);
        if (varMatch != null) {
          console.log('cannot set an input variable');
          return;
        }

        varMatch = sessionRE.exec(varStr);
        if (varMatch != null) {
          console.log('Setting session variable: ' + varMatch[1] + ' <-- ' + val);
          return sessionStore.set(varMatch[1], val);
        }

        varMatch = storeRE.exec(varStr);
        if (varMatch != null) {
          console.log('Setting store variable: ' + varMatch[1] + ' <-- ' + val);
          return persistentStore.set(varMatch[1], val);
        }

        return "store type not found";
      },

      // persistence support
      load: (objNameStr, keyNameStr, keyVal, filter) => {
        var objNameMatch = storeRE.exec(objNameStr);
        var keyNameMatch = storeRE.exec(keyNameStr);
        if (objNameMatch != null && keyNameMatch != null) {
          console.log('Loading object: ' + objNameMatch[1]);
          persistentStore.load(objNameMatch[1], keyNameMatch[1], keyVal, filter)
          return;
        } else if (filter != null) {
          console.log('Loading object: ' + objNameMatch[1]);
          persistentStore.load(objNameMatch[1], null, null, filter)
          return;
        }
        console.log('Cant load object: ' + objNameMatch[1] + ' -- no constraints.');
      },
      store: (objNameStr) => {
        var objNameMatch = storeRE.exec(objNameStr);
        if (objNameMatch != null) {
          console.log('Storing object: ' + objNameMatch[1]);
          persistentStore.store(objNameMatch[1]);
          return;
        }
      },

      // goals support
      addGoal: (goal) => {_addGoal(goal);},
      goalFilled: (destParamName, srcParamName) => {
        if (response.get(destParamName) != undefined)
          return true;
        if (response.get(srcParamName) != undefined) {
          response.set(destParamName, response.get(srcParamName));
          return true;
        }
        response.addGoal(destParamName);
        return false;
      }
    };
    return response;
  };

  // this is what gets called every time a user says something
  var _processIntent = (requ, resp, goal, responseImplCB) => {
    var response = __getResponse(requ, resp);
    _setSpeaking();
    _sayInit();
    _followGoals(response, goal, responseImplCB);
    _sayFinish(resp);
    _clearSpeaking();
  };

  var _processForPunctuation = function(userSpeech, goal, responseImplCB) {
    //change to variable/slot format: {{varName}} -> {-|varName}
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return _interpolateParamsFromStore(userSpeechItem, /(\d+)/g, {get: (num)=>{return _getNumAsStr(num);}});
    });
    // temporary - while we get multiple equal speechItem's working
    userSpeech = userSpeech.filter(function(userSpeechItem) {
      if (!userSpeechItem.startsWith('GLOBAL '))
        return true;
      var tgtPhrase = userSpeechItem.substr('GLOBAL '.length);
      if (!globalIntents[tgtPhrase]) globalIntents[tgtPhrase] = [];
      globalIntents[tgtPhrase].push({tgtPhrase, goal, responseImplCB});
      return false;
    });

    return userSpeech;
  }
  var _processForSlots = function(userSpeech) {
    //change to variable/slot format: ((varName)) -> {-|varName}
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(paramsGRE,'{-|\$1}');
    });
    return userSpeech;
  }
  var _processForPhraseEquivalents = function(userSpeech) {
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

  var globalIntents = {}; // object of tgtPhrase: [{{tgtPhrase, goal, responseImplCB}}, ...]
  var _registerGlobalIntents = () => {
    console.log('globalIntents', globalIntents);
    for (let phrase in globalIntents) {
      let phraseOptions = globalIntents[phrase];
      let intentParams = {};
      let userSpeech = [phrase];
      userSpeech = _processForSlots(userSpeech);
      userSpeech = _processForPhraseEquivalents(userSpeech);
      intentParams["utterances"] = userSpeech;
      let expectedParams = _extractParamsFromSpeech(userSpeech);
      if (Object.keys(expectedParams).length > 0)
        intentParams["slots"] = expectedParams;

      console.log('registering: ', intentParams);
      app.intent( _genIntentName(), intentParams, (requ, resp) => {
        // pick right responseImplCB from phraseOptions
        for (var ndx = goalsToMeet.length; ndx--; ) {
          var currentGoal = goalsToMeet[ndx];
          for (var ndx2 = 0; ndx2 < phraseOptions.length; ndx2++) {
            var po = phraseOptions[ndx2];
            if (po.goal == currentGoal) {
              _processIntent(requ, resp, po.goal, po.responseImplCB);
              return;
            }
          }
        }
        console.log('No matching response for:', phrase, ' utterances:', intentParams["utterances"]);
        phraseOptions.forEach((po)=>{console.log(po.goal)});
      });

    }
  };

  var violet = {
    addKeyTypes: function(_keyTypes) {
      for (var type in _keyTypes) {
        keyTypes[type] = _keyTypes[type];
      }
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

    _getResponseForDebugging: (req, resp) => {return __getResponse(req, resp);},
    setPersistentStore: (_persistentStore) => {persistentStore = _persistentStore},

    setAlert: function(cause) {
      _setAlert(cause);
    },

    addGoal: (goal) => {
      _addGoal(goal);
    },

    // derecated
    meetGoal: function(goalObj) {
      violet.defineGoal(goalObj);
    },

    defineGoal: function(goalObj) {
      registeredGoals[goalObj.goal] = goalObj;

      // register nested intents
      if (goalObj.respondTo) {
        goalObj.respondTo.forEach((respondObj) => {
          violet.respondTo(respondObj, goalObj.goal);
        });
      }
    },


    addTopLevelGoal: function(goal) {
      _addTopLevelGoal(goal);
    },

    // derecated
    setTopLevelGoal: function(goal) {
      _addGoal(goal);
    },

    registerGlobalIntents: function() {
      _registerGlobalIntents();
    },

    respondTo: function(userSpeech, responseImplCB, goal = null) {
      if (typeof userSpeech == 'object' && !Array.isArray(userSpeech)) {
        var respondObj = userSpeech;
        violet.respondTo(respondObj.expecting, respondObj.resolve, responseImplCB);
        return;
      }
      var intentParams = {};
      if (!Array.isArray(userSpeech)) {
        userSpeech = [userSpeech];
      }
      userSpeech = _processForPunctuation(userSpeech, goal, responseImplCB);
      userSpeech = _processForSlots(userSpeech);
      userSpeech = _processForPhraseEquivalents(userSpeech);
      if (userSpeech.length == 0) return;
      intentParams["utterances"] = userSpeech;
      var expectedParams = _extractParamsFromSpeech(userSpeech);
      if (Object.keys(expectedParams).length > 0)
        intentParams["slots"] = expectedParams;

      console.log('registering: ', intentParams);
      app.intent(_genIntentName(), intentParams, (requ, resp) => {
        _processIntent(requ, resp, goal, responseImplCB);
      });
    }
  }

  app.error = function( exception, requ, resp ) {
    console.log(exception);
    console.log(requ);
    console.log(resp);
    _sayFinish(resp, null, 'Sorry an error occured ' + exception.message);
  };

  app.launch( function( requ, resp ) {
    _processIntent(requ, resp, null, (response)=>{
      if (fAlert.length > 0) {
        response.say('You have an alert.');
        console.log('Alerts: ', fAlert);
        console.log('Goals: ', goalsToMeet);
        console.log('User Info: ', requ.userId);
        return;
      }
      response.say(['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
    });
  });
  app.intent('setAlert', {"utterances": ["set alert"]}, (req, resp) => {_setAlert('intent');});
  app.intent('unsetAlert', {"utterances": ["disable alert", "clear alert"]}, (req, resp) => {_clearAlert('intent');});

  app.intent('closeSession', {"utterances": ["I am good", "No I am good", "Thanks", "Thank you"]}, () => {}); // by default session ends

  return violet;
};
