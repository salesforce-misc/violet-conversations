/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Helps launch an express based server to host the rest of the voice scripts.
 * @module violet-conversations/violetSrvr
 */

var path = require('path');
var express = require('express');
var http = require('http');

var violet = require('./violet.js').server();

module.exports = (prefix)=>{
  var expressApp = express();
  var alexaRouter = express.Router();
  var appNames = [];
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.join(__dirname, '..', 'tester-views'));
  expressApp.use(express.static(path.join(__dirname, '..', 'tester-views')));
  if (prefix)
    expressApp.use(prefix, alexaRouter);

  var srvrInstance = null;

  var violetSrvr = {
    _getWebApp: ()=>{
      return expressApp;
    },

    listScriptsAt: (path='/')=>{
      expressApp.get(path, (req, res)=>{
        out = 'Loaded Voice Scripts:<br>';
        var host = srvrInstance.address().address;
        var port = srvrInstance.address().port;
        if (host=='::') host='localhost'
        appNames.forEach((n)=>{
          out += `&nbsp;&nbsp;<a href="${prefix}/${n}">${n}</a><br>`;
        });
        res.send(out);
      });
    },

    /** Core Method that launches the web server to listen for incoming requests
     * @method createAndListen
     */
    createAndListen: (port)=>{
      srvrInstance = http.createServer(expressApp);
      srvrInstance.listen(port);
      return srvrInstance;
    },

    getAlexaRouter: ()=>{
      return alexaRouter;
    },

    displayScriptInitialized: (srvrInstance, script)=>{
      appNames.push(script.app.name);
      var host = srvrInstance.address().address;
      var port = srvrInstance.address().port;
      if (host=='::') host='localhost'
      console.log(`>>> Script running at: http://${host}:${port}${prefix}/${script.app.name}`);
    },

    /** Loads the Voice Scripts
     * @method loadScript
     */
    loadScript: (scriptPath, name)=>{
      scriptPath = path.join(path.dirname(module.parent.filename), scriptPath);
      var script = violet.loadScript(scriptPath, name, alexaRouter);
      violetSrvr.displayScriptInitialized(srvrInstance, script);
      return script;
    }

  };

  return violetSrvr;

};
