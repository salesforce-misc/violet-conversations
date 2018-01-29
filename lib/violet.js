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

var co = require('co');
var path = require('path');
var Promise = require('bluebird');

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
    loadScript: (contextDir, scriptPath, name, alexaRouter) => {
      appName = name;
      var script = require(path.join(contextDir, scriptPath));
      script.registerIntents();
      script.setServerApp(alexaRouter);
      return script;
    },
    loadMultipleScripts: (contextDir, scriptPaths, name, alexaRouter) => {
      appName = name;
      var script = null;
      scriptPaths.forEach(p=>{
        // all instances of script below should be identical
        script = require(path.join(contextDir, p));
      })
      script.registerIntents();
      script.setServerApp(alexaRouter);
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
 * @param appName - (optional) App name to attach this script to. Not setting this
 * parameter will mean that Violet will attach this script to the previous App. It is
 * recommended to not set this parameter (in the script) but to define it
 * in the parent where the script is being loaded.
 * @returns {ConversationEngine} - The primary
 * {@link module:conversationEngine~ConversationEngine ConversationEngine} that scripts will be defining
 * intents, goals, etc against.
 */
module.exports.script = function(_appName) {
  if (appName == null && _appName != null) appName = _appName;
  if (appName == null) {
    // allow scripts to be launched without the server and instead just initialize after 1s
    var violetSrvr = require('./violetSrvr.js')('/alexa');
    var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);
    appName = 'local'
    setTimeout(()=>{ // run after the full script loads
      violet.registerIntents();
      violet.setServerApp(violetSrvr.getSvcRouter());
      violetSrvr.displayScriptInitialized(srvrInstance, violet);
    }, 1*1000);
  }
  if (appToVioletConversationEngines[appName]) return appToVioletConversationEngines[appName];

  var violet = new ConversationEngine(appName);

  violet._app.error = function( exception, requ, resp ) {
    console.log(exception);
    console.log(requ);
    console.log(resp);
    violet.outputMgr.sendFromQueue(resp, null, 'Sorry an error occurred ' + exception.message);
  };

  violet._app.launch( function( requ, resp ) {
    return _processIntent(requ, resp, null, (response)=>{
      // TODO: needs to be re-enabled
      // if (fAlert.length > 0) {
      //   response.say('You have an alert.');
      //   console.log('Alerts: ', fAlert);
      //   console.log('Goals: ', goalsToMeet);
      //   console.log('User Info: ', requ.userId);
      //   return;
      // }
      response.say(['Yes. How can I help?', 'Hey. Need me?', 'Yup. I am here.']);
    });
  });

  violet.respondTo({name: 'closeSession', expecting: ["I am good", "No I am good", "Thanks", "Thank you"], resolve: (response) => { response.clearAllGoals(); response.endConversation(); }});

  appToVioletConversationEngines[appName] = violet;
  return violet;
};
