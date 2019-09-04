'use strict';

var violetSrvr = require('./lib/violetSrvr')();
violetSrvr.listAppsAt('/');
var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);

violetSrvr.loadScript('testScripts/calculator.js', 'calculator');
violetSrvr.loadScript('testScripts/echo.js', 'echo');


console.log('Waiting for requests...');
