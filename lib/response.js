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
  constructor(convoEngine, requ, resp) {
    this.convoEngine = convoEngine;
    this.outputMgr = convoEngine.outputMgr;

    this.requ = requ;
    this.resp = resp;

    this.goalStateChanged = false;

    this.paramsStore = {
      get: (varName) => {
        if (varName == 'userId') return requ.userId;
        return requ.slot(varName);
      },
      contains: (varName) => {
        if (varName == 'userId') return true;
        return alexaAppExt.reqContainsSlot(req, varName);
      }
    };
    var requestStore = requ.getSession();
    this.sessionStore = {
      get: (varName, addlContext) => {
        // requestStore.set('foo', 'bar')
        var myContext = requestStore.getAttributes() // <-- alexa specific
        myContext = Object.assign(myContext, this.convoEngine.scriptModels)
        if (addlContext)
          myContext = Object.assign(myContext, addlContext)
        // console.log('myContext: ', myContext)
        var result;
        try {
          result = safeEval(varName, myContext);
        } catch (err) {}
        // console.log(`store.get(${varName}) = ${result}`)
        return result;
      },
      contains: (varName) => {
        return requestStore.contains(varName);
      },
      set: (varName, val) => {
        requestStore.set(varName, val);
      }
    };
  }

  // so that users can try out cuting edge features - using this will possibly limit support for AWS Lex, Google Home, etc.
  _alexa_request() {return this.requ;}
  _alexa_response() {return this.resp;}

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
   * that you want to keep the conversation open.
   *
   * @default keepConversationRunning=true
   */
  endConversation() {this.outputMgr.keepConversationRunning=false}

  contains(varStr) {
    return (this.sessionStore.get(varStr) != undefined);
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
  get(varStr, addlContext = null) {
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

  // persistence support
  /**
   * Retrieves the given object from the Salesforce database.
   *
   * @param {Object} queryParams - query parameters
   * @param {string} queryParams.objName - the object/table name in the data
   *   store where the give object is to be updated
   * @param {string} queryParams.keyName - the key name to find the object to be updated
   * @param {string} queryParams.keyVal - the key value to find the object to be updated
   * @param {string} queryParams.query - the SOQL query, i.e. what gets executed is "SELECT <query>"
   * @param {string} queryParams.filter - additional query results filter - this
   *  is added to the end of the SQL query
   * @param {string} queryParams.queryXtra - additional bits to be
   *  added to the end of the query, for example "LIMIT 100". "LIMIT 100" is auto added. 
   *  Use false to prevent auto adding, for example when using aggregate queries.
   * alternatively, can pass in params as: objName, keyName, keyVal, filter, queryXtra
  */
  load(params) {
    if (arguments.length>1) {
      var p = {};
      if (arguments[0]) p.objName   = arguments[0];
      if (arguments[1]) p.keyName   = arguments[1];
      if (arguments[2]) p.keyVal    = arguments[2];
      if (arguments[3]) p.filter    = arguments[3];
      if (arguments[4]) p.queryXtra = arguments[4];
      return this.load(p);
    }

    if (!params.objName && !params.query) {
      console.log('Need object or query to load');
      return Promise.resolve();
    }

    if (!params.query) params.query = ''
    if (typeof params.queryXtra === "undefined") params.queryXtra = ''
    if (params.queryXtra !== false && params.query.toLowerCase().indexOf('limit') == -1 &&
          params.queryXtra.toLowerCase().indexOf('limit') == -1)
      params.queryXtra += ' limit 100';

    if (params.objName)
      console.log('Loading object: ' + params.objName);
    else
    console.log('Loading: ', params);
    return this.convoEngine.persistentStore.load(params);
  }
  store(objName, dataToStore) {
    console.log('Storing object: ' + objName);
    return this.convoEngine.persistentStore.store(objName, dataToStore);
  }
  update(objName, keyName, keyVal, updateData) {
    console.log('Updating object: ' + objName);
    return this.convoEngine.persistentStore.update(objName, keyName, keyVal, updateData);
  }
  delete(objName, keyName, keyVal, deleteData) {
    console.log('Deleting object: ' + objName);
    return this.convoEngine.persistentStore.delete(objName, keyName, keyVal, deleteData);
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
    console.log('*** param not found: ', srcParamName, ' --> ', destParamName);
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
