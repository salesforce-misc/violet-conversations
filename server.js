'use strict';

var violetSrvr = require('./lib/violetSrvr.js')('/alexa');
var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);

violetSrvr = require('./lib/violetClientTx.js')(violetSrvr, srvrInstance);

// violetSrvr.loadScript('../examples/demo1.js');
// violetSrvr.loadScript('../examples/tutorial.js');
// violetSrvr.loadScript('../scripts/sfxi-fins.js');
// violetSrvr.loadScript('../scripts/hls-diabetes.js');
// violetSrvr.loadScript('../scripts/sf-leadsAndOpportunities.js');
violetSrvr.loadScript('../scripts/vto-gina.js');
// violetSrvr.loadScript('../scripts/sf-cases-customer.js');
// violetSrvr.loadScript('../scripts/sf-cases-employee.js');
// violetSrvr.loadScript('../scripts/sf-knowledge-base.js');


console.log('Waiting for requests...');
