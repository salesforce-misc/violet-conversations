'use strict';

var violetSrvr = require('./lib/violetSrvr.js')('/alexa');
var srvrInstance = violetSrvr.createAndListen(process.env.PORT || 8080);

violetSrvr = require('./lib/violetClientTx.js')(violetSrvr, srvrInstance);

// violetSrvr.loadScript('./examples/demo1.js');
// violetSrvr.loadScript('./examples/tutorial.js');
// violetSrvr.loadScript('./scripts/fins.js');
// violetSrvr.loadScript('./scripts/hls-diabetes.js');
// violetSrvr.loadScript('./scripts/leadsAndOpportunities.js');
// violetSrvr.loadScript('./scripts/cases-customer.js');
// violetSrvr.loadScript('./scripts/cases-employee.js');
violetSrvr.loadScript('../scripts/knowledge-base.js');


console.log('Waiting for requests...');
