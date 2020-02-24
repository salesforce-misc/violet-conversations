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
var yaml = require('js-yaml');
var utteranceHelper = require('alexa-utterances');
var debug = require('debug')('engine:convo'); // to enable run as: DEBUG=engine:convo OR DEBUG=*
var warn = require('debug')('warn:conversationEngine'); // to enable run as: DEBUG=warn:conversationEngine OR DEBUG=*

var utils = require('./utils.js');
var Response = require('./response.js');
var ScriptParser = require('./scriptParser.js');
var FlowScriptCompiler = require('./flowScriptCompiler.js');
var coreWidgets = require('./coreWidgets.js');
var dialogWidgets = require('./dialogWidgets.js');
var logicWidgets = require('./logicWidgets.js');

// support debuggability by:
// - making sure generated names are understandable
var easeDev = true;

const internalPrefixId = 'violet';
const internalIdSep = '_';

///////////////////////////
// generic utilities
///////////////////////////
var topInArr = (arr, ndx)=>{if (arr.length==0 || ndx>=arr.length) return undefined; else return arr[arr.length-ndx-1];}
var updateArr = (arr, ndx, newVal)=>{if (arr.length==0 || ndx<0 || ndx>=arr.length) return false;  arr[arr.length-ndx-1] = newVal; return true;}

///////////////////////////
// generic utilities
///////////////////////////

// generate from: 0, 1, 2, 3, ... 25, 26, 27, 28, ... 51, 52, 53, ...
//            to: a, b, c, d, ...  z, aa, ab, ac, ... az, ba, bb, ...
var _numToA26 = function(val) {
  if (val>25) return _numToA26(Math.floor(val/26)-1) + _numToA26(val%26)
  return String.fromCharCode(val+'a'.charCodeAt(0));
};
// generate from: a, b, c, ... z,  aa, ab, ac, ... az, ba, bb, ...
//            to: 0, 1, 2, ... 25, 26, 27, 28, ... 51, 52, 53, ...
var _a26ToNum = function(val) {
  if (!val) return -1;

  var num = 0;
  val.split('').forEach(alpha=>{
    num = num*26 + alpha.charCodeAt(0)-'a'.charCodeAt(0)+1;
  });
  return num-1;
};


///////////////////////////
// registration utilities
///////////////////////////

var _getAlphabeticCtr = function(ndx,prefix) {
  var retStr = internalPrefixId;
  if (prefix) retStr += internalIdSep + prefix;
  if (ndx>0)  retStr += internalIdSep + _numToA26(ndx-1);
  return retStr;
};
var _getAlphabeticNdx = function(cntr) {
  return _a26ToNum(cntr)+1;
};

var _generatedIntents = 0;
var _genIntentName = function(roots) {
  // intent names cannot have digits in them
  var iName = _getAlphabeticCtr(_generatedIntents);
  _generatedIntents++;
  if (roots && easeDev) {
    roots = roots.filter(r=>{if (r) return true; else return false;})
    if (roots.length > 0) iName += '_' + roots.join('_');
  }
  return iName;
}

