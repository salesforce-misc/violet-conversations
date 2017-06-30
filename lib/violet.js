var co = require('co');
var Promise = require('bluebird');

var alexa = require('alexa-app');

var utils = require('./utils.js');

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
var _regIntent = (app, name, params, cb) => {
  console.log('registering: ', name, params);
  app.intent(name, params, (requ, resp)=>{
    console.log('Intent Request: ' + name);
    cb(requ, resp);
  });
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
module.exports = function(appName) {
  var _app = new alexa.app(appName);

  var broadcast = () => {console.log('Broadcasting not initialized...');}
  _setBroadcaster = (broadcaster) => {broadcast = broadcaster;}

  const paramsRE   = /\[\[([a-zA-Z0-9_\.]*)\]\]/;  // from user input
  const paramsGRE  = /\[\[([a-zA-Z0-9_\.]*)\]\]/g;
  const sessionRE  = /{{([a-zA-Z0-9_\.]*)}}/;      // from the session
  const sessionGRE = /{{([a-zA-Z0-9_\.]*)}}/g;
  const storeRE    = /<<([a-zA-Z0-9_\.]*)>>/;      // from permanent store (database, etc)
  const storeGRE   = /<<([a-zA-Z0-9_\.]*)>>/g;

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
      str = potResponses[utils.getRand(0, potResponses.length)];
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
    var resolveGoal = function(tgtResolve, tgtGoal, response) {
      var result = tgtResolve(response);

      if (result==true || result==undefined) {
        remove(goalsToMeet, tgtGoal);
        return Promise.resolve();
      }
      var retPromise = null;
      if (result.then) retPromise = result;     // promise return
      if (result.next) retPromise = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
      if (retPromise) return retPromise.then((result)=>{
          if (result==true || result==undefined) remove(goalsToMeet, tgtGoal);
        });
      return Promise.resolve();
    };

    var p = null;
    if (tgtResolve)
      p = resolveGoal(tgtResolve, tgtGoal, response);
    else
      p = Promise.resolve();

    var moreGoalsToSeek = true;
    var lastGoal = null;
    _clearAlert('{{unmetGoals}}');

    return p.then(()=>{return utils.promiseWhile(
      ()=>{return asked==false && moreGoalsToSeek == true;},
      ()=>{
        var tgtGoal = top(goalsToMeet);
        if (!tgtGoal) {moreGoalsToSeek=false; return Promise.resolve();}

        var tgtGoalObj = registeredGoals[tgtGoal];
        if (tgtGoal == lastGoal) {moreGoalsToSeek=false; return Promise.resolve();} // we did not add goals or remove goals - something is wrong!
        lastGoal = tgtGoal;

        console.log('--> Trying to meet goal: ' + tgtGoal);
        if (tgtGoalObj.resolve) {
          return resolveGoal(tgtGoalObj.resolve, tgtGoal, response);
        } else if (tgtGoalObj.prompt) {
          _ask(response, tgtGoalObj.prompt);
        } else {
          console.log('*** Goal: ' + tgtGoal + ' -- does not have resolve or prompt');
        }
        return Promise.resolve();
    })});
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
        var getFromStore = (rePattern, storeType) => {
          var varMatch = rePattern.exec(varStr);
          if (varMatch == null) return {matched: false};

          if (varMatch[1] == 'userId') return {matched: true, result: req.userId};
          return {matched: true, result: storeType.get(varMatch[1])};
        };

        var getResult = {};

        getResult = getFromStore(paramsRE, paramsStore);
        if (getResult.matched) return getResult.result;

        getResult = getFromStore(sessionRE, sessionStore);
        if (getResult.matched) return getResult.result;

        getResult = getFromStore(storeRE, persistentStore);
        if (getResult.matched) return getResult.result;

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
      load: (objNameStr, keyNameStr, keyVal, filter, queryXtra) => {
        var objNameMatch = storeRE.exec(objNameStr);
        if (objNameMatch != null) objNameStr = objNameMatch[1];

        var keyNameMatch = storeRE.exec(keyNameStr);
        if (keyNameMatch != null) keyNameStr = keyNameMatch[1];

        if (objNameStr == null) {
          console.log('Need object to load');
          return Promise.resolve();
        }

        if (keyNameStr != null) {
          console.log('Loading object: ' + objNameStr);
          return persistentStore.load(objNameStr, keyNameStr, keyVal, filter, queryXtra);
        } else if (filter != null) {
          console.log('Loading object: ' + objNameStr);
          return persistentStore.load(objNameStr, null, null, filter, queryXtra);
        }
        if (!queryXtra) queryXtra = ''
        if (queryXtra.toLowerCase().indexOf('limit') == -1)
          queryXtra += ' limit 100';
        return persistentStore.load(objNameStr, keyNameStr, keyVal, filter, queryXtra);
      },
      store: (objNameStr, optionalData) => {
        var objNameMatch = storeRE.exec(objNameStr);
        if (objNameMatch != null) objNameStr = objNameMatch[1];
        console.log('Storing object: ' + objNameStr);
        return persistentStore.store(objNameStr, optionalData);
      },

      // goals support
      addGoal: (goal) => {_addGoal(goal);},
      goalFilledByStore: (destParamName, srcParamName) => {
        if (response.get(destParamName) != undefined)
          return true;
        if (response.get(srcParamName) != undefined) {
          response.set(destParamName, response.get(srcParamName));
          return true;
        }
        response.addGoal(destParamName);
        return false;
      },
      goalFilled: (paramName) => {
        return response.goalFilledByStore('{{' + paramName + '}}', '[[' + paramName + ']]');
      }
    };
    return response;
  };

  // this is what gets called every time a user says something
  var _processIntent = (requ, resp, goal, responseImplCB) => {
    var response = __getResponse(requ, resp);
    _setSpeaking();
    _sayInit();
    return _followGoals(response, goal, responseImplCB)
      .then(()=>{
        _sayFinish(resp);
        _clearSpeaking();
      });
  };

  var _processForPunctuation = function(userSpeech) {
    //change to variable/slot format: {{varName}} -> {-|varName}
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return _interpolateParamsFromStore(userSpeechItem, /(\d+)/g, {get: (num)=>{return utils.getNumAsStr(num);}});
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

  // userSpeechDef looks like {
  //      userSpeechItem1: [intentDef1, ...]
  //      userSpeechItem2: [intentDef2, intentDef3...]
  //    }
  // where intentDef looks like {goal, responseImplCB}
  var userSpeechDef = {};
  // for debuggability we would like to keep the order of the phrases - which is why we are keeping the additional array
  // allIntents looks like
  // [[intent1-userSpeechItem1, intent1-userSpeechItem2],
  //  [intent2-userSpeechItem3, intent2-userSpeechItem4, intent2-userSpeechItem5],
  //     ...]
  var allIntents = [];

  var _registerIntentDef = (userSpeech, intentDefArr) => {
    userSpeech = _processForPunctuation(userSpeech);
    userSpeech = _processForSlots(userSpeech);
    userSpeech = _processForPhraseEquivalents(userSpeech);
    var intentParams = {};
    intentParams["utterances"] = userSpeech;
    let expectedParams = _extractParamsFromSpeech(userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams["slots"] = expectedParams;

    _regIntent(_app,  _genIntentName(), intentParams, (requ, resp) => {
      if (intentDefArr.length==1) {
        return _processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].responseImplCB);
      }
      // pick right responseImplCB from intentDefArr
      for (var ndx = goalsToMeet.length; ndx--; ) {
        var currentGoal = goalsToMeet[ndx];
        for (var ndx2 = 0; ndx2 < intentDefArr.length; ndx2++) {
          var intentDef = intentDefArr[ndx2];
          if (intentDef.goal == currentGoal) {
            return _processIntent(requ, resp, intentDef.goal, intentDef.responseImplCB);
          }
        }
      }
      console.log('No matching response for:', phrase, ' utterances:', intentParams["utterances"]);
      phraseOptions.forEach((po)=>{console.log(po.goal)});
    });
  };

  var _registerIntents = () => {
    // first pass for everything but globalIntents
    for (let intentsUserSpeech of allIntents) {
      // let phraseOptions = globalIntents[phrase];
      let userSpeech = [];
      let intentDefArr = [];
      intentsUserSpeech.forEach((userSpeechItem)=>{
        if (userSpeechDef[userSpeechItem].length==1) { // non globalIntents
          userSpeech.push(userSpeechItem);
          intentDefArr = userSpeechDef[userSpeechItem];
        }
      });
      if (userSpeech.length>0)
        _registerIntentDef(userSpeech, intentDefArr);
    }
    // second pass for globalIntents
    for (let userSpeechItem in userSpeechDef) {
      if (userSpeechDef[userSpeechItem].length==1) continue;
      let userSpeech = [userSpeechItem];
      let intentDefArr = userSpeechDef[userSpeechItem];
      _registerIntentDef(userSpeech, intentDefArr);
    }
  };

  var violet = {
    app: _app,

    setServerApp: function(express, alexaRouter) {
      _app.express({
        expressApp: alexaRouter,
        router: express.Router(),
        checkCert: false,
        debug: true,
      });
    },

    setBroadcaster: function(broadcaster) {
      _setBroadcaster(broadcaster);
    },

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
      vioelt.defineGoal(goalObj);
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

    registerIntents: function() {
      _registerIntents();
    },

    respondTo: function(userSpeech, responseImplCB, goal = null) {
      if (typeof userSpeech == 'object' && !Array.isArray(userSpeech)) {
        var respondObj = userSpeech;
        violet.respondTo(respondObj.expecting, respondObj.resolve, responseImplCB);
        return;
      }
      if (!Array.isArray(userSpeech)) {
        userSpeech = [userSpeech];
      }

      // index speech items and their definitions - so that we can register them when they have all been defined
      allIntents.push(userSpeech);
      userSpeech = userSpeech.forEach(function(userSpeechItem) {
        if (!userSpeechDef[userSpeechItem]) userSpeechDef[userSpeechItem] = [];
        userSpeechDef[userSpeechItem].push({goal, responseImplCB});
      });
    }
  }

  _app.error = function( exception, requ, resp ) {
    console.log(exception);
    console.log(requ);
    console.log(resp);
    _sayFinish(resp, null, 'Sorry an error occured ' + exception.message);
  };

  _app.launch( function( requ, resp ) {
    return _processIntent(requ, resp, null, (response)=>{
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
  _regIntent(_app, 'setAlert', {"utterances": ["set alert"]}, (req, resp) => {_setAlert('intent');});
  _regIntent(_app, 'unsetAlert', {"utterances": ["disable alert", "clear alert"]}, (req, resp) => {_clearAlert('intent');});

  _regIntent(_app, 'closeSession', {"utterances": ["I am good", "No I am good", "Thanks", "Thank you"]}, () => {}); // by default session ends

  return violet;
};
