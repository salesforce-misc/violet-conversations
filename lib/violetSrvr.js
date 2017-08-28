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
    listScriptsAt: (path='/')=>{
      expressApp.get(path, (req, res)=>{
        out = 'Apps:<br>';
        var host = srvrInstance.address().address;
        var port = srvrInstance.address().port;
        if (host=='::') host='localhost'
        appNames.forEach((n)=>{
          out += `&nbsp;&nbsp;<a href="${prefix}/${n}">${n}</a><br>`;
        });
        res.send(out);
      });
    },

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

    loadScript: (path, name)=>{
      var script = violet.loadScript(path, name, alexaRouter);
      violetSrvr.displayScriptInitialized(srvrInstance, script);
      return script;
    }

  };

  return violetSrvr;

};
