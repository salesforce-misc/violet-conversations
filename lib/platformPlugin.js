/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines what is needed from the Platform Plugins (such as Alexa support and
 * Google DialogFlow support). This includes a PlatformPlugin interface as well
 * as an interface for a Request to a Platform (i.e. a wrapper around http
 * request and response).
 *
 * @module conversationEngine
 */
var OutputMgr = require('./outputMgr.js');

/**
 * Class that primarily exists for documents and defines what a platform
 * request needs to support (they are expected to extend this class). A platform
 * request is essentially a wrapper of an http request that comes in from the
 * platform and defines what the ConversationEngine needs from the platform on a
 * per-request basis.
 */
class PlatformReq {
  constructor(platform, request, response) {
    this.platform = platform;
    this.request = request;
    this.response = response;
    this.outputMgr = new OutputMgr(this);
  }

  getUserId() {}

  getInputTypes() {}

  getInputType(inputName) {}

  getSession() {}

  say(str) {}

  shouldEndSession(flag) {}

}

/**
 * Class that primarily exists for documents and defines what a platform
 * plugin needs to support (they are expected to extend this class).
 */
class PlatformPlugin {

  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  getEndpoint() {
    return this.endpoint;
  }

  // hook up platform interfaces to the http router
  setServerApp(violetRouter) {}

  onError(cb) {}

  onLaunch(cb) {}

  // cb is a function with one parameter: PlatformReq
  regIntent(name, params, cb) {}

  regCustomSlot(type, values) {}

}


module.exports.PlatformPlugin = PlatformPlugin;
module.exports.PlatformReq = PlatformReq;
