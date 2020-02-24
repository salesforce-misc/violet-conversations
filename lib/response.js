/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the Response class that forwards requests to the ConversationEngine's
 * OutputMgr which in turn will respond back to the calling-server and
 * therefore the user.
 *
 * @module response
 */
var safeEval = require('safe-eval');
var alexaAppExt = require('./alexaAppExt.js');
var debug = require('debug')('engine:response'); // to enable run as: DEBUG=engine:response OR DEBUG=*


/**
 * The Response class that forwards requests to the ConversationEngine's
 * OutputMgr which in turn will respond back to the calling-server and
 * therefore the user.
 */
class Response {
  /**
   * Constructed by the ConversationEngine before calling a Voice Script's
   * intent or when trying to resolve a goal
   */
  constructor(convoEngine, platReq) {
    this.convoEngine = convoEngine;

    this.platReq = platReq;
    this.outputMgr = platReq.outputMgr;

    this.goalStateChanged = false;

    this.paramsStore = {
      get: (varName) => {
        if (varName == 'userId') return platReq.getUserId();
        return platReq.getSlot(varName);
      },
      contains: (varName) => {
        if (varName == 'userId') return true;
        return alexaAppExt.reqContainsSlot(req, varName);
      }
    };
    var requestStore = platReq.getSession();
    this.sessionStore = {
      get: (varName, addlContext) => {
        var myContext = requestStore.getAttributes()
        if (varName == 'userId') return platReq.getUserId();
        if (varName.indexOf('.')==-1 && varName.indexOf('(')==-1 && varName.indexOf('=')==-1) return myContext[varName];

        // don't want to change the underlying stores attributes
        myContext = Object.assign({}, myContext);
        // potentially execute script
        myContext = Object.assign(myContext, this.convoEngine.getScriptControllers())
        if (addlContext)
          myContext = Object.assign(myContext, addlContext)
        debug(`\t*** store.get(${varName})... myContext: ${Object.keys(myContext)}`);
        var result;
        try {
          result = safeEval(varName, myContext);
        } catch (err) {
          console.error(err);
        }
        debug(`\t*** store.get(${varName})... result: ${result}`)
        return result;
      },
      clear: (varName) => {
        return requestStore.clear(varName);
      },
      contains: (varName) => {
        return requestStore.contains(varName);
      },
      set: (varName, val) => {
        requestStore.set(varName, val);
      }
    };
  }

  // for advanced users
  _paramsStoreReal() {return this.paramsStore;}
  _paramsStore() {return this.sessionStore;} // we are phasing out easy access to anything but the session store
  _sessionStore() {return this.sessionStore;}
  _persistentStoreReal() {return this.convoEngine.persistentStore;}
  _persistentStore() {return this.sessionStore;} // we are phasing out easy access to anything but the session store

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
  say(potResponses, quick=false) {this.outputMgr.say(this, potResponses, quick)}

  /**
   * Asks the user a question. Items being asked are placed after the say
   * statements. Additionally, only one ask is done at a time, giving the
   * user time to respond.
   *
   * @param {string[]} potResponses - response or array of potential
   * questions for the user
   */
  ask(potResponses) {this.outputMgr.ask(this, potResponses)}

  /**
   * Ends the conversation after the response. By default Violet assumes
   * that you want to close the conversation.
   *
   * @default keepConversationRunning=false
   */
  endConversation() {this.outputMgr.keepConversationRunning=false}

  /**
   * Keeps the conversation after the response. By default Violet assumes
   * that you want to close the conversation.
   *
   * @default keepConversationRunning=false
   */
  keepConversationRunning() {this.outputMgr.keepConversationRunning=true}

  contains(varStr) {
    const varVal = this.sessionStore.get(varStr);
    // debug(`**** contains(${varStr}): >${varVal}<`)
    if (varVal == undefined || varVal == '') return false;
    return true;
  }

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
  get(varStr, addlContext = {}) {
    if (!addlContext.response) addlContext.response = this;
    return this.sessionStore.get(varStr, addlContext);
  }

  /**
   * Sets parameter value for access later
   *
   * @param {string} varStr - variable name
   * @param {Object} val - value attached to the variable
   */
  set(varStr, val) {
    return this.sessionStore.set(varStr, val);
  }

  /**
   * Clears parameter that might have been gotten from the user
   *
   * @param {string} varStr - variable name
   */
  clear(varStr) {
    return this.sessionStore.clear(varStr);
  }

  // goals support

  /**
   * Tells Violet that a goal needs to be met. These goals can be checked
   * to see if they are set by calling *hasGoal* and can be cleared by
   * calling *clearGoal*.
   * <br><br>
   * Once called Violet will call any defined goals after the current
   * *resolve* method finishes.
   */
  addGoal(goal) {
    this.goalStateChanged = true;
    this.convoEngine.addGoal(this, goal);
  }

  /**
   * Checks if a goal has been set.
   */
  hasGoal(goal) {return this.convoEngine.hasGoal(this, goal);}

  /**
   * Clears goals
   */
  clearGoal(goal) {
    this.goalStateChanged = true;
    this.convoEngine.clearGoal(this, goal);
  }

  /**
   * Clears all goals
   */
  clearAllGoals() {
    this.goalStateChanged = true;
    this.convoEngine.clearAllGoals(this);
  }

  goalFilledByStore(destParamName, srcParamName) {
    if (this.contains(destParamName)) {
      return true;
    }
    if (srcParamName && srcParamName!=destParamName && this.contains(srcParamName)) {
      this.set(destParamName, this.get(srcParamName));
      return true;
    }
    debug('*** param not found: ', srcParamName, ' --> ', destParamName);
    return false;
  }
  isGoalFilled(paramName) {
    return this.goalFilledByStore(paramName);
  }
  ensureGoalFilled(paramName) {
    var success = this.goalFilledByStore(paramName);
    if (!success && !this.hasGoal(paramName))
      this.addGoal(paramName);
    return success;
  }
}

module.exports = Response;
