'use strict';

var AlexaAppServer = require( 'alexa-app-server' );

var server = new AlexaAppServer( {
  app_dir: "apps",            // Location of alexa-app modules
  app_root: "alexa",        // Service root
  httpsEnabled: false,
	port: process.env.PORT || 8080
} );

server.start();
