/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Launches and supports an Express.js based server to host the voice scripts.
 *
 * @module violetSrvr
 */

var path = require('path');
var express = require('express');
var http = require('http');

var violet = require('./violet.js').server();

const assetsDir = path.join(__dirname, '..', 'web-tooling-views');

/**
 * Initializes the server.
 *
 * @param prefix - where the violet server endpoints will be, for example, '/violet'
 */
module.exports = (prefix)=>{
  var expressApp = express();
  var srvrRouter = expressApp;
  var appNames = [];
  expressApp.use(express.static(assetsDir));
  if (prefix) {
    srvrRouter = express.Router();
    expressApp.use(prefix, srvrRouter);
  } else {
    prefix = ''; // so that it can be used directly in urls
  }

  var srvrInstance = null;

  var violetSrvr = {
    _getWebApp: ()=>{
      return expressApp;
    },

    /**
     * Adds a listing of the apps on the server
     *
     * @param [path=/] - where the list of apps should be listed
     */
    listAppsAt: (path='/')=>{
      expressApp.get(path, (req, res)=>{
        out = 'Loaded Voice Apps:<br>';
        var host = srvrInstance.address().address;
        var port = srvrInstance.address().port;
        if (host=='::') host='localhost'
        appNames.forEach((n)=>{
          out += `&nbsp;&nbsp;<a href="${prefix}/${n}">${n}</a><br>`;
        });
        res.send(out);
      });
    },

    /**
     * Core Method that launches the web server to listen for incoming requests
     *
     * @method createAndListen
     */
    createAndListen: (port)=>{
      srvrInstance = http.createServer(expressApp);
      srvrInstance.listen(port);
      return srvrInstance;
    },

    // deprecated - use getAppRouter
    getSvcRouter: ()=>{
      return srvrRouter;
    },

    getAppRouter: (appName)=>{
      if (appName == '') return srvrRouter;

      var appRouter = express.Router();
      srvrRouter.use(`/${appName}`, appRouter);
      return appRouter;
    },

    getAppUrl: (appName)=>{
      appNames.push(appName);
      if (srvrInstance.address() == null) return 'errorSrvrAddress==NULL';
      var host = srvrInstance.address().address;
      var port = srvrInstance.address().port;
      if (host=='::') host='localhost'
      return `http://${host}:${port}${prefix}/${appName}`;
    },

    displayScriptInitialized: (script)=>{
      console.log(`>>> Script running at: ${violetSrvr.getAppUrl(script.getAppName())}`);
    },

    installTooling: (appRouter, script)=>{
      appRouter.get('/', (req, res)=>{
        res.sendFile("tool.html", {"root": assetsDir});
      });
      violetSrvr.displayScriptInitialized(script);
    },

    /**
     * Loads Voice Scripts. Loading involves doing a require on the scripts,
     * registering the scripts intents, and connecting it to the express router.
     *
     * @param scriptPath - path to the script to be loaded (multiple scripts
     * can be provided one after the other seperated by commas)
     * @param name - app name for the script to be loaded under
     * @method loadScript
     */
    loadScript: (scriptPath, appName)=>{
      var appRouter = express.Router();
      srvrRouter.use(`/${appName}`, appRouter);

      var script = null;
      if (scriptPath.indexOf(',')!==-1) {
        scriptPath = scriptPath.split(',');
      }
      if (Array.isArray(scriptPath)) {
        script = violet.loadMultipleScripts(path.dirname(module.parent.filename), scriptPath, appName, appRouter);
      } else {
        script = violet.loadScript(path.dirname(module.parent.filename), scriptPath, appName, appRouter);
      }
      violetSrvr.installTooling(appRouter, script);
      return script;
    }


  };

  return violetSrvr;

};
