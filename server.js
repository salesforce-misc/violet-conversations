'use strict';

var path = require('path');
var express = require('express');
var http = require('http');
var expressApp = express();
expressApp.set('view engine', 'ejs');
expressApp.set('views', path.join(__dirname, 'tester-views'));
expressApp.use(express.static(path.join(__dirname, 'tester-views')));
var alexaRouter = express.Router();
expressApp.use('/alexa', alexaRouter);

var srvrInstance = http.createServer(expressApp);
srvrInstance.listen(process.env.PORT || 8080);

var script = require("./scripts/index.js");
script.setServerApp(express, alexaRouter);

var SocketServer = require('ws').Server;

var wss = new SocketServer({ server: srvrInstance  });

console.log('Waiting for requests...');

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
});

function broadcast(jsonObj) {
  console.log('Broadcasting...', jsonObj);
  wss.clients.forEach((client) => {
    client.send(JSON.stringify(jsonObj));
  });
}

script.setBroadcaster(broadcast);
