/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the ConversationEngine as well as a few classes that help the
 * ConversationEngine - including the ScriptParser to build a model of the users
 * script, the InputMgr to process data from Alexa and call intents in Scripts,
 * and the OutputMgr to take calls from Scripts via the Response class and
 * build an output for sending back to Alexa.
 *
 * @module conversationEngine
 */

var alexa = require('alexa-app');
var alexaAppExt = require('./alexaAppExt.js');

var utils = require('./utils.js');
var Response = require('./response.js');


const paramsRE   = /\[\[([a-zA-Z0-9_\.]*)\]\]/;
const paramsGRE  = /\[\[([a-zA-Z0-9_\.]*)\]\]/g;
const pauseStr = ' <break time="500ms"/> ';

///////////////////////////
// generic utilities
///////////////////////////
var topInArr = (arr, ndx)=>{if (arr.length==0 || ndx>=arr.length) return undefined; else return arr[arr.length-ndx-1];}
var updateArr = (arr, ndx, newVal)=>{if (arr.length==0 || ndx<0 || ndx>=arr.length) return false;  arr[arr.length-ndx-1] = newVal; return true;}

///////////////////////////
// registration utilities
///////////////////////////

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

///////////////////////////
// output utilities
///////////////////////////
_pick = function(response, potResponses) {
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


/**
 * Helps the ConversationEngine build an output (back to Alexa) as provided by
 * calls from Violet Scripts to the Response class
 * <br><br>
 * Methods in this class are currently only used internally and therefore
 * documentation is not exposed.
 *
 * @class
 */
class OutputMgr {
  constructor() {
    // script configuration
    this.spokenRate = null;

    // state while outputing - can span multiple Response's (when multiple goals are being met)
    this.asked = 0;      // can be less than one for partial questions, i.e. prompts
    this.sayQueue = [];
    this.askQueue = [];

    this.keepConversationRunning = true;

    this.__speaking = false;
  }
  initialize() {
    this.asked = 0;

    this.sayQueue = [];
    this.askQueue = [];

    this.keepConversationRunning = true;
  }


  setSpeaking() { this.__speaking = true; }
  clearSpeaking() { this.__speaking = false; }
  speaking() { return this.__speaking; }

  say(response, potResponses, quick) {
    if (this.sayQueue.length>0 && !quick) this.sayQueue.push(pauseStr);
    this.sayQueue.push(_pick(response, potResponses));
  }
  prompt(response, potResponses) {
    this.askQueue.push(_pick(response, potResponses));
    this.asked += 0.34;
  }
  ask(response, potResponses) {
    this.askQueue.push(_pick(response, potResponses));
    this.asked += 1;
  }
  sendFromQueue(resp, response, potResponses) {
    if (potResponses) this.sayQueue.push(_pick(response, potResponses));
    // build outBuffer
    var outBuffer = '';
    this.sayQueue.forEach(str=>{
      if (outBuffer.length == 0)
        outBuffer = str;
      else
        outBuffer += ' ' + str;
    });
    this.askQueue.forEach((str, ndx)=>{
      if (outBuffer.length == 0) {
        outBuffer = str;
        return;
      }
      if (ndx==0)
        outBuffer += pauseStr + str;
      else if (ndx==this.askQueue.length-1)
        outBuffer += ' or ' + str;
      else
        outBuffer += ', ' + str;
    });

    if (this.spokenRate) outBuffer = `<prosody rate="${this.spokenRate}">${outBuffer}</prosody>`;
    outBuffer = outBuffer.replace(/\s&\s/g, ' and ');

    if (outBuffer !== '') {
      console.log('Saying: ' + outBuffer);
      resp.say(outBuffer);
    }
    if (this.keepConversationRunning) resp.shouldEndSession(false);
    return outBuffer;
  }
  /*DANGER - will likely remove these soon - only used by ClientTx plugin - DANGER*/
  __get_sendFromQueue() {return this.sendFromQueue;}
  __set_sendFromQueue(val) {this.sendFromQueue = val;}

}

/**
 * A set of static methods to help the ConversationEngine parse the Violet
 * Script.
 * <br><br>
 * Methods in this class are currently only used internally and therefore
 * documentation is not exposed.
 *
 * @class
 */
class ScriptParser {

  static forPunctuation(userSpeech) {
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return _interpolateParamsFromStore(userSpeechItem, /(\d+)/g, {get: (num)=>{return utils.getNumAsStr(num);}});
    });
    return userSpeech;
  }

  static forSlots(keyTypes, userSpeech) {
    //change to variable/slot format: [[varName]] -> {-|varName}
    userSpeech = userSpeech.map((userSpeechItem) => {
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

  static forPhraseEquivalents(phraseEquivalents, userSpeech) {
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

  static extractParamsFromSpeech(keyTypes, userSpeech) {
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
  }

}

/**
 * Helps the ConversationEngine process Inputs (data from from Alexa) and call the
 * intents defined in the Violet Scripts
 * <br><br>
 * Methods in this class are currently only used internally and therefore
 * documentation is not exposed.
 *
 * @class
 */
class InputMgr {
  constructor(convoEngine) {
    this.convoEngine = convoEngine;
  }

  // response - conversationalResponse object
  // goalName - removed from the goalsToMeet list when intentResolveCB is done without error; can be null
  // intentResolveCB - what triggered us right now
  _followGoals(response, goalName, intentResolveCB) {
    var convo = this.convoEngine;

    var listGoals = (action)=>{console.log(`[${action}] goals to meet: `, convo._getGoalsRaw(response));}
    var topGoalWithState = (goalNdx)=>{listGoals('top'); return convo.mostRecentGoalStates(response, goalNdx);}
    var updateGoalState = (goalNdx, goalWithState)=>{listGoals('updateState'); return convo.updateMostRecentGoalStates(response, goalNdx, goalWithState); }
    var removeGoal = (goalName)=>{listGoals(`remove ${goalName}`); convo.clearGoal(response, goalName);}
    var resolveGoal = function(resolveCB, goalNameToResolve) {
      var result = resolveCB(response);

      if (result==true || result==undefined) {
        removeGoal(goalNameToResolve);
        return Promise.resolve();
      }
      var retPromise = null;
      if (result.then) retPromise = result;     // promise return
      if (result.next) retPromise = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
      if (retPromise) return retPromise.then((result)=>{
          if (result==true || result==undefined) removeGoal(goalNameToResolve);
        });
      return Promise.resolve();
    };
    var goalDefQueryable = (goalDef)=>{return goalDef.prompt || goalDef.query; }

    // console.log('--> Triggered Goal [_followGoals]: ' + goalName);
    var p = null;
    if (intentResolveCB)
      p = resolveGoal(intentResolveCB, goalName, response);
    else
      p = Promise.resolve();

    var moreGoalsToSeek = true;
    var lastGoalWithState = null;
    var goalNdx = -1;
    if (convo.clearAlert) convo.clearAlert('{{unmetGoals}}');

    // the core goals loop - following all queued goals until no more
    return p.then(()=>{return utils.promiseWhile(
      ()=>{return convo.outputMgr.asked<1 && moreGoalsToSeek == true;},
      ()=>{
        if (response.goalStateChanged) { // reset goal processing
          response.goalStateChanged = false;
          goalNdx = -1;
        }
        goalNdx+=1;
        var goalWithState = topGoalWithState(goalNdx);
        if (!goalWithState || goalWithState == lastGoalWithState) {
          // no need to follow goals if (a) we have nothing queued or (b) the
          //  current goals cannot be added or removed
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        var tgtGoalDef = convo.registeredGoals[goalWithState.key];
        lastGoalWithState = goalWithState;
        if (!tgtGoalDef) {
          console.log('ERROR: Goal not defined - ' + goalWithState.key);
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        // console.log('--> Trying to meet goal: ' + goalWithState.key);
        // console.log('--> registeredGoals: ', convo.registeredGoals);
        // console.log('--> tgtGoalDef: ', tgtGoalDef);
        if (tgtGoalDef.resolve) {
          return resolveGoal(tgtGoalDef.resolve, goalWithState.key, response);
        } else if (goalDefQueryable(tgtGoalDef) && goalWithState.queried) {
          console.log(`Goal: ${goalWithState.key} -- already queried. Skipping`);
        } else if (goalDefQueryable(tgtGoalDef) && !goalWithState.queried) {
          if (tgtGoalDef.prompt) {
            convo.outputMgr.prompt(response, tgtGoalDef.prompt);
          } else if (tgtGoalDef.ask) {
            convo.outputMgr.ask(response, tgtGoalDef.ask);
          } else {
          }
          goalWithState.queried = true;
          updateGoalState(goalNdx, goalWithState);
        } else {
          console.log(`*** Goal: ${goalWithState.key} -- does not have resolve or prompt`);
        }
        return Promise.resolve();
    })});
  };

  // this is what gets called every time a user says something
  _processIntent(requ, resp, goalName, intentResolveCB) {
    var response = new Response(this.convoEngine, requ, resp);
    var outputMgr = this.convoEngine.outputMgr;
    outputMgr.setSpeaking();
    outputMgr.initialize();
    return this._followGoals(response, goalName, intentResolveCB)
      .then(()=>{
        outputMgr.sendFromQueue(resp);
        outputMgr.initialize();       // clear buffers
        outputMgr.clearSpeaking();
      });
  };

  processAllIntents(requ, resp, idName, intentDefArr) {
    // console.log(`--> Rcvd Input [processAllIntents]: ${idName} / Potential intents: ${intentDefArr.length}`)
    // setup - copy request variables to session variables
    alexaAppExt.reqListSlots(requ).forEach((slotName)=>{
      console.log('store upgrade: requstSlots->sessionStore: ' + slotName);
      requ.getSession().set(slotName, requ.slot(slotName));
    });

    // call intent-callback
    if (intentDefArr.length==1) {
      return this._processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].resolve);
    }
    // pick right resolveCB from intentDefArr
    for (var ndx = this.goalsToMeet.length; ndx--; ) {
      var currentGoal = this.goalsToMeet[ndx];
      for (var ndx2 = 0; ndx2 < intentDefArr.length; ndx2++) {
        var intentDef = intentDefArr[ndx2];
        if (intentDef.goal && intentDef.goal == currentGoal) {
          return this._processIntent(requ, resp, intentDef.goal, intentDef.resolve);
        }
      }
    }
    console.log(`WARN: No perfect match response for: ${idName} intentDefArr.length: ${intentDefArr.length} utterances:`, intentParams["utterances"]);
    return this._processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].resolve);
  }

}


/*
 * Space sensitive js serialization only supporting array items (using ';') and
 * boolean flags being true (using ':')
 */
class ShortJSON {
  static sjnToArr(str) {
    if (!str) str = '';
    if (str == '') return [];
    return str.split(';');
  }
  static arrToSJN(arr) { return arr.join(';'); }
  static arrToArrObj(arr) {
    return arr.map(arrItem=>{
      var arrObj = {};
      arrItem.split(':').forEach((arrObjProp, ndx)=>{
        if (ndx==0)
          arrObj.key = arrObjProp;
        else
          arrObj[arrObjProp] = true;
      })
      return arrObj;
    })
  }
  static arrObjToArr(arrObj) {
    return arrObj.map(arrObjItem=>{
      var arrItem = arrObjItem.key;
      Object.keys(arrObjItem).forEach(arrObjProp=>{
        if (arrObjProp == 'key') return;
        if (arrObjItem[arrObjProp]) arrItem += ':' + arrObjProp;
      })
      return arrItem;
    })
  }
  static arrToArrObjKey(arr) {
    return this.arrToArrObj(arr).map(i=>{return i.key;});
  }
  static arrPush(arr, str) {
    // console.log(`||| arrPush -- sjnArr: ${arr} // str: ${str}`)
    if (!arr)
      return str;
    else
      return arr + ';' + str;
  }
  static inSJN(sjnArr, str) {
    if (!sjnArr) sjnArr = '';
    // console.log(`||| inSJN -- sjnArr: ${sjnArr} // str: ${str}`)
    return (sjnArr.match(new RegExp(`\\b${str}\\b`)) != null);
  }
  // clears first object
  static clearInSJN(sjnArr, str) {
    // console.log(`clearInSJN -- sjnArr: ${sjnArr} // str: ${str}`)
    if (!sjnArr) sjnArr = '';
    return sjnArr
            .replace(new RegExp(`\\b${str}(:[a-z]*)*\\b`),'') // remove as many goal attributes
            .replace(/;;/,';')                                // cleanup
            .replace(/;$/,'')
            .replace(/^;/,'');
  }
}


const convoGoals = 'convoGoalState';

/**
 * The primary class for scripts to use to define how they
 * {@link module:conversationEngine~ConversationEngine#respondTo respond to}
 * users (intents) and how
 * {@link module:conversationEngine~ConversationEngine#defineGoal goals behave}
 * behave when triggered by the script.
 * <br><br>
 * This class is helped by the ScriptParser to build a model of the users
 * script, the InputMgr to process data from Alexa and call intents in Scripts,
 * and the OutputMgr to take calls from Scripts via the Response class and
 * build an output for sending back to Alexa.
 */
class ConversationEngine {
  /**
   * Constructed and returned by Violet when a Voice Script initializes
   */
  constructor(appName) {
    this._app = new alexa.app(appName);

    this.inputMgr = new InputMgr(this);
    this.outputMgr = new OutputMgr();

    // list(array) of equivalent phrases
    this.phraseEquivalents = [];

    // variable names and their types
    this.keyTypes = {};

    this.registeredGoals = {};
    // this.goalsToMeet = []; // changing implmenetation to be a session variable
    this.topLevelGoals = [];

    this.persistentStore = null;


    // userSpeechDef looks like {
    //      userSpeechItem1: [intentDef1, ...]
    //      userSpeechItem2: [intentDef2, intentDef3...]
    //    }
    // where intentDef looks like {goal, resolveCB}
    this.userSpeechDef = {};
    // for debuggability we would like to keep the order of the phrases - which is why we are keeping the additional array
    // allIntents looks like
    // [[intent1-userSpeechItem1, intent1-userSpeechItem2],
    //  [intent2-userSpeechItem3, intent2-userSpeechItem4, intent2-userSpeechItem5],
    //     ...]
    this.allIntents = [];
  }


  // optimizations taking advantage of ShortJSON
  _getGoalsRaw(response) {
    return response.get(convoGoals);
  }
  getGoalNames(response) {
    return ShortJSON.arrToArrObjKey(ShortJSON.sjnToArr(this._getGoalsRaw(response)));
  }
  getGoalStates(response) {
    return ShortJSON.arrToArrObj(ShortJSON.sjnToArr(this._getGoalsRaw(response)));
  }
  setGoalStates(response, goalObjsArr) {
    response.set(convoGoals, ShortJSON.arrToSJN(ShortJSON.arrObjToArr(goalObjsArr)));
  }
  appendGoal(response, goalName) {
    var sjnArr = this._getGoalsRaw(response);
    response.set(convoGoals, ShortJSON.arrPush(sjnArr, goalName));
  }
  clearGoal(response, goalName) {
    console.log('--> Clearing Goal: ' + goalName);
    if (!goalName) return; // no need to check when we are not clearing anything
    var curGoals = this._getGoalsRaw(response);
    if (!curGoals) curGoals = '';
    var updatedGoals = ShortJSON.clearInSJN(curGoals, goalName);
    if (curGoals.length == updatedGoals.length)
      console.log('\t Goal Not Found');
    else
      response.set(convoGoals, updatedGoals);
  };
  hasGoal(response, goalName) {
    console.log('--> Checking goal: ' + goalName);
    return ShortJSON.inSJN(this._getGoalsRaw(response), goalName);
  };


  addGoal(response, goalName) {
    console.log('--> Adding Goal: ' + goalName);
    this.appendGoal(response, goalName);
    if (!this.outputMgr.speaking()) {
      if (this.setAlert) this.setAlert('{{unmetGoals}}');
    }
  };
  clearAllGoals(response) {
    this.setGoalStates(response, []);
  };
  // a LIFO queue
  mostRecentGoalStates(response, goalNdx) {
    return topInArr(this.getGoalStates(response), goalNdx);
  }
  updateMostRecentGoalStates(response, goalNdx, goalWithState) {
    console.log(`--> Updating Goal[${goalNdx}]:  ${goalWithState.key} `, goalWithState);
    var goals = this.getGoalStates(response);
    if (updateArr(goals, goalNdx, goalWithState)) {
      this.setGoalStates(response, goals);
    }
  }
  // experimental
  addTopLevelGoal(response, goal) {
    console.log('--> TL Goal added: ' + goal);
    this.topLevelGoals.push(goal);
  };



  _registerIntentDef(userSpeech, intentDefArr) {
    userSpeech = ScriptParser.forPunctuation(userSpeech);
    userSpeech = ScriptParser.forSlots(this.keyTypes, userSpeech);
    userSpeech = ScriptParser.forPhraseEquivalents(this.phraseEquivalents, userSpeech);
    var intentParams = {};
    intentParams["utterances"] = userSpeech;
    let expectedParams = ScriptParser.extractParamsFromSpeech(this.keyTypes, userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams["slots"] = expectedParams;

    var idName = undefined;
    for (var idNdx = 0; idNdx < intentDefArr.length; idNdx++) {
      idName = intentDefArr[idNdx].name;
      if (idName!=undefined) break;
    }
    if (idName==undefined) idName = _genIntentName();

    _regIntent(this._app,  idName, intentParams, (requ, resp) => {
      return this.inputMgr.processAllIntents(requ, resp, idName, intentDefArr);
    });
  }

  _getIntentsDef() {
    return {
      allIntents: this.allIntents,
      userSpeechDef: this.userSpeechDef,
      registeredGoals: this.registeredGoals,
      keyTypes: this.keyTypes
    }
  }
  _registerIntents({allIntents, userSpeechDef, registeredGoals, keyTypes}) {
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
        this._registerIntentDef(userSpeech, intentDefArr);
    }
    // second pass for globalIntents
    for (let userSpeechItem in userSpeechDef) {
      if (userSpeechDef[userSpeechItem].length==1) continue;
      let userSpeech = [userSpeechItem];
      let intentDefArr = userSpeechDef[userSpeechItem];
      this._registerIntentDef(userSpeech, intentDefArr);
    }

    // register custom slots
    for (var kt in keyTypes) {
      if (typeof keyTypes[kt] == 'object' && keyTypes[kt].values)
        this._app.customSlot(keyTypes[kt].type, keyTypes[kt].values);
    }

  }


  setServerApp(alexaRouter) {
    this._app.express({
      router: alexaRouter,
      checkCert: false,
      debug: true,
    });
  }

  /**
   * Used to define parameters that can be expected from the user
   * @example <caption>basic usage</caption>
   * violet.addInputTypes({
   *   'name': 'AMAZON.US_FIRST_NAME',
   * });
   *
   * violet.respondTo(['My name is [[name]]'],
   *  (response) => {
   *    response.say('I like the name [[name]]')
   *  });
   *
   * @example <caption>defining custom types</caption>
   * violet.addInputTypes({
   *   'timeUnit': {
   *     type: 'timeUnitType',
   *     values: ['days', 'hours', 'minutes']
   *   }
   * });
   *
   * @example <caption>defining literals (while literals are open ended, it is recommended to use custom types for better recognition)</caption>
   * violet.addInputTypes({
   *   'itemName': {
   *     type: 'AMAZON.LITERAL',
   *     sampleValues: ['Call Chris', 'Book an appointment']
   *   }
   * });
   * @param {Object} keyTypes - key:value pairs representing varName:typeName.
   *    typeName can alternatively be an object for customSlots (with a values
    *   property) or for literals (with a sampleValues property)
   */
  addInputTypes(_keyTypes) {
    for (var type in _keyTypes) {
      this.keyTypes[type] = _keyTypes[type];
    }
  }

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
  addPhraseEquivalents(_phraseEquivalents) {
    // add to phraseEquivalents after lowering case
    _phraseEquivalents.forEach((_equivSets) => {
      var newEquivSet = [];
      _equivSets.forEach((_phrase) => {
        newEquivSet.push(_phrase.toLowerCase());
      });
      this.phraseEquivalents.push(newEquivSet);
    });
  }

  setPersistentStore(_persistentStore) {this.persistentStore = _persistentStore}

  setSpokenRate(_rate) {
    this.outputMgr.spokenRate = _rate;
  }

  /**
   * Defines what should happen when a goal is triggered (by calling the
   * {@link module:response~Response#addGoal addGoal} method). Goals allow for
   * the grouping of application and user responses.
   *
   * @example <caption>setting up goals to be triggered from a regular intent</caption>
   * violet.respondTo('What time does the [[airline]] flight arrive',
   *   (response) => {
   *     response.addGoal('flightArrivalTime');
   * });
   * violet.respondTo('What time does the flight arrive from [[city]]',
   *   (response) => {
   *     response.addGoal('flightArrivalTime');
   * });
   * @example <caption>when the user is asking for a flight arrival time and we want to check if dependencies have been provided</caption>
   * violet.defineGoal({
   *   goal: 'flightArrivalTime',
   *   resolve: (response) => {
   *     if (!response.ensureGoalFilled('airline')
   *         || !response.ensureGoalFilled('city')
   *         || !response.ensureGoalFilled('flightDay') ) {
   *           return false; // dependent goals not met
   *         }
   *     var airline = response.get('airline');
   *     var city = response.get('city');
   *     var flightDay = response.get('flightDay');
   *     flightArrivalTimeSvc.query(airline, city, flightDay, (arrivalTime)=>{
   *       response.say('Flight ' + airline + ' from ' + city + ' is expected to arrive ' + flightDay + ' at ' + arrivalTime);
   *     });
   *     return true;
   *   }
   * });
   * @example <caption>when the user is asking for a flight arrival time and has not provided the airline name</caption>
   * violet.defineGoal({
   *   goal: 'airline',
   *   prompt: ['What airline', 'What airlines are you looking for the arrival time?'],
   *   respondTo: [{
   *     expecting: '[[airline]]',
   *     resolve: (response) => {
   *       response.set('airline', response.get('airline') );
   *   }}]
   * });
   * @example <caption>when the user is asking for a flight arrival time and has not provided the originating city</caption>
   * violet.defineGoal({
   *   goal: 'city',
   *   prompt: ['What city do you want the flight to be arriving from'],
   *   respondTo: [{
   *     expecting: '[[city]]',
   *     resolve: (response) => {
   *       response.set('city', response.get('city') );
   *   }}]
   * });
   *
   * @param {Object} goalDef - goal definition
   * @param {string} goalDef.goal - name of the goal
   * @param {resolveCallback} goalDef.resolve - callback when the goal is triggered (required unless prompt or ask have been provided)
   * @param {string} goalDef.prompt - string to prompt the user (usually for information) when the goal has been triggered
   * @param {string} goalDef.ask - similar to prompt, except that user can be prompted multiple items, but asked only one question at a time
   * @param {Object[]} goalDef.respondTo - array of intents than can be triggered only after this goal has been triggered - for details see the {@link module:conversationEngine~ConversationEngine#respondTo respondTo} method (required if prompt or ask have been provided)
   */
  defineGoal(goalObj) {
    this.registeredGoals[goalObj.goal] = goalObj;

    // register nested intents
    if (goalObj.respondTo) {
      goalObj.respondTo.forEach((intentDef) => {
        intentDef.goal = goalObj.goal;
        this.respondTo(intentDef);
      });
    }
  }


  getIntentsDef() {
    return this._getIntentsDef();
  }

  registerIntents() {
    this._registerIntents(this._getIntentsDef());
  }

  /**
   * Called when a user triggers one of the actions/intents or when a goal is
   * being resolved based on the Voice Script
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
   * @param {string} intentDef.goal - (optional) when provided above is applied only during given goal
   */
  respondTo(intentDef) {
    if (arguments.length>1) {
      var p = {};
      if (arguments[0]) p.expecting = arguments[0];
      if (arguments[1]) p.resolve   = arguments[1];
      if (arguments[2]) p.goal      = arguments[2];
      return this.respondTo(p);
    }

    if (!Array.isArray(intentDef.expecting)) {
      intentDef.expecting = [intentDef.expecting];
    }

    // index speech items and their definitions - so that we can register them when they have all been defined
    this.allIntents.push(intentDef.expecting);
    intentDef.expecting.forEach((userSpeechItem) => {
      if (!this.userSpeechDef[userSpeechItem]) this.userSpeechDef[userSpeechItem] = [];
      this.userSpeechDef[userSpeechItem].push(intentDef);
    });
  }



}

module.exports = ConversationEngine;
