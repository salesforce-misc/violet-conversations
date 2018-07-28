/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Class that primarily exists for documents and defines what a platform
 * plugin needs to support (they are expected to extend this class)
 */
class PlatformPlugin {

  constructor(appName) {
    this.appName = appName;
  }

  getAppName() {
    return this.appName;
  }

  setServerApp(violetRouter) {}

  onError(cb) {}

  onLaunch(cb) {}

  regIntent(name, params, cb) {}

  regCustomSlot(type, values) {}

  getSlotsFromReq(requ) {}


}

module.exports = PlatformPlugin;
