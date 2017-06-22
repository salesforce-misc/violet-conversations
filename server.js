'use strict';

var AlexaAppServer = require( 'alexa-app-server' );

var server = new AlexaAppServer( {
  app_dir: "apps",            // Location of alexa-app modules
  app_root: "alexa",        // Service root
  httpsEnabled: false,
	port: process.env.PORT || 8080
} );

var alexaSrvrInstance = server.start();

var SocketServer = require('ws').Server;

var srvrInstance = alexaSrvrInstance.instance; // should check httpsInstance if this is not set
var wss = new SocketServer({ server: srvrInstance  });

// console.log('alexaSrvrInstance.apps: ', alexaSrvrInstance.apps);
Object.keys(alexaSrvrInstance.apps).forEach((appName) => {alexaSrvrInstance.apps[appName].exports.setBroadcaster(broadcast);});
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
