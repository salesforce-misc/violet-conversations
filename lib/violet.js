/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * This is the Core Violet Module - it provides the conversation engine that
 * voice-scripts can take advantage of.

 * Voice scripts can be grouped into multiple apps that are available on a
 * single server. Currently Violet only supports registering intents for
 * Amazon's Alexa Skills Kit.
 *
 * @module violet
 */

var co = require('co');
var path = require('path');
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
    console.log(`Intent Request - ${name}: ${params.utterances[0]}, ...`);
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

var appName = null; // set when loading a set of scripts
var appToVioletInstances = {};

/**
 * Assists with the loading of scripts by the Violet Server. Primarily enables
 * apps to have multiple scripts.
 */
module.exports.server = function() {
  return {
    loadScript: (contextDir, scriptPath, name, alexaRouter) => {
      appName = name;
      var script = require(path.join(contextDir, scriptPath));
      script.registerIntents();
      script.setServerApp(alexaRouter);
      return script;
    },
    loadMultipleScripts: (contextDir, scriptPaths, name, alexaRouter) => {
      appName = name;
      var script = null;
      scriptPaths.forEach(p=>{
        // all instances of script below should be identical
        script = require(path.join(contextDir, p));
      })
      script.registerIntents();
      script.setServerApp(alexaRouter);
      return script;
    }
  };
}
/**
 * Clears any previous script information for the specified app - this helps
 * because by default Violet intentionally groups scripts into an app). This
 * method is primarily used by the test suite as it uses the same app repeatedly.
 */
module.exports.clearAppInfo = function(_appName) {
  delete appToVioletInstances[_appName];
};
/**
 * Instantiates and returns the core Violet class. Most violet scripts start
 * by making this call.
 *
 * @param appName - App name to attach this script to. Not setting this
 * parameter will allow Violet to attach this script to the previous App. It is
 * recommended to not set this parameter here (in the script) but to define it
 * in the parent where the script is being loaded.
 * @returns {violet} - The primary object:
 * {@link module:violet.script~violet Violet} that scripts will be defining
 * intents, goals, etc against.
 */
