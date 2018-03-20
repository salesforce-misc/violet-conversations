/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const alexa = require('alexa-app');
const alexaAppExt = require('./alexaAppExt.js');

// Currently an extremely thin shim that needs to grow to support other platforms
class AlexaPlatform {
  /**
   * Constructed and returned by Violet when a Voice Script initializes
   */
  constructor(appName) {
    this.appName = appName;
    this._app = new alexa.app(appName);
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
    console.log('registering: ', name, params);
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