// signature tries to get to the essence and find equivalent userSpeechItems
// it converts all variables to have a type based id allowing to find equivalents
var _getUserSpeechItemSig = function(userSpeechItem, inputTypes) {
  // note: this implementation conflates a type signature with the final
  // variable name - however, this does work for our simple scenarios
  if (!userSpeechItem) return {str:userSpeechItem};
  var sigItems = userSpeechItem.trim().replace(/\s+/g,' ').split(/\[\[|\]\]/); // Re: [[|]]

  var typeCnt = {};
  var typeMappings = {};

  // process the sigItems
  sigItems = sigItems.map((item, ndx)=>{
    if (ndx%2==0) return item.toLowerCase();
    var typeSig = ScriptParser.getVarType(inputTypes, item);
    if (!typeSig) typeSig = ScriptParser.getDefaultType(); // `?${item}?`

    if (!typeCnt[typeSig]) {
      typeCnt[typeSig] = 1;
    } else {
      typeCnt[typeSig] = typeCnt[typeSig] + 1;
    }
    typeMappings[item] = _getAlphabeticCtr(typeCnt[typeSig]-1, typeSig);
    // debug(`::::: added mapping: ${item}->${typeMappings[item]}`)
    return `[[${typeMappings[item]}]]`;
  });

  return {
    typeMappings,
    str: sigItems.join('')
  };
}





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

    var listGoals = (action)=>{debug(`[${action}] goals to meet: `, convo._getGoalsRaw(response));}
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

    // debug('--> Triggered Goal [_followGoals]: ' + goalName);
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
          console.error('ERROR: Goal not defined - ' + goalWithState.key);
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        // debug('--> Trying to meet goal: ' + goalWithState.key);
        // debug('--> registeredGoals: ', convo.convo.registeredGoals);
        // debug('--> tgtGoalDef: ', tgtGoalDef);
        if (tgtGoalDef.resolve) {
          return resolveGoal(tgtGoalDef.resolve, goalWithState.key, response);
        } else if (goalDefQueryable(tgtGoalDef) && goalWithState.queried) {
          debug(`Goal: ${goalWithState.key} -- already queried. Skipping`);
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
          debug(`*** Goal: ${goalWithState.key} -- does not have resolve or prompt`);
        }
        return Promise.resolve();
    })});
  };

  // this is what gets called every time a user says something
  _processIntent(response, intentDef) {
    // setup - copy request variables to session variables
    debug('inputTypes: ', response.platReq.getInputTypes())
    response.platReq.getInputTypes().forEach((reqName)=>{
      var storeName = reqName;
      if (storeName.startsWith(internalPrefixId)) {
        // var userSpeech = this.convoEngine._processUserSpeech(intentDef.expecting);
        // var userSpeech = ScriptParser.forInputTypes(this.convoEngine.convo.inputTypes, intentDef.expecting);
        var userSpeech = intentDef.expecting;
        userSpeech.forEach(usEntry=>{
          var usis = _getUserSpeechItemSig(usEntry, this.convoEngine.convo.inputTypes);
          Object.entries(usis.typeMappings).forEach(([scriptType,sigType])=>{
            if (sigType === reqName) storeName = scriptType;
          });
        });
      }
      var upgradeVal = response.platReq.getInputType(reqName);
      response.platReq.getSession().set(storeName, upgradeVal);
      debug(`store upgrade - requstSlots->sessionStore: ${reqName}->${storeName}: `, upgradeVal);
    });

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

  processAllIntents(platReq, idName, intentParams) {
    // debug(`--> Rcvd Input [processAllIntents]: ${idName} / Potential intents: ${intentDefArr.length}`)
    var intentDefArr = this.convoEngine.convo.intentRegistry[idName].intentDefArr;

    var response = this._getResponse(platReq);

    // call intent-callback
    if (intentDefArr.length==1) {
      return this._processIntent(response, intentDefArr[0]);
    }

    // intentDefArr.length>1

    var findIntentDef = (goalStateToFind)=>{
      for (var intentDefNdx = 0; intentDefNdx < intentDefArr.length; intentDefNdx++) {
        var intentDef = intentDefArr[intentDefNdx];

        // search for goalStateToFind
        if (goalStateToFind && intentDef.goal && intentDef.goal == goalStateToFind) {
          debug(`==> intentMatch [goal:${goalStateToFind}] ${intentDef.name}`);
          return intentDef;
        }

        // the null search, i.e. find me any intentDef with *no* goals attached to it
        if (!goalStateToFind && !intentDef.goal) {
          debug(`==> intentMatch [goal:empty] ${intentDef.name}`);
          return intentDef;
        }
      }
      return null;
    };

    // pick perfect match goals resolveCB
    // console.log(`... goals to meet: `, this.convoEngine._getGoalsRaw(response));
    var ndx=0;
    while (true) {
      var currentGoalState = this.convoEngine.mostRecentGoalStates(response, ndx++)
      if (currentGoalState==null) break;
      var intentDef = findIntentDef(currentGoalState.key);
      if (intentDef) return this._processIntent(response, intentDef);
    }

    // see if intentDefArr has any intents with no goals, i.e. call a generic implementation
    var intentDef = findIntentDef(null);
    if (intentDef) return this._processIntent(response, intentDef);

    // TODO: call fallbackIntent here - if it is available

    warn(`WARN: No perfect match response for: ${idName} intentDefArr.length: ${intentDefArr.length} utterances:`, intentParams["utterances"]);

    // execute first in intendDefArr
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
    // debug(`||| arrPush -- sjnArr: ${arr} // str: ${str}`)
    if (!arr)
      return str;
    else
      return arr + ';' + str;
  }
  static inSJN(sjnArr, str) {
    if (!sjnArr) sjnArr = '';
    // debug(`||| inSJN -- sjnArr: ${sjnArr} // str: ${str}`)
    return (sjnArr.match(new RegExp(`\\b${str}\\b`)) != null);
  }
  // clears first object
  static clearInSJN(sjnArr, str) {
    // debug(`clearInSJN -- sjnArr: ${sjnArr} // str: ${str}`)
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
  constructor(cfg, convo) {
    this.platforms = cfg.platforms.map(pc=>{
      return new pc.platform(pc.endpoint, cfg, convo);
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
  constructor(appName, cfg) {
    this.appName = appName;

    this.responseDecorators = [];

    var convoEngine = this;

    // the Conversational Object Model
    this.convo = {};

    // list(array) of equivalent phrases
    this.convo.phraseEquivalents = [];

    // variable names and their types
    this.convo.inputTypes = {};

    // for every request that comes in
    this.convo.defaultOpen = false;

    this.convo.registeredGoals = {};
    // this.goalsToMeet = []; // changing implmenetation to be a session variable
    this.convo.topLevelGoals = [];

    this.convo.launchPhrases = ['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.'];
    this.convo.closeRequests = ['I am good', 'No I am good', 'Thanks', 'Thank you'];
    this.convo.spokenRate = null;
    this.convo.pauseTime = '500ms';

    // userSpeechDef looks like {
    //      userSpeechItemSig1: [intentDef1, ...]
    //      userSpeechItemSig2: [intentDef2, intentDef3...]
    //    }
    // where intentDef looks like {goal, resolveCB}
    this.convo.userSpeechDef = {};
    // for debuggability we would like to keep the order of the phrases - which is why we are keeping the additional array
    // allIntents looks like
    // [[intent1-userSpeechItem1, intent1-userSpeechItem2],
    //  [intent2-userSpeechItem3, intent2-userSpeechItem4, intent2-userSpeechItem5],
    //     ...]
    this.convo.allIntents = [];

    // intentRegistry looks like {
    //      intentNameX: {
    //        intentDefArr: [intentDef1, ...]
    //        handler: cb, // calls the right intent in intentDefArr
    //        params: {
    //          inputTypes: { type1: ..., type2: ...}
    //        }
    //      }
    // }
    this.convo.intentRegistry = {};

    this.activeFlowDoc = null; // enables runtime access (used in response.get)
    this.flowScripts = []; // {doc, models, namespace}
    this.expectings = {};
    this.expectingsOverwrite = false;

    this.intentMgr = new IntentMgr(this);

    this.platforms = new PlatformMgr(cfg, this.convo);

    // done inializing! now hooking up event handle, convors
    this.platforms.onError(( exceptionMsg, platReq ) => {
      debug('onError-request: ', platReq.request);
      if (platReq.request.data && platReq.request.data.request && platReq.request.data.request.type == 'IntentRequest')
        debug('onError-IntentRequest: ', platReq.request.data.request.intent)
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
      var launchIntentInfo = convoEngine.convo.intentRegistry['launch'];
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
    debug('--> Clearing Goal: ' + goalName);
    if (!goalName) return; // no need to check when we are not clearing anything
    var curGoals = this._getGoalsRaw(response);
    if (!curGoals) curGoals = '';
    var updatedGoals = ShortJSON.clearInSJN(curGoals, goalName);
    if (curGoals.length == updatedGoals.length)
      debug('\t Goal Not Found');
    else
      response.set(convoGoals, updatedGoals);
  };
  hasGoal(response, goalName) {
    debug('--> Checking goal: ' + goalName);
    return ShortJSON.inSJN(this._getGoalsRaw(response), goalName);
  };

  getAppName() {
    return this.appName;
  }
  addGoal(response, goalName) {
    debug('--> Adding Goal: ' + goalName);
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
    debug(`--> Updating Goal[${goalNdx}]:  ${goalWithState.key} `, goalWithState);
    var goals = this.getGoalStates(response);
    if (updateArr(goals, goalNdx, goalWithState)) {
      this.setGoalStates(response, goals);
    }
  }
  // experimental
  addTopLevelGoal(response, goal) {
    debug('--> TL Goal added: ' + goal);
    this.convo.topLevelGoals.push(goal);
  };

  getScriptControllers() {
    if (!this.activeFlowDoc) return null;
    var fs = this.flowScripts.filter(fs=>{
      return (fs.doc == this.activeFlowDoc);
    });
    if (fs.length == 0) return null;
    return fs[0].controllers;
  }

  // @deprecated
  addFlowScript(script, controllers) {
    this.flowScripts.push({doc: FlowScriptCompiler.load(script), controllers});
  }

  // @deprecated
  loadFlowScript(scriptPath, controllers) {
    try {
      var script = fs.readFileSync(scriptPath, 'utf8');
      this.addFlowScript(script, controllers);
    } catch (e) {
      console.error('Error while trying to load flow script', e);
    }
  }

  /**
   * Imports a given Conversation Flow Language Script and makes the
   * given controllers be accessible from the script.
   *
   * @param {string} script - the conversation script
   * @param {Object} controllers - map of name-value pairs consisting of multiple
   * controllers
   * @param {string} namespace - namespace to be used if nodes in the script are
   * not given an id
   * @default namespace='node'
   */
  async addFlowScriptEx(script, controllers, namespace = 'node') {
    this.flowScripts.push({doc: FlowScriptCompiler.load(script), controllers, namespace});

    var convoEngine = this;
    Object.keys(controllers).forEach(async (m)=>{
      if (controllers[m]['initialize']) await controllers[m]['initialize'](convoEngine);
    });
  }

  /**
   * Reads a Conversation Flow Language Script from the given path and makes the
   * given controllers be accessible from the script.
   *
   * @param {string} scriptPath - path to the conversation script
   * @param {Object} controllers - map of name-value pairs consisting of multiple
   * controllers
   * @param {string} namespace - namespace to be used if nodes in the script are
   * not given an id
   * @default namespace='node'
   */
  async loadFlowScriptEx(scriptPath, controllers, namespace = 'node') {
    try {
      var script = fs.readFileSync(scriptPath, 'utf8');
      await this.addFlowScriptEx(script, controllers, namespace);
    } catch (e) {
      console.error('Error while trying to load flow script', e);
    }
  }

  addExpectings(choiceId, expectArr) {
    if (this.expectings[choiceId]) {
      this.expectings[choiceId] = this.expectings[choiceId].concat(expectArr);
    } else {
      this.expectings[choiceId] = expectArr;
    }
  }

  /**
   * Reads a file containing a list of expectings from the given path and adds
   * those options to the model.
   *
   * Expectings are provided as key-value pairs with the keys representing ids
   * in the CFL script and the values representing options that the script could
   * expect from the user.
   *
   * @param {string} expectingsPath - path to the expectings file (consisting
   * of a yaml based data)
   */
  loadExpectings(expectingsPath) {
    try {
      var doc = yaml.safeLoad(fs.readFileSync(expectingsPath, 'utf8'));
      this.expectings = doc;
      // debug(`convoEngine.expectings: `, this.expectings);
    } catch (e) {
      console.error('Error while trying to load expectings map', e);
    }
  }

  overwriteCFLExpectings(fMerge = false) {
    this.expectingsOverwrite = !fMerge;
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
    userSpeech = userSpeech.filter(userSpeechItem=>userSpeechItem!=null);
    userSpeech = ScriptParser.forPunctuation(userSpeech);
    userSpeech = ScriptParser.forInputTypes(this.convo.inputTypes, userSpeech);
    userSpeech = ScriptParser.forPhraseEquivalents(this.convo.phraseEquivalents, userSpeech);

    var intentParams = {};
    intentParams.utterances = userSpeech;
    let expectedParams = ScriptParser.extractParamsFromSpeech(this.convo.inputTypes, userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams.inputTypes = expectedParams;

    var idName = undefined;
    if (intentDefArr.length == 1) idName = intentDefArr[0].name;
    if (intentDefArr.length > 1) idName = _genIntentName(intentDefArr.map(id=>id.name));
    // console.log(`===> intent:${idName} from:`, intentDefArr.map(id=>id.name));
    if (idName==undefined) idName = _genIntentName();

    if (!this.convo.intentRegistry[idName]) {
      // new idName
      this.convo.intentRegistry[idName] = {};
      this.convo.intentRegistry[idName].params = intentParams;
      this.convo.intentRegistry[idName].intentDefArr = intentDefArr;
      this.convo.intentRegistry[idName].handler = (platReq) => {
        debug(`Received request for intent: ${idName}`);
        return this.intentMgr.processAllIntents(platReq, idName, intentParams);
      };
      this.platforms.regIntent(idName, intentParams, this.convo.intentRegistry[idName].handler);
    } else {
      // given an id that has already been defined, we assume that this is just with more constraints (i.e. goals)
      this.convo.intentRegistry[idName].intentDefArr.push(...intentDefArr);
    }
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
    debug(`Registering ${allIntents.length} intents with ${keyNum(userSpeechDef)} userSpeechItems, ${keyNum(inputTypes)} inputTypes  and ${keyNum(registeredGoals)} goals.`);

    // first pass for intents with no userSpeech (likely platform specific intents)
    if (userSpeechDef[undefined]) {
      for (let intentDef of userSpeechDef[undefined]) {
        this._registerIntentDef([undefined], [intentDef]);
      }
    }

    // second pass for all unique intents (everything but duplicatedIntents)
    for (let intentsUserSpeech of allIntents) {
      // let phraseOptions = duplicatedIntents[phrase];
      if (intentsUserSpeech.length==1 && intentsUserSpeech[0] === undefined) continue;
      let userSpeech = [];
      let intentDefArr = [];
      intentsUserSpeech.forEach((userSpeechItem)=>{
        var usis = _getUserSpeechItemSig(userSpeechItem, this.convo.inputTypes).str;
        if (!userSpeechDef[usis]) return;
        if (userSpeechDef[usis].length==1) { // non duplicatedIntents
          userSpeech.push(userSpeechItem);
          intentDefArr = userSpeechDef[usis];
        }
      });

      if (userSpeech.length>0)
        this._registerIntentDef(userSpeech, intentDefArr);
    }

    // third pass for duplicatedIntents
    for (let userSpeechItem in userSpeechDef) {
      if (userSpeechItem === 'undefined') continue;
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
    var convoEngine = this;
    this.flowScripts.forEach(s=>{
      console.log(`FlowScriptCompiler.compile(s.controllers = '${Object.keys(s.controllers)}', namespace = '${s.namespace}')`)
      FlowScriptCompiler.compile(s.doc, s.controllers, convoEngine, s.namespace);
    });

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
    // make processing easier by splitting {x|y} into x, y
    var userSpeechSplit = intentDef.expecting.map(userSpeechItem => {
      if (userSpeechItem) return utteranceHelper(userSpeechItem);
    });
    intentDef.expecting = Array.prototype.concat(... userSpeechSplit); //single level flatten

    // index speech items and their definitions - so that we can register them when they have all been defined
    this.convo.allIntents.push(intentDef.expecting);

    intentDef.expecting.forEach((userSpeechItem) => {
      var usis = _getUserSpeechItemSig(userSpeechItem, this.convo.inputTypes).str;
      if (!this.convo.userSpeechDef[usis]) this.convo.userSpeechDef[usis] = [];

      // ignore intentDefs that have already been added (happens when a definition is called in two places)
      for (let existingDef of this.convo.userSpeechDef[usis]) {
        if (existingDef.resolve == intentDef.resolve) return;
      }

      this.convo.userSpeechDef[usis].push(intentDef);
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