module.exports.script = function(_appName) {
  if (appName == null && _appName != null) appName = _appName;
  if (appName == null) {
    // allow scripts to be launched without the server and instead just initialize after 1s
    var violetSrvr = require('./violetSrvr.js')('/alexa');
    var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);
    appName = 'local'
    setTimeout(()=>{ // run after the full script loads
      violet.registerIntents();
      violet.setServerApp(violetSrvr.getSvcRouter());
      violetSrvr.displayScriptInitialized(srvrInstance, violet);
    }, 1*1000);
  }
  if (appToVioletInstances[appName]) return appToVioletInstances[appName];

  var _app = new alexa.app(appName);

  const paramsRE   = /\[\[([a-zA-Z0-9_\.]*)\]\]/;
  const paramsGRE  = /\[\[([a-zA-Z0-9_\.]*)\]\]/g;

  // variable names and their types
  var keyTypes = {};

  // list(array) of equivalent phrases
  var phraseEquivalents = [];

  var asked = 0;      // can be less than one for partial questions, i.e. prompts
  var sayQueue = []; var askQueue = [];
  var keepConversationRunning = true;
  var spokenRate = null;

  var _sayInit = function() {
    asked = 0;
    sayQueue = []; askQueue = [];
    keepConversationRunning = true;
  }
  var _pick = function(response, potResponses) {
    var str = potResponses;
    if (Array.isArray(potResponses)) {
      str = potResponses[utils.getRand(0, potResponses.length)];
    }
    if (response) { // unlikely, but in error situations response can be null
      str = _interpolateParamsFromStore(str, paramsGRE, response._sessionStore());
    }
    if (!str) console.log(new Error().stack);
    console.log('picking for output: ' + str);
    return str;
  }
  var pauseStr = ' <break time="500ms"/> ';
  var _say = function(response, potResponses, quick) {
    if (sayQueue.length>0 && !quick) sayQueue.push(pauseStr);
    sayQueue.push(_pick(response, potResponses));
  }
  var _prompt = function(response, potResponses) {
    askQueue.push(_pick(response, potResponses));
    asked += 0.34;
  }
  var _ask = function(response, potResponses) {
    askQueue.push(_pick(response, potResponses));
    asked += 1;
  }
  var _sayFinish = function(resp, response, potResponses) {
    if (potResponses) sayQueue.push(_pick(response, potResponses));
    // build outBuffer
    var outBuffer = '';
    sayQueue.forEach(str=>{
      if (outBuffer.length == 0)
        outBuffer = str;
      else
        outBuffer += ' ' + str;
    });
    askQueue.forEach((str, ndx)=>{
      if (outBuffer.length == 0) {
        outBuffer = str;
        return;
      }
      if (ndx==0)
        outBuffer += pauseStr + str;
      else if (ndx==askQueue.length-1)
        outBuffer += ' or ' + str;
      else
        outBuffer += ', ' + str;
    });

    if (spokenRate) outBuffer = `<prosody rate="${spokenRate}">${outBuffer}</prosody>`;
    outBuffer = outBuffer.replace(/\s&\s/g, ' and ');

    if (outBuffer !== '') {
      console.log('Saying: ' + outBuffer);
      resp.say(outBuffer);
    }
    if (keepConversationRunning) resp.shouldEndSession(false);
    return outBuffer;
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

  var registeredGoals = {};
  var goalsToMeet = [];
  var topLevelGoals = [];

  var _addGoal = (goal) => {
    console.log('--> Goal added: ' + goal);
    goalsToMeet.push(goal);
    if (!_speaking()) {
      if (violet.setAlert) violet.setAlert('{{unmetGoals}}');
    }
  };
  var _addTopLevelGoal = (goal) => {
    console.log('--> TL Goal added: ' + goal);
    topLevelGoals.push(goal);
  };
  var _hasGoal = (goal) => {
    console.log('--> Checking goal: ' + goal);
    var ndx = goalsToMeet.indexOf(goal);
    return (ndx !== -1);
  };
  var _clearGoal = (goal) => {
    console.log('--> Clearing Goal: ' + goal);
    var ndx = goalsToMeet.indexOf(goal);
    if (ndx == -1)
      console.log('\t Goal Not Found');
    else
      goalsToMeet.splice(ndx, 1);
  };
  var _clearAllGoals = () => {
    goalsToMeet = [];
  };

  // response - conversationalResponse object
  // tgtGoal - removed from the goalsToMeet list when tgtResolve is done without error; can be null
  // tgtResolve - what triggered us right now
  var _followGoals = (response, tgtGoal, tgtResolve) => {
    // console.log('--> Triggered Goal: ' + triggeredGoal);

    // a LIFO queue
    var top = (arr, ndx)=>{if (arr.length==0 || ndx>=arr.length) return undefined; else return arr[arr.length-ndx-1];}
    var remove = (arr, obj)=>{var ndx=arr.indexOf(obj); if (ndx!=-1) arr.splice(ndx,1);}

    var listGoals = (action)=>{console.log(action + ' goals to meet: ', goalsToMeet);}
    var topGoal = (goalNdx)=>{listGoals('top'); return top(goalsToMeet, goalNdx);}
    var removeGoal = (goal)=>{listGoals('remove'); return remove(goalsToMeet, goal);}
    var resolveGoal = function(tgtResolve, tgtGoal, response) {
      var result = tgtResolve(response);

      if (result==true || result==undefined) {
        removeGoal(tgtGoal);
        return Promise.resolve();
      }
      var retPromise = null;
      if (result.then) retPromise = result;     // promise return
      if (result.next) retPromise = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
      if (retPromise) return retPromise.then((result)=>{
          if (result==true || result==undefined) removeGoal(tgtGoal);
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
    var goalNdx = 0;
    if (violet.clearAlert) violet.clearAlert('{{unmetGoals}}');

    // the core goals loop - following all queued goals until no more
    return p.then(()=>{return utils.promiseWhile(
      ()=>{return asked<1 && moreGoalsToSeek == true;},
      ()=>{
        var tgtGoal = topGoal(goalNdx++);
        if (!tgtGoal || tgtGoal == lastGoal) {
          // no need to follow goals if (a) we have nothing queued or (b) the
          //  current goals cannot be added or removed
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        var tgtGoalObj = registeredGoals[tgtGoal];
        lastGoal = tgtGoal;
        if (!tgtGoalObj) {
          console.log('ERROR: Goal not defined - ' + tgtGoal);
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        // console.log('--> Trying to meet goal: ' + tgtGoal);
        // console.log('--> registeredGoals: ', registeredGoals);
        // console.log('--> tgtGoalObj: ', tgtGoalObj);
        if (tgtGoalObj.resolve) {
          return resolveGoal(tgtGoalObj.resolve, tgtGoal, response);
        } else if (tgtGoalObj.prompt) {
          _prompt(response, tgtGoalObj.prompt);
        } else if (tgtGoalObj.ask) {
          _ask(response, tgtGoalObj.ask);
        } else {
          console.log('*** Goal: ' + tgtGoal + ' -- does not have resolve or prompt');
        }
        return Promise.resolve();
    })});
  };

  var persistentStore = null;

  // only called by _processIntent
  var __getResponse = (requ, resp) => {
    var paramsStore = {
      get: (varName) => {
        if (varName == 'userId') return requ.userId;
        return requ.slot(varName);
      },
      contains: (varName) => {
        if (varName == 'userId') return true;
        return alexaAppExt.reqContainsSlot(req, varName);
      }
    };
    var sessionStore = requ.getSession();
    /** @class */
    var response = {

      // so that users can try out cuting edge features - using this will possibly limit support for AWS Lex, Google Home, etc.
      _alexa_request: () => {return requ;},
      _alexa_response: () => {return resp;},

      // for advanced users
      _paramsStoreReal: () => {return paramsStore;},
      _paramsStore: () => {return sessionStore;}, // we are phasing out easy access to anything but the session store
      _sessionStore: () => {return sessionStore;},
      _persistentStoreReal: () => {return persistentStore;},
      _persistentStore: () => {return sessionStore;}, // we are phasing out easy access to anything but the session store

      /**
       * Responds to the user. When an array is provided Violet picks a
       * random item - this allows responses to not be repetitive. Additionally
       * you can add input parameters directly in the response by adding them
       * in [[]]
       *
       * @example
       *  response.say('Hello')
       *  response.say(['Hello', 'Hi'])
       *  response.say('I like the name [[name]]')
       * @param {string[]} potResponses - response or array of potential
       * responses for the user
       * @param {boolean} [quick=false] - do not put a pause between the
       * previous say statement and this one
       */
      say: (potResponses, quick=false) => {_say(response, potResponses, quick)},

      /**
       * Asks the user a question. Items being asked are placed after the say
       * statements. Additionally, only one ask is done at a time, giving the
       * user time to respond.
       *
       * @param {string[]} potResponses - response or array of potential
       * questions for the user
       */
      ask: (potResponses) => {_ask(response, potResponses)},

      /**
       * Ends the conversation after the response. By default Violet assumes
       * that you want to keep the conversation open.
       *
       * @default keepConversationRunning=true
       */
      endConversation: () => {keepConversationRunning=false},

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

        var getResult = response.__matchAgainstStore(varStr, paramsRE);
        if (getResult.matched) return response.__containsUsingMatched(getResult, sessionStore);

        console.log(`*** Cannot process param: ${varStr} ***`);
        return false;
      },

      /**
       * Gets parameter from the user
       *
       * @example
       *  violet.respondTo({
       *    expecting: 'My age is [[age]]',
       *    resolve: (response) => {
       *      var age = response.get('age');
       *      if (age && age<17)
       *        response.say('I need to be careful, you are a minor');
       *      else
       *        response.say('Good to meet you. I will remember the you are [[age]]');
       *  }});
       *
       * @param {string} varStr - variable name
       */
      get: (varStr) => {
        if (!response.__isStorageParamClassed(varStr)) return sessionStore.get(varStr);

        var getResult = response.__matchAgainstStore(varStr, paramsRE);
        if (getResult.matched) return response.__getUsingMatched(getResult, sessionStore);

        return "store type not found";
      },

      /**
       * Sets parameter value for access later
       *
       * @param {string} varStr - variable name
       * @param {Object} val - value attached to the variable
       */
      set: (varStr, val) => {
        if (!response.__isStorageParamClassed(varStr)) return sessionStore.set(varStr, val);

        var varMatch = paramsRE.exec(varStr);
        if (varMatch != null) {
          console.log('Setting session variable: ' + varMatch[1] + ' <-- ' + val);
          return sessionStore.set(varMatch[1], val);
        }

        return "store type not found";
      },

      /**
       * Clears parameter that might have been gotten from the user
       *
       * @param {string} varStr - variable name
       */
      clear: (varStr) => {
        if (!response.__isStorageParamClassed(varStr)) return sessionStore.clear(varStr);

        var varMatch = paramRE.exec(varStr);
        if (varMatch != null) {
          console.log('Setting session variable: ' + varMatch[1] + ' <-- ' + val);
          return sessionStore.clear(varMatch[1]);
        }

        return "store type not found";
      },

      // persistence support
      /*
        params - passed in as an object:
          objName <-- object being queried
          propOfInterest <-- fields that we want to do a 'select' on (also can use the global values)
          keyName, keyVal, filter <-- items for the 'where' clause
          queryXtra <-- additional items like 'limit'
          query <-- for sql experts

        alternatively, can pass in params as: objName, keyName, keyVal, filter, queryXtra
      */
      load: function(params) {
        if (arguments.length>1) {
          var p = {};
          if (arguments[0]) p.objName   = arguments[0];
          if (arguments[1]) p.keyName   = arguments[1];
          if (arguments[2]) p.keyVal    = arguments[2];
          if (arguments[3]) p.filter    = arguments[3];
          if (arguments[4]) p.queryXtra = arguments[4];
          return response.load(p);
        }

        if (params.objName == null) {
          console.log('Need object to load');
          return Promise.resolve();
        }

        if (!params.queryXtra) params.queryXtra = ''
        if (params.queryXtra.toLowerCase().indexOf('limit') == -1)
          params.queryXtra += ' limit 100';

        if (params.objName)
          console.log('Loading object: ' + params.objName);
        else
        console.log('Loading: ', params);
        return persistentStore.load(params);
      },
      store: (objName, dataToStore) => {
        console.log('Storing object: ' + objName);
        return persistentStore.store(objName, dataToStore);
      },
      update: (objName, keyName, keyVal, updateData) => {
        console.log('Updating object: ' + objName);
        return persistentStore.update(objName, keyName, keyVal, updateData);
      },

      // goals support

      /**
       * Tells Violet that a goal needs to be met. These goals can be checked
       * to see if they are set by calling *hasGoal* and can be cleared by
       * calling *clearGoal*.
       * <br><br>
       * Once called Violet will call any defined goals after the current
       * *resolve* method finishes.
       */
      addGoal: (goal) => {_addGoal(goal);},

      /**
       * Checks if a goal has been set.
       */
      hasGoal: (goal) => {return _hasGoal(goal);},

      /**
       * Clears goals
       */
      clearGoal: (goal) => {_clearGoal(goal);},

      /**
       * Clears all goals
       */
      clearAllGoals: () => {_clearAllGoals();},
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
  var _processIntent = (requ, resp, goal, resolveCB) => {
    var response = __getResponse(requ, resp);
    _setSpeaking();
    _sayInit();
    return _followGoals(response, goal, resolveCB)
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
            keyTypes[inStr].sampleValues = keyTypes[inStr].sampleValues
                              .map(v=>{return v.trim();});
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
      // go through all equivalent phrases (phraseEquivalents x equivSets) to see if there are any matches
      phraseEquivalents.forEach((equivSets) => {
        equivSets.forEach((phrase, phraseNdx) => {
          var phrasePos = userSpeechItem.toLowerCase().indexOf(phrase.toLowerCase());
          if (phrasePos == -1) return;

          // found a match, lets add everything in the equivSets
          var foundPhrasePos = phrasePos;
          var foundPhrase = phrase;
          var foundPhraseNdx = phraseNdx;
          equivSets.forEach((phraseToInclude, phraseToIncludeNdx) => {
            if (phraseToIncludeNdx == foundPhraseNdx) return;
            userSpeech.push(_interpolate(userSpeechItem, foundPhrase, foundPhrasePos, phraseToInclude));
          });
        });
      });
    }
    return userSpeech;
  }

  // userSpeechDef looks like {
  //      userSpeechItem1: [intentDef1, ...]
  //      userSpeechItem2: [intentDef2, intentDef3...]
  //    }
  // where intentDef looks like {goal, resolveCB}
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

    var idName = undefined;
    for (var idNdx = 0; idNdx < intentDefArr.length; idNdx++) {
      idName = intentDefArr[idNdx].name;
      if (idName!=undefined) break;
    }
    if (idName==undefined) idName = _genIntentName();

    _regIntent(_app,  idName, intentParams, (requ, resp) => {
      // setup - copy request variables to session variables
      alexaAppExt.reqListSlots(requ).forEach((slotName)=>{
        console.log('store upgrade: requstSlots->sessionStore: ' + slotName);
        requ.getSession().set(slotName, requ.slot(slotName));
      });

      // call intent-callback
      if (intentDefArr.length==1) {
        return _processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].resolve);
      }
      // pick right resolveCB from intentDefArr
      for (var ndx = goalsToMeet.length; ndx--; ) {
        var currentGoal = goalsToMeet[ndx];
        for (var ndx2 = 0; ndx2 < intentDefArr.length; ndx2++) {
          var intentDef = intentDefArr[ndx2];
          if (intentDef.goal == currentGoal) {
            return _processIntent(requ, resp, intentDef.goal, intentDef.resolve);
          }
        }
      }
      console.log(`WARN: No perfect match response for: ${idName} intentDefArr.length: ${intentDefArr.length} utterances:`, intentParams["utterances"]);
      return _processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].resolve);
    });
  };

  var _getIntentsDef = () => {
    return {allIntents, userSpeechDef, registeredGoals, keyTypes}
  };
  var _registerIntents = ({allIntents, userSpeechDef, registeredGoals, keyTypes}) => {
    var keyNum = o => {return Object.keys(o).length;}
    console.log(`Registering ${allIntents.length} intents with ${keyNum(userSpeechDef)} userSpeechItems, ${keyNum(keyTypes)} inputTypes  and ${keyNum(registeredGoals)} goals.`);
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

  /**
   * The primary object for scripts to use to define how they
   * {@link module:violet.script~violet.respondTo respond to} users (intents)
   * and more
   *
   * @class
   */
  var violet = {
    app: _app,

    /*DANGER - will likely remove these soon - only used by ClientTx plugin - DANGER*/
    __get_sayFinish: ()=>{return _sayFinish;},
    __set_sayFinish: (val)=>{_sayFinish = val;},

    setServerApp: function(alexaRouter) {
      _app.express({
        router: alexaRouter,
        checkCert: false,
        debug: true,
      });
    },

    /**
     * Used to define parameters that can be expected from the user
     * @example
     * violet.addInputTypes({
     *   'name': 'AMAZON.US_FIRST_NAME',
     * });
     *
     * violet.respondTo(['My name is [[name]]'],
     *  (response) => {
     *    response.say('I like the name [[name]]')
     *  });
     */
    addInputTypes: function(_keyTypes) {
      for (var type in _keyTypes) {
        keyTypes[type] = _keyTypes[type];
      }
    },

    /**
     * Gives a set of equivalent phrases
     * @example
     * violet.addPhraseEquivalents([
     *   ['My name is', 'I call myself'],
     * ]);
     * violet.respondTo(['My name is [[name]]'],
     *   (response) => {
     *     response.say('I like the name [[name]]')
     *   });
     */
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

    _getResponseForDebugging: (requ, resp) => {return __getResponse(requ, resp);},
    setPersistentStore: (_persistentStore) => {persistentStore = _persistentStore},

    addGoal: (goal) => {
      _addGoal(goal);
    },

    setSpokenRate: (_rate) => {
      spokenRate = _rate;
    },

    defineGoal: function(goalObj) {
      registeredGoals[goalObj.goal] = goalObj;

      // register nested intents
      if (goalObj.respondTo) {
        goalObj.respondTo.forEach((intentDef) => {
          intentDef.goal = goalObj.goal;
          violet.respondTo(intentDef);
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

    getIntentsDef: function() {
      return _getIntentsDef();
    },

    registerIntents: function() {
      _registerIntents(_getIntentsDef());
    },

    // TODO: why is the below not showing up in the generated docs?
    /**
     * Called when a user triggers one of the actions (intents) that has been
     * registered by a script.
     *
     * @callback resolveCallback
     * @param {Object} response - The response object
     */

    /**
     * Declare how you are going to be responding to users
     * @example <caption>a basic example</caption>
     * violet.respondTo('Hello',
     *  (response) => {
     *    response.say('Hi');
     *  });
     * @example <caption>using most of the parameters</caption>
     * violet.respondTo({
     *    expecting: ['I live in [[city]]', 'My house is in [[city]]', 'We are renting in [[city]]'],
     *    resolve: (response) => {
     *     response.say('I like the city [[city]]')
     * }});
     * @param {Object} intentDef - intent definition
     * @param {string[]} intentDef.expecting - array of strings that a user could say
     * @param {resolveCallback} intentDef.resolve - callback when one of the `expecting` items is said
     * @param {string} intentDef.goal - (optional) goal during which the above is valid
     */
    respondTo: function(intentDef) {
      if (arguments.length>1) {
        var p = {};
        if (arguments[0]) p.expecting = arguments[0];
        if (arguments[1]) p.resolve   = arguments[1];
        if (arguments[2]) p.goal      = arguments[2];
        return violet.respondTo(p);
      }

      if (!Array.isArray(intentDef.expecting)) {
        intentDef.expecting = [intentDef.expecting];
      }

      // index speech items and their definitions - so that we can register them when they have all been defined
      allIntents.push(intentDef.expecting);
      intentDef.expecting.forEach(function(userSpeechItem) {
        if (!userSpeechDef[userSpeechItem]) userSpeechDef[userSpeechItem] = [];
        userSpeechDef[userSpeechItem].push(intentDef);
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
      // TODO: needs to be re-enabled
      // if (fAlert.length > 0) {
      //   response.say('You have an alert.');
      //   console.log('Alerts: ', fAlert);
      //   console.log('Goals: ', goalsToMeet);
      //   console.log('User Info: ', requ.userId);
      //   return;
      // }
      response.say(['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
    });
  });

  violet.respondTo({name: 'closeSession', expecting: ["I am good", "No I am good", "Thanks", "Thank you"], resolve: (response) => { response.clearAllGoals(); response.endConversation(); }});

  appToVioletInstances[appName] = violet;
  return violet;
};
