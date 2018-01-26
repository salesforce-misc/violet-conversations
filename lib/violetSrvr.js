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

/**
 * Initializes the server.
 *
 * @param prefix - where the violet endpoints will be, for example, '/alexa'
 */
module.exports = (prefix)=>{
  var expressApp = express();
  var svcRouter = express.Router();
  var appNames = [];
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.join(__dirname, '..', 'tester-views'));
  expressApp.use(express.static(path.join(__dirname, '..', 'tester-views')));
  if (prefix)
    expressApp.use(prefix, svcRouter);

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

    getSvcRouter: ()=>{
      return svcRouter;
    },

    displayScriptInitialized: (srvrInstance, script)=>{
      appNames.push(script._app.name);
      var host = srvrInstance.address().address;
      var port = srvrInstance.address().port;
      if (host=='::') host='localhost'
      console.log(`>>> Script running at: http://${host}:${port}${prefix}/${script._app.name}`);
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
    loadScript: (scriptPath, name)=>{
      var script = null;
      if (scriptPath.indexOf(',')!==-1) {
        scriptPath = scriptPath.split(',');
      }
      if (Array.isArray(scriptPath)) {
        script = violet.loadMultipleScripts(path.dirname(module.parent.filename), scriptPath, name, svcRouter);
      } else {
        script = violet.loadScript(path.dirname(module.parent.filename), scriptPath, name, svcRouter);
      }
      violetSrvr.displayScriptInitialized(srvrInstance, script);
      return script;
    }


  };

  return violetSrvr;

};
