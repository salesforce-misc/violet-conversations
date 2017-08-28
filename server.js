'use strict';

var violetSrvr = require('./lib/violetSrvr.js')('/alexa');
violetSrvr.listScriptsAt('/');
var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);

violetSrvr = require('./lib/violetClientTx.js')(violetSrvr, srvrInstance);

// violetSrvr.loadScript('../examples/demo1.js', 'einstein');
// violetSrvr.loadScript('../examples/tutorial.js', 'einstein');
// violetSrvr.loadScript('../scripts/sfxi-fins.js', 'einstein');
// violetSrvr.loadScript('../scripts/hls-diabetes.js', 'hls');
// violetSrvr.loadScript('../scripts/sf-cases-customer.js', 'einstein');
// violetSrvr.loadScript('../scripts/sf-cases-employee.js', 'einstein');
// violetSrvr.loadScript('../scripts/sf-knowledge-base.js', 'einstein');
// violetSrvr.loadScript('../scripts/sf-VF-VTO.js', 'einstein');
violetSrvr.loadScript(process.env.SCRIPT_NAME || '../scripts/sf-leadsAndOpportunities.js', 'einstein');


console.log('Waiting for requests...');
