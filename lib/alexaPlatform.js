/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const alexa = require('alexa-app');
const alexaAppExt = require('./alexaAppExt.js');
const PlatformReq = require('./platformPlugin.js').PlatformReq;
const PlatformPlugin = require('./platformPlugin.js').PlatformPlugin;
const debug = require('debug')('alexaPlatform'); // to enable run as: DEBUG=alexaPlatform OR DEBUG=*

const violetToPlatformTypeMap = {
  'number': 'NUMBER',
  'firstName': 'AMAZON.US_FIRST_NAME',
  'date': 'AMAZON.DATE',
  'time': 'AMAZON.TIME',
  'phoneNumber': 'AMAZON.PhoneNumber',
  'phrase': 'AMAZON.SearchQuery'
};

const violetIDsToAlexaNames = {
  help: 'AMAZON.HelpIntent',
  fallback: 'AMAZON.FallbackIntent',
  stop: 'AMAZON.StopIntent',
  cancel: 'AMAZON.CancelIntent'
}

class AlexaPlatformReq extends PlatformReq {
  constructor(platform, request, response) {
    super(platform, request, response);
  }

  getUserId() {
    return this.request.userId;
  }

  getInputTypes() {
    return alexaAppExt.reqListSlots(this.request);
  }

  getInputType(inputName) {
    return this.request.slot(inputName);
  }

  getSession() {
    return this.request.getSession();
  }

  say(str) {
    this.response.say(str);
  }

  shouldEndSession(flag) {
    this.response.shouldEndSession(flag);
  }
}

// Started as an extremely thin shim that was created to support other platforms
class AlexaPlatform extends PlatformPlugin {
  /**
   * Constructed and returned by Violet when a Voice Script initializes
   */
  constructor(endpoint, violetCfg, convoModel) {
    super(endpoint, violetCfg, convoModel);
    this._app = new alexa.app(this.endpoint);
    if (violetCfg.invocationName)
      this._app.invocationName = violetCfg.invocationName;
  }

  handleRequest(request, response) {
    return this._app.request(request.body).then(resp=>{
      response.send(resp);
    });
  }

  setServerApp(alexaRouter) {
    this._app.express({
      router: alexaRouter,
      checkCert: false,
      debug: true,
    });
  }

  onError(cb) {
    this._app.error = (exception, requ, resp) => {
      console.error('Unexpected Error: ', exception);
      cb(exception.message, new AlexaPlatformReq(this, requ, resp));
    };
  }

  onLaunch(cb) {
    this._app.launch((requ, resp) => {
      return cb(new AlexaPlatformReq(this, requ, resp));
    });
  }

  regIntent(name, params, cb) {
    // translate from Violet types to Platform types
    if (params.inputTypes) {
      params.slots = [];
      Object.keys(params.inputTypes).forEach(k=>{
        if (violetToPlatformTypeMap[params.inputTypes[k]]) {
         params.slots[k] = violetToPlatformTypeMap[params.inputTypes[k]];
       } else {
         params.slots[k] = params.inputTypes[k];
       }
      });
    }
    debug('alexaPlatform: registering: ', name, params);

    this._app.intent(name, params, (requ, resp)=>{
      console.log(`Intent Request - ${name}: ${params.utterances[0]}, ...`);
      return cb(new AlexaPlatformReq(this, requ, resp));
    });

    if (violetIDsToAlexaNames[name]) {
      this.regIntent(violetIDsToAlexaNames[name], params, cb);
    }
  }

  regCustomSlot(type, values) {
    this._app.customSlot(type, values);
  }


}

module.exports = AlexaPlatform;
