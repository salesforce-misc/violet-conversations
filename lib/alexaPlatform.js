/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const alexa = require('alexa-app');
const alexaAppExt = require('./alexaAppExt.js');
const PlatformPlugin = require('./platformPlugin.js');

const violetToPlatformTypeMap = {
  'number': 'NUMBER',
  'firstName': 'AMAZON.US_FIRST_NAME',
  'date': 'AMAZON.DATE',
  'time': 'AMAZON.TIME',
  'phoneNumber': 'AMAZON.PhoneNumber',
  'phrase': 'AMAZON.SearchQuery'
};


// Started as an extremely thin shim that was created to support other platforms
class AlexaPlatform extends PlatformPlugin {
  /**
   * Constructed and returned by Violet when a Voice Script initializes
   */
  constructor(endpoint) {
    super(endpoint);
    this._app = new alexa.app(this.endpoint);
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
      console.log(exception);
      cb(exception.message, requ, resp)
    };
  }

  onLaunch(cb) {
    this._app.launch((requ, resp) => {
      return cb(requ, resp);
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
    console.log('alexaPlatform: registering: ', name, params);
    this._app.intent(name, params, (requ, resp)=>{
      console.log(`Intent Request - ${name}: ${params.utterances[0]}, ...`);
      return cb(requ, resp);
    });
  }

  regCustomSlot(type, values) {
    this._app.customSlot(type, values);
  }

  getSlotsFromReq(requ) {
    return alexaAppExt.reqListSlots(requ)
  }


}

module.exports = AlexaPlatform;
