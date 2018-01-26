var alexa = require('alexa-app');
var alexaAppExt = require('./alexaAppExt.js');

var utils = require('./utils.js');
var Response = require('./response.js');


const paramsRE   = /\[\[([a-zA-Z0-9_\.]*)\]\]/;
const paramsGRE  = /\[\[([a-zA-Z0-9_\.]*)\]\]/g;
const pauseStr = ' <break time="500ms"/> ';


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


/**
 * The primary object for scripts to use to define how they
 * {@link module:violet.script~violet.respondTo respond to} users (intents)
 * and more
 *
 * @class
 */
module.exports = class ConversationEngine {
  constructor(appName) {
    this._app = new alexa.app(appName);

    // variable names and their types
    this.keyTypes = {};

    // list(array) of equivalent phrases
    this.phraseEquivalents = [];

    this.asked = 0;      // can be less than one for partial questions, i.e. prompts
    this.sayQueue = [];
    this.askQueue = [];

    this.keepConversationRunning = true;
    this.spokenRate = null;

    this.__speaking = false;

    this.registeredGoals = {};
    this.goalsToMeet = [];
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

  _sayInit() {
    this.asked = 0;

    this.sayQueue = [];
    this.askQueue = [];

    this.keepConversationRunning = true;
  }
  _pick(response, potResponses) {
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
  _say(response, potResponses, quick) {
    if (this.sayQueue.length>0 && !quick) this.sayQueue.push(pauseStr);
    this.sayQueue.push(this._pick(response, potResponses));
  }
  _prompt(response, potResponses) {
    this.askQueue.push(this._pick(response, potResponses));
    this.asked += 0.34;
  }
  _ask(response, potResponses) {
    this.askQueue.push(this._pick(response, potResponses));
    this.asked += 1;
  }
  _sayFinish(resp, response, potResponses) {
    if (potResponses) this.sayQueue.push(this._pick(response, potResponses));
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
  _extractParamsFromSpeech(userSpeech) {
    var expectedParams = {};
    userSpeech.forEach((speechStr) => {
      var extractedVars = speechStr.match(/\|[a-zA-Z]*}/g);
      if (!extractedVars) return;
      extractedVars.forEach((extractedVar) => {
        var ev = extractedVar.slice(1,-1); // strip first and last characters
        if (ev.length == 0) return;
        if (this.keyTypes[ev]) {
          expectedParams[ev] = this.keyTypes[ev];
          if (typeof expectedParams[ev] == 'object') { // support for custom types
            expectedParams[ev]=expectedParams[ev].type;
          }
        }
      });
    });
    return expectedParams;
  };

  _setSpeaking() { this.__speaking = true; }
  _clearSpeaking() { this.__speaking = false; }
  _speaking() { return this.__speaking; }


  _addGoal(goal) {
    console.log('--> Goal added: ' + goal);
    this.goalsToMeet.push(goal);
    if (!this._speaking()) {
      if (this.setAlert) this.setAlert('{{unmetGoals}}');
    }
  };
  _addTopLevelGoal(goal) {
    console.log('--> TL Goal added: ' + goal);
    topLevelGoals.push(goal);
  };
  _hasGoal(goal) {
    console.log('--> Checking goal: ' + goal);
    var ndx = this.goalsToMeet.indexOf(goal);
    return (ndx !== -1);
  };
  _clearGoal(goal) {
    console.log('--> Clearing Goal: ' + goal);
    var ndx = this.goalsToMeet.indexOf(goal);
    if (ndx == -1)
      console.log('\t Goal Not Found');
    else
      this.goalsToMeet.splice(ndx, 1);
  };
  _clearAllGoals() {
    this.goalsToMeet = [];
  };

  // response - conversationalResponse object
  // tgtGoal - removed from the goalsToMeet list when tgtResolve is done without error; can be null
  // tgtResolve - what triggered us right now
  _followGoals(response, tgtGoal, tgtResolve) {
    // console.log('--> Triggered Goal: ' + triggeredGoal);

    // a LIFO queue
    var top = (arr, ndx)=>{if (arr.length==0 || ndx>=arr.length) return undefined; else return arr[arr.length-ndx-1];}
    var remove = (arr, obj)=>{var ndx=arr.indexOf(obj); if (ndx!=-1) arr.splice(ndx,1);}

    var listGoals = (action)=>{console.log(action + ' goals to meet: ', this.goalsToMeet);}
    var topGoal = (goalNdx)=>{listGoals('top'); return top(this.goalsToMeet, goalNdx);}
    var removeGoal = (goal)=>{listGoals('remove'); return remove(this.goalsToMeet, goal);}
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
    if (this.clearAlert) this.clearAlert('{{unmetGoals}}');

    // the core goals loop - following all queued goals until no more
    return p.then(()=>{return utils.promiseWhile(
      ()=>{return this.asked<1 && moreGoalsToSeek == true;},
      ()=>{
        var tgtGoal = topGoal(goalNdx++);
        if (!tgtGoal || tgtGoal == lastGoal) {
          // no need to follow goals if (a) we have nothing queued or (b) the
          //  current goals cannot be added or removed
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        var tgtGoalObj = this.registeredGoals[tgtGoal];
        lastGoal = tgtGoal;
        if (!tgtGoalObj) {
          console.log('ERROR: Goal not defined - ' + tgtGoal);
          moreGoalsToSeek=false;
          return Promise.resolve();
        }

        // console.log('--> Trying to meet goal: ' + tgtGoal);
        // console.log('--> registeredGoals: ', this.registeredGoals);
        // console.log('--> tgtGoalObj: ', tgtGoalObj);
        if (tgtGoalObj.resolve) {
          return resolveGoal(tgtGoalObj.resolve, tgtGoal, response);
        } else if (tgtGoalObj.prompt) {
          this._prompt(response, tgtGoalObj.prompt);
        } else if (tgtGoalObj.ask) {
          this._ask(response, tgtGoalObj.ask);
        } else {
          console.log('*** Goal: ' + tgtGoal + ' -- does not have resolve or prompt');
        }
        return Promise.resolve();
    })});
  };


  // this is what gets called every time a user says something
  _processIntent(requ, resp, goal, resolveCB) {
    var response = new Response(this, requ, resp);
    this._setSpeaking();
    this._sayInit();
    return this._followGoals(response, goal, resolveCB)
      .then(()=>{
        this._sayFinish(resp);
        this._sayInit();       // clear buffers
        this._clearSpeaking();
      });
  };

  _processForPunctuation(userSpeech) {
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return _interpolateParamsFromStore(userSpeechItem, /(\d+)/g, {get: (num)=>{return utils.getNumAsStr(num);}});
    });
    return userSpeech;
  }

  _processForSlots(userSpeech) {
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
          if (this.keyTypes[inStr] && this.keyTypes[inStr].sampleValues) {
            this.keyTypes[inStr].sampleValues = this.keyTypes[inStr].sampleValues
                              .map(v=>{return v.trim();});
            sampleValues = this.keyTypes[inStr].sampleValues.join('|');
            // console.log('** literalSampleValuesStore: ' + inStr + ': ' + sampleValues);
          } else if (!this.keyTypes[inStr]) {
            console.log('*** Received unexpected type :', inStr);
            this.keyTypes[inStr] = 'AMAZON.LITERAL';
          }
          return '{' + sampleValues + '|' + inStr + '}';
        }
      };
      return _interpolateParamsFromStore(userSpeechItem, paramsGRE, literalSampleValuesStore);
    });
    return userSpeech;
  }

  _processForPhraseEquivalents(userSpeech) {
    // return userSpeech;
    var max = userSpeech.length;
    for (var ndx = 0; ndx<max; ndx++) {
      var userSpeechItem = userSpeech[ndx];
      // go through all equivalent phrases (phraseEquivalents x equivSets) to see if there are any matches
      this.phraseEquivalents.forEach((equivSets) => {
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

  _registerIntentDef(userSpeech, intentDefArr) {
    userSpeech = this._processForPunctuation(userSpeech);
    userSpeech = this._processForSlots(userSpeech);
    userSpeech = this._processForPhraseEquivalents(userSpeech);
    var intentParams = {};
    intentParams["utterances"] = userSpeech;
    let expectedParams = this._extractParamsFromSpeech(userSpeech);
    if (Object.keys(expectedParams).length > 0)
      intentParams["slots"] = expectedParams;

    var idName = undefined;
    for (var idNdx = 0; idNdx < intentDefArr.length; idNdx++) {
      idName = intentDefArr[idNdx].name;
      if (idName!=undefined) break;
    }
    if (idName==undefined) idName = _genIntentName();

    _regIntent(this._app,  idName, intentParams, (requ, resp) => {
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
          if (intentDef.goal == currentGoal) {
            return this._processIntent(requ, resp, intentDef.goal, intentDef.resolve);
          }
        }
      }
      console.log(`WARN: No perfect match response for: ${idName} intentDefArr.length: ${intentDefArr.length} utterances:`, intentParams["utterances"]);
      return this._processIntent(requ, resp, intentDefArr[0].goal, intentDefArr[0].resolve);
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


  /*DANGER - will likely remove these soon - only used by ClientTx plugin - DANGER*/
  __get_sayFinish() {return _sayFinish;}
  __set_sayFinish(val) {_sayFinish = val;}

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

  addGoal(goal) {
    this._addGoal(goal);
  }

  setSpokenRate(_rate) {
    this.spokenRate = _rate;
  }

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


  addTopLevelGoalfunction(goal) {
    this._addTopLevelGoal(goal);
  }

  // derecated
  setTopLevelGoal(goal) {
    this._addGoal(goal);
  }

  getIntentsDef() {
    return this._getIntentsDef();
  }

  registerIntents() {
    this._registerIntents(this._getIntentsDef());
  }

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
