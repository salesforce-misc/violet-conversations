/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Class that primarily exists for documents and defines what a platform
 * plugin needs to support (they are expected to extend this class)
 */
class PlatformPlugin {

  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  getEndpoint() {
    return this.endpoint;
  }

  setServerApp(violetRouter) {}

  onError(cb) {}

  onLaunch(cb) {}

  // cb is a function with parameters: (req, resp)
  regIntent(name, params, cb) {}

  regCustomSlot(type, values) {}

  getSlotsFromReq(requ) {}

}

module.exports = PlatformPlugin;
