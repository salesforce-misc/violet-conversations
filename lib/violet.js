var co = require('co');
var Promise = require('bluebird');

var alexa = require('alexa-app');
var alexaAppExt = require('./alexaAppExt.js')

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
    return cb(requ, resp);
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
///////////

var appName = null; // only the default name

var express = require('express');
module.exports.server = function() {
  return {
    loadScript: (path, name, alexaRouter) => {
      appName = name;
      var script = require(path);
      script.registerIntents();
      script.setServerApp(express, alexaRouter);
      return script;
    }
  };
}
module.exports.script = function() {
  if (appName == null) {
    // allow scripts to be launched without the server and instead just initialize after 1s
    var violetSrvr = require('./violetSrvr.js')('/alexa');
    var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);
    appName = 'local'
    setTimeout(()=>{ // run after the full script loads
      violet.registerIntents();
      violet.setServerApp(express, violetSrvr.getAlexaRouter());
      violetSrvr.displayScriptInitialized(srvrInstance, violet);
    }, 1*1000);
  }
  var _app = new alexa.app(appName);

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
  var _say = function(response, potResponses, quick) {
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
    else {
      if (!quick) outBuffer += ' <break time="500ms"/> ';
      outBuffer += ' ' + str;
    }
  }
  var _ask = function(response, potResponses, quick) {
    _say(response, potResponses, quick);
    asked = true;
  }
  var _sayFinish = function(resp, response, potResponses) {
    if (potResponses) _say(response, potResponses, /*quick*/false);
    console.log('Saying: ' + outBuffer);
    resp.say(outBuffer);
    resp.shouldEndSession(false);
  }
  var _extractParamsFromSpeech = function(userSpeech) {
    var expectedParams = {};
    userSpeech.forEach((speechStr) => {
      var extractedVars = speechStr.match(/\|[a-zA-Z]*}/g);
      if (!extractedVars) return;
      extractedVars.forEach((extractedVar) => {
        var ev = extractedVar.slice(1,-1); // strip first and last characters
        if (ev.length == 0) return;
        if (keyTypes[ev]) {
          expectedParams[ev] = keyTypes[ev];
          if (typeof expectedParams[ev] == 'object') { // support for custom types
            expectedParams[ev]=expectedParams[ev].type;
          }
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
    fAlert.push(cause);
  };
  var _clearAlert = (cause) => {
    var ndx = fAlert.indexOf(cause);
    if (ndx > 0) fAlert.splice(ndx, 1);
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
      get: (varName) => {
        if (varName == 'userId') return req.userId;
        return req.slot(varName);
      },
      contains: (varName) => {
        if (varName == 'userId') return true;
        return alexaAppExt.reqContainsSlot(req, varName);
      }
    };
    var sessionStore = req.getSession();
    var response = {

      // for advanced users
      _paramsStoreReal: () => {return paramsStore;},
      _paramsStore: () => {return sessionStore;}, // we are phasing out easy access to anything but the session store
      _sessionStore: () => {return sessionStore;},
      _persistentStoreReal: () => {return persistentStore;},
      _persistentStore: () => {return sessionStore;}, // we are phasing out easy access to anything but the session store

      say: (potResponses, quick=false) => {_say(response, potResponses, quick)},
      ask: (potResponses, quick=false) => {_ask(response, potResponses, quick)},

      __matchAgainstStore: (varStr, rePattern) => {
        var varMatch = rePattern.exec(varStr);
        if (varMatch == null) return {matched: false};
        return {matched: true, varMatch: varMatch};
      },
      __getStoreVarUsingMatched: (matchResult) => {
        return matchResult.varMatch[1];
      },
      __containsUsingMatched: (matchResult, storeType) => {
        var storeVar = response.__getStoreVarUsingMatched(matchResult);
        if (storeType.contains) {
          return storeType.contains(storeVar);
        } else {
          return storeType.get(storeVar) != undefined;
        }
      },
      __getUsingMatched: (matchResult, storeType) => {
        var storeVar = response.__getStoreVarUsingMatched(matchResult);
        return storeType.get(storeVar);
      },
      __isStorageParamClassed: (varStr) => {
        return varStr.startsWith('[[') || varStr.startsWith('{{') || varStr.startsWith('<<');
      },
      contains: (varStr) => {
        if (!response.__isStorageParamClassed(varStr)) return (sessionStore.get(varStr) != undefined);

        var getResult = null;

        getResult = response.__matchAgainstStore(varStr, paramsRE);
        if (getResult.matched) return response.__containsUsingMatched(getResult, sessionStore);

        getResult = response.__matchAgainstStore(varStr, sessionRE);
        if (getResult.matched) return response.__containsUsingMatched(getResult, sessionStore);

        console.log(`*** Cannot process param: ${varStr} ***`);
        return false;
      },
      get: (varStr) => {
        if (!response.__isStorageParamClassed(varStr)) return sessionStore.get(varStr);

        var getResult = null;

        getResult = response.__matchAgainstStore(varStr, paramsRE);
        if (getResult.matched) return response.__getUsingMatched(getResult, sessionStore);

        getResult = response.__matchAgainstStore(varStr, sessionRE);
        if (getResult.matched) return response.__getUsingMatched(getResult, sessionStore);

        getResult = response.__matchAgainstStore(varStr, storeRE);
        if (getResult.matched) return response.__getUsingMatched(getResult, persistentStore);

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
      update: (objNameStr, keyNameStr, keyVal, updateData) => {
        console.log('Updating object: ' + objNameStr);
        return persistentStore.update(objNameStr, keyNameStr, keyVal, updateData);
      },

      // goals support
      addGoal: (goal) => {_addGoal(goal);},
      goalFilledByStore: (destParamName, srcParamName) => {
        if (response.contains(destParamName)) {
          return true;
        }
        if (srcParamName && srcParamName!=destParamName && response.contains(srcParamName)) {
          response.set(destParamName, response.get(srcParamName));
          return true;
        }
        console.log('*** param not found');
        return false;
      },
      isGoalFilled: (paramName) => {
        return response.goalFilledByStore(paramName);
      },
      ensureGoalFilled: (paramName) => {
        var success = response.goalFilledByStore(paramName);
        if (!success) response.addGoal(paramName);
        return success;
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
        _sayInit();       // clear buffers
        _clearSpeaking();
      });
  };

  var _processForPunctuation = function(userSpeech) {
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return _interpolateParamsFromStore(userSpeechItem, /(\d+)/g, {get: (num)=>{return utils.getNumAsStr(num);}});
    });
    return userSpeech;
  }
  var _processForSlots = function(userSpeech) {
    //change to variable/slot format: [[varName]] -> {-|varName}
    userSpeech = userSpeech.map(function(userSpeechItem) {
      // try to put in literal sampleValues (if available)
      // we want to do:
      // return userSpeechItem.replace(paramsGRE,'{-|\$1}');
      // but instead of the '-' we want to put in real values depending on the param matched
      var literalSampleValuesStore = {
        get: (inStr)=>{
          // console.log('** inStr: ' + inStr);
          var sampleValues = '-';
          if (keyTypes[inStr] && keyTypes[inStr].sampleValues) {
            sampleValues = keyTypes[inStr].sampleValues.join('|');
            // console.log('** literalSampleValuesStore: ' + inStr + ': ' + sampleValues);
          } else if (!keyTypes[inStr]) {
            console.log('*** Received unexpected type :', inStr);
            keyTypes[inStr] = 'AMAZON.LITERAL';
          }
          return '{' + sampleValues + '|' + inStr + '}';
        }
      };
      return _interpolateParamsFromStore(userSpeechItem, paramsGRE, literalSampleValuesStore);
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
      // setup - copy request variables to session variables
      alexaAppExt.reqListSlots(requ).forEach((slotName)=>{
        console.log('store upgrade: requstSlots->sessionStore: ' + slotName);
        requ.getSession().set(slotName, requ.slot(slotName));
      });

      // call intent-callback
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

    /*DANGER - will likely remove these soon - only used by ClientTx plugin - DANGER*/
    __getoutBuffer: ()=>{return outBuffer;},
    __get_setAlert: ()=>{return _setAlert;},
    __get_sayFinish: ()=>{return _sayFinish;},
    __set_setAlert: (val)=>{_setAlert = val;},
    __set_sayFinish: (val)=>{_sayFinish = val;},

    setServerApp: function(express, alexaRouter) {
      _app.express({
        expressApp: alexaRouter,
        router: express.Router(),
        checkCert: false,
        debug: true,
      });
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
