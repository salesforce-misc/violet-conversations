var path = require('path');
var express = require('express');
var http = require('http');

module.exports = (prefix)=>{
  var expressApp = express();
  var alexaRouter = express.Router();
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', path.join(__dirname, '..', 'tester-views'));
  expressApp.use(express.static(path.join(__dirname, '..', 'tester-views')));
  if (prefix)
    expressApp.use(prefix, alexaRouter);

  return {
    createAndListen: (port)=>{
      var srvrInstance = http.createServer(expressApp);
      srvrInstance.listen(process.env.PORT || 8080);

      return srvrInstance;
    },

    loadScript: (path)=>{
      var script = require(path);
      script.registerIntents();
      script.setServerApp(express, alexaRouter);
      return script;
    }

  };

};
