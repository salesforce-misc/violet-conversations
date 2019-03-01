/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the ConversationEngine as well as a few classes that help the
 * ConversationEngine - including the ScriptParser to build a model of the users
 * script, the IntentMgr to process data from the Platforms (like Alexa and
 * Google DialogFlow) and call intents in Scripts, and the OutputMgr to take
 * calls from Scripts via the Response class and build an output for sending
 * back to the Platform.
 *
 * @module conversationEngine
 */

var fs = require('fs');
var co = require('co');
var Promise = require('bluebird');

var utils = require('./utils.js');
var Response = require('./response.js');
var ScriptParser = require('./scriptParser.js');
var FlowScriptCompiler = require('./flowScriptCompiler.js');
var coreWidgets = require('./coreWidgets.js');
var dialogWidgets = require('./dialogWidgets.js');
var logicWidgets = require('./logicWidgets.js');


///////////////////////////
// generic utilities
///////////////////////////
var topInArr = (arr, ndx)=>{if (arr.length==0 || ndx>=arr.length) return undefined; else return arr[arr.length-ndx-1];}
var updateArr = (arr, ndx, newVal)=>{if (arr.length==0 || ndx<0 || ndx>=arr.length) return false;  arr[arr.length-ndx-1] = newVal; return true;}

///////////////////////////
// registration utilities
///////////////////////////

