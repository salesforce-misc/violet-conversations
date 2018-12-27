/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * This is the Core Violet Module - it returns the conversation engine that
 * voice scripts can take advantage of.
 * <br><br>
 * Voice scripts can be grouped into a single app and multiple apps can be made
 * available on a single server. Currently Violet only supports registering
 * intents for Amazon's Alexa Skills Kit.
 *
 * @module violet
 */

var path = require('path');

var ConversationEngine = require('./conversationEngine.js');


///////////
///////////

var appName = null; // set when loading a set of scripts
var appToVioletConversationEngines = {};

/**
 * Assists with the loading of scripts by the Violet Server. Primarily enables
 * apps to have multiple scripts.
 */
module.exports.server = function() {
  return {
    loadScript: (contextDir, scriptPath, name, svcRouter) => {
      appName = name;
      require(path.join(contextDir, scriptPath));
      const script = module.exports.script();
      script.registerIntents();
      script.platforms.setServerApp(svcRouter);
      return script;
    },
    loadMultipleScripts: (contextDir, scriptPaths, name, svcRouter) => {
      appName = name;
      scriptPaths.forEach(p=>{
        // all instances of script below should be identical
        require(path.join(contextDir, p));
      })
      const script = module.exports.script();
      script.registerIntents();
      script.platforms.setServerApp(svcRouter);
      return script;
    }
  };
}
/**
 * Violet intentionally groups scripts into an app. The method clears any
 * previous script information for the specified app. This
 * method is primarily used by the test suite as it uses the same app repeatedly.
 *
 * @param appName - App name to reset script information.
 */
module.exports.clearAppInfo = function(_appName) {
  delete appToVioletConversationEngines[_appName];
};
/**
 * Instantiates and returns the Violet Conversation Engine. Most violet scripts
 * start by making this call.
 *
 * @param appName - (optional) Essentially a unique id for the script. Having a
 * shared id between two scripts will mean that they add to the same
 * ConversationEngine object. Not setting this parameter will mean that Violet
 * will attach this script to the previous App. It is
 * recommended to not set this parameter (in the script) but to define it
 * in the parent where the script is being loaded.
 * @param {Object[]} platforms - (optional) Voice Platforms to support. Each
 * item in the array is expected to have keys called 'endpoint' and 'platform'.
 * Not setting this parameter will mean that Violet will support both Alexa (at
 * /alexa) and Google (at /google).
 * @returns {ConversationEngine} - The primary
 * {@link module:conversationEngine~ConversationEngine ConversationEngine} that scripts will be defining
 * intents, goals, etc against.
 */
module.exports.script = function(_appName, platforms) {
  if (!platforms) {
    platforms = [
      {endpoint: 'alexa', platform: require('./alexaPlatform.js')},
      {endpoint: 'google', platform: require('./googlePlatform.js')},
    ];
  }
  if (appName == null && _appName != null) appName = _appName;
  if (appName == null) {
    // allow scripts to be launched without the server and instead just initialize after 1s
    var violetSrvr = require('./violetSrvr.js')();
    violetSrvr.createAndListen(process.env.PORT || 8080);
    appName = ''
    setTimeout(()=>{ // run after the full script loads
      violet.registerIntents();
      var appRouter = violetSrvr.getAppRouter(appName);
      violet.platforms.setServerApp(appRouter);
      violetSrvr.installTooling(appRouter, violet);
    }, 1*1000);
  }
  if (appToVioletConversationEngines[appName]) return appToVioletConversationEngines[appName];

  var violet = new ConversationEngine(appName, platforms);

  appToVioletConversationEngines[appName] = violet;
  return violet;
};
