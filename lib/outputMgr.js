/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the OutputMgr class that helps the ConversationEngine build an output
 * as provided by Violet Scripts
 *
 * @module outputMgr
 */
var utils = require('./utils.js');
var ScriptParser = require('./scriptParser.js');
var debug = require('debug')('engine:output'); // to enable run as: DEBUG=engine:output OR DEBUG=*


var _pickAndInterpolate = function(potResponses, interpolationStore) {
  var str = potResponses;
  if (Array.isArray(potResponses)) {
    str = potResponses[utils.getRand(0, potResponses.length)];
  }
  if (interpolationStore) { // unlikely, but in error situations interpolationStore can be null
    str = ScriptParser.interpolateParamsFromStore(str, ScriptParser.paramsRE, interpolationStore);
  }
  if (!str) debug(new Error().stack);
  debug('picking for output: ' + str);
  return str;
}


/**
 * Helps the ConversationEngine build an output (back to Alexa) as provided by
 * calls from Violet Scripts to the Response class. This class can theoretically
 * span multiple Response's (when multiple goals are being met).
 * <br><br>
 * Methods in this class are currently only used internally and therefore
 * documentation is not exposed.
 *
 * @class
 */
class OutputMgr {
  constructor(_platReq) {
    this.platReq = _platReq;

    // init runtime state
    this.__speaking = false;
    this.initialize();
  }
  initialize() {
    this.asked = 0;       // can be less than one for partial questions, i.e. prompts

    this.sayQueue = [];
    this.askQueue = [];

    // set keepConversationRunning (for the next request)
    if (this.platReq.platform.convoModel.defaultOpen)
      this.keepConversationRunning = true;
    else
      this.keepConversationRunning = false;
  }


  setSpeaking() { this.__speaking = true; }
  clearSpeaking() { this.__speaking = false; }
  isSpeaking() { return this.__speaking; }

  getPauseStr(response) {
    if (response.convoEngine.convo.pauseTime)
      return ` <break time="${response.convoEngine.convo.pauseTime}"/> `;
    else
      return null;
  }
  queuePause(response) {
    var p = this.getPauseStr(response);
    if (p) this.sayQueue.push(p);
  }
  say(response, potResponses, quick) {
    if (this.sayQueue.length>0 && !quick) this.queuePause(response);
    this.sayQueue.push(_pickAndInterpolate(potResponses, response._sessionStore()));
  }
  prompt(response, potResponses) {
    this.askQueue.push(_pickAndInterpolate(potResponses, response._sessionStore()));
    this.asked += 0.34;
  }
  ask(response, potResponses) {
    this.askQueue.push(_pickAndInterpolate(potResponses, response._sessionStore()));
    this.asked += 1;
  }
  sendFromQueue(spokenRate, response, potResponses) {
    if (!response) response = {_sessionStore: ()=>{}};

    var fKeepSessionOpen = this.keepConversationRunning;
    if (this.asked > 0) fKeepSessionOpen = true;
    if (fKeepSessionOpen) this.platReq.shouldEndSession(false);

    if (potResponses) this.sayQueue.push(_pickAndInterpolate(potResponses, response._sessionStore()));
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
      if (ndx==0) {
        var p = this.getPauseStr(response);
        if (p) outBuffer += p;
        outBuffer += str;
      } else if (ndx==this.askQueue.length-1)
        outBuffer += ' or ' + str;
      else
        outBuffer += ', ' + str;
    });

    if (spokenRate) outBuffer = `<prosody rate="${spokenRate}">${outBuffer}</prosody>`;
    outBuffer = outBuffer.replace(/\s&\s/g, ' and ');

    if (outBuffer !== '') {
      debug('Saying: ' + outBuffer);
      this.platReq.say(outBuffer);
    }
    return outBuffer;
  }
  /*DANGER - will likely remove these soon - only used by ClientTx plugin - DANGER*/
  __get_sendFromQueue() {return this.sendFromQueue;}
  __set_sendFromQueue(val) {this.sendFromQueue = val;}

}


module.exports = OutputMgr;