var _registeredIntents = 0;
var _getAlphabeticStr = function() {
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
var _genIntentName = _getAlphabeticStr;





/**
 * Helps the ConversationEngine process Inputs (data from from platforms) and call the
 * intents defined in the Violet Scripts
 * <br><br>
 * Methods in this class are currently only used internally and therefore
 * documentation is not exposed.
 *
 * @class
 */
class IntentMgr {
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
      if (result && result.next)
        result = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
      else
        result = Promise.resolve(result) // primarily to convert non-promises to promises

      return result.then((result)=>{
          if (result!=false) removeGoal(goalNameToResolve);
        });
    };
    // XXXXXXXXXXXXX
    var goalDefQueryable = (goalDef)=>{return goalDef.prompt || goalDef.ask; }

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
      ()=>{return response.outputMgr.asked<1 && moreGoalsToSeek == true;},
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

        var tgtGoalDef = convo.convo.registeredGoals[goalWithState.key];
        lastGoalWithState = goalWithState;
        if (!tgtGoalDef) {
          console.log('ERROR: Goal not defined - ' + goalWithState.key);
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        // console.log('--> Trying to meet goal: ' + goalWithState.key);
        // console.log('--> registeredGoals: ', convo.convo.registeredGoals);
        // console.log('--> tgtGoalDef: ', tgtGoalDef);
        if (tgtGoalDef.resolve) {
          return resolveGoal(tgtGoalDef.resolve, goalWithState.key, response);
        } else if (goalDefQueryable(tgtGoalDef) && goalWithState.queried) {
          console.log(`Goal: ${goalWithState.key} -- already queried. Skipping`);
        } else if (goalDefQueryable(tgtGoalDef) && !goalWithState.queried) {
          if (tgtGoalDef.prompt) {
            response.outputMgr.prompt(response, tgtGoalDef.prompt);
          } else if (tgtGoalDef.ask) {
            response.outputMgr.ask(response, tgtGoalDef.ask);
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
  _processIntent(response, intentDef) {
    var outputMgr = response.outputMgr;
    outputMgr.setSpeaking();
    outputMgr.initialize();
    return this._followGoals(response, intentDef.goal, intentDef.resolve)
      .then(()=>{
        outputMgr.sendFromQueue(this.convoEngine.convo.spokenRate, response);
        outputMgr.initialize();       // clear buffers
        outputMgr.clearSpeaking();
      });
  };

  _getResponse(platReq) {
    var resp = new Response(this.convoEngine, platReq);
    this.convoEngine.responseDecorators.forEach(rd=>{
      if (rd.initResponse) resp=rd.initResponse(resp);
    });
    return resp;
  };

  processAllIntents(platReq, idName, intentParams, intentDefArr) {
    // console.log(`--> Rcvd Input [processAllIntents]: ${idName} / Potential intents: ${intentDefArr.length}`)
    // setup - copy request variables to session variables
    platReq.getInputTypes().forEach((inputName)=>{
      console.log('store upgrade: requstSlots->sessionStore: ' + inputName);
      platReq.getSession().set(inputName, platReq.getInputType(inputName));
    });

    var response = this._getResponse(platReq);

    // call intent-callback
    if (intentDefArr.length==1) {
      // TODO ITERATE INTO METHOD TODO
      return this._processIntent(response, intentDefArr[0]);
    }
    // pick right resolveCB from intentDefArr
    var ndx=0;
    while (true) {
      var currentGoalState = this.convoEngine.mostRecentGoalStates(response, ndx++)
      if (currentGoalState==null) break;
      for (var ndx2 = 0; ndx2 < intentDefArr.length; ndx2++) {
        var intentDef = intentDefArr[ndx2];
        if (intentDef.goal && intentDef.goal == currentGoalState.key) {
          return this._processIntent(response, intentDef);
        }
      }
    }
    console.log(`WARN: No perfect match response for: ${idName} intentDefArr.length: ${intentDefArr.length} utterances:`, intentParams["utterances"]);
    return this._processIntent(response, intentDefArr[0]);
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

/**
 * Manages the different platform plugins.
 */
class PlatformMgr {
  constructor(platformsCfg) {
    this.platforms = platformsCfg.map(pc=>{
      return new pc.platform(pc.endpoint);
    })
  }

  setServerApp(violetRouter) {
    this.platforms.forEach(p => {
      p.setServerApp(violetRouter);
    });
  }

  onError(cb) {
    this.platforms.forEach(p => {
      p.onError(cb);
    });
  }

  onLaunch(cb) {
    this.platforms.forEach(p => {
      p.onLaunch(cb);
    });
  }

  regIntent(name, params, cb) {
    this.platforms.forEach(p => {
      p.regIntent(name, params, (platReq)=>{
        return cb(platReq);
      });
    });
  }

  regCustomSlot(type, values) {
    this.platforms.forEach(p => {
      p.regCustomSlot(type, values);
    });
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
 * script, the IntentMgr to process data from the Platforms and call intents in Scripts,
 * and the OutputMgr to take calls from Scripts via the Response class and
 * build an output for sending back to the Platforms.
 */
class ConversationEngine {
  /**
   * Constructed and returned by Violet when a Voice Script initializes
   */
  constructor(appName, platforms) {
    this.appName = appName;
    this.platforms = new PlatformMgr(platforms);

    this.intentMgr = new IntentMgr(this);

    this.responseDecorators = [];

    var convoEngine = this;

    // the Conversational Object Model
    this.convo = {};

    // list(array) of equivalent phrases
    this.convo.phraseEquivalents = [];

    // variable names and their types
    this.convo.inputTypes = {};

    this.convo.registeredGoals = {};
    // this.goalsToMeet = []; // changing implmenetation to be a session variable
    this.convo.topLevelGoals = [];

    this.convo.launchPhrases = ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.'];
    this.convo.closeRequests = ['I am good', 'No I am good', 'Thanks', 'Thank you'];
    this.convo.spokenRate = null;
    this.convo.pauseTime = '500ms';

    // userSpeechDef looks like {
    //      userSpeechItem1: [intentDef1, ...]
    //      userSpeechItem2: [intentDef2, intentDef3...]
    //    }
    // where intentDef looks like {goal, resolveCB}
    this.convo.userSpeechDef = {};
    // for debuggability we would like to keep the order of the phrases - which is why we are keeping the additional array
    // allIntents looks like
    // [[intent1-userSpeechItem1, intent1-userSpeechItem2],
    //  [intent2-userSpeechItem3, intent2-userSpeechItem4, intent2-userSpeechItem5],
    //     ...]
    this.convo.allIntents = [];

    this.flowScriptDoc = null;
    this.scriptModels = {};

    // done inializing! now hooking up event handlers
    this.platforms.onError(( exceptionMsg, platReq ) => {
      console.log(platReq.request);
      console.log(platReq.response);
      platReq.outputMgr.sendFromQueue(platReq, null, 'Sorry an error occurred ' + exceptionMsg);
    });
    var defaultLaunchIntent = {
      goal: 'launch',
      expecting: [],
      resolve: (response) => {
        response.say(convoEngine.convo.launchPhrases);
    }};
    this.platforms.onLaunch( function( platReq ) {
      var response = convoEngine.intentMgr._getResponse(platReq);
      var launchIntentInfo = platReq.platform.getIntent('launch');
      if (launchIntentInfo) {
        return launchIntentInfo.handler(platReq);
      } else {
        return convoEngine.intentMgr._processIntent(response, defaultLaunchIntent);
      }
    });
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

  getAppName() {
    return this.appName;
  }
  addGoal(response, goalName) {
    console.log('--> Adding Goal: ' + goalName);
    this.appendGoal(response, goalName);
    if (!response.outputMgr.isSpeaking()) {
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
    this.convo.topLevelGoals.push(goal);
  };

  addFlowScript(script, models) {
    if (this.flowScriptDoc) console.log('Currently only single flow script is supported');
    this.flowScriptDoc = FlowScriptCompiler.load(script);
    this.scriptModels = models
  }

  loadFlowScript(scriptPath, models) {
    var script = fs.readFileSync(scriptPath, 'utf8');
    this.addFlowScript(script, models);
  }

  /**
   * Override the default launch phrases. Parameter is used directly
   * with the response.say() function when a Platform launches this app
   *
   * @param {string[]} phrases - response or array of potential responses
   */
  setLaunchPhrases(phrases) {
    this.convo.launchPhrases = phrases;
  }

  /**
   * Override the default phrases to close the session.
   *
   * @param {string[]} phrases - response or array of potential responses
   */
  setCloseRequests(phrases) {
    this.convo.closeRequests = phrases;
  }

  _registerIntentDef(userSpeech, intentDefArr) {
    userSpeech = ScriptParser.forPunctuation(userSpeech);
    userSpeech = ScriptParser.forInputTypes(this.convo.inputTypes, userSpeech);
    userSpeech = ScriptParser.forPhraseEquivalents(this.convo.phraseEquivalents, userSpeech);
    var intentParams = {};
    intentParams.utterances = userSpeech;
    let expectedParams = ScriptParser.extractParamsFromSpeech(this.convo.inputTypes, userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams.inputTypes = expectedParams;

    var idName = undefined;
    for (var idNdx = 0; idNdx < intentDefArr.length; idNdx++) {
      idName = intentDefArr[idNdx].name;
      if (idName!=undefined) break;
    }
    if (idName==undefined) idName = _genIntentName();

    this.platforms.regIntent(idName, intentParams, (platReq) => {
      return this.intentMgr.processAllIntents(platReq, idName, intentParams, intentDefArr);
    });
  }

  _getIntentsDef() {
    return {
      allIntents: this.convo.allIntents,
      userSpeechDef: this.convo.userSpeechDef,
      registeredGoals: this.convo.registeredGoals,
      inputTypes: this.convo.inputTypes
    }
  }
  _registerIntents({allIntents, userSpeechDef, registeredGoals, inputTypes}) {
    var keyNum = o => {return Object.keys(o).length;}
    console.log(`Registering ${allIntents.length} intents with ${keyNum(userSpeechDef)} userSpeechItems, ${keyNum(inputTypes)} inputTypes  and ${keyNum(registeredGoals)} goals.`);
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
    for (var kt in inputTypes) {
      if (typeof inputTypes[kt] == 'object' && inputTypes[kt].values)
        this.platforms.regCustomSlot(inputTypes[kt].type, inputTypes[kt].values);
    }

  }


  /**
   * Used to define parameters that can be expected from the user
   * @example <caption>basic usage</caption>
   * violet.addInputTypes({
   *   'name': 'firstName',
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
   * @param {Object} inputTypes - key:value pairs representing varName:typeName.
   *    Commonly supported values for typeName are: firstName, lastName, number,
   *    date, time, phoneNumber, and phrase. In addition, typeName can be an
   *    object for customSlots (with a values property) or for AMAZON.LITERAL
   *    (with a sampleValues property)
   */
  addInputTypes(_inputTypes) {
    for (var type in _inputTypes) {
      this.convo.inputTypes[type] = _inputTypes[type];
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
      this.convo.phraseEquivalents.push(newEquivSet);
    });
  }

  setSpokenRate(_rate) {
    this.convo.spokenRate = _rate;
  }
  setPauseTime(_pauseTime) {
    this.convo.pauseTime = _pauseTime;
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
    this.convo.registeredGoals[goalObj.goal] = goalObj;

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
    // prep based on prev api calls for intent definition
    if (this.convo.closeRequests) {
      this.respondTo({
        name: 'closeSession',
        expecting: this.convo.closeRequests,
        resolve: (response) => {
          response.clearAllGoals();
          response.endConversation();
      }});
    }

    // compile cfl based intent definition
    if (this.flowScriptDoc) FlowScriptCompiler.compile(this.flowScriptDoc, this.scriptModels, this);

    // register intents
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
   * @param {string[]} intentDef.name - (optional) when provided is used as the intent name (otherwise one is generated)
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
    this.convo.allIntents.push(intentDef.expecting);
    intentDef.expecting.forEach((userSpeechItem) => {
      if (!this.convo.userSpeechDef[userSpeechItem]) this.convo.userSpeechDef[userSpeechItem] = [];
      this.convo.userSpeechDef[userSpeechItem].push(intentDef);
    });
  }

  /**
   * Called by some Violet plugins (such as the store plugins) to decorate the Response
   * class when instantiated. The initResponse method on these objects are called
   * with the Response object as a parameter and are expected to return the decorated
   * response object.
   */
  registerResponseDecorator(rd) {
    this.responseDecorators.push(rd)
  }


}

module.exports = ConversationEngine;
