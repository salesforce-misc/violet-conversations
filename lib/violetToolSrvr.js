/* Copyright (c) 2019-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

var request = require('request');

// the tooling server
var violetSrvr = require('./violetSrvr.js')();

violetSrvr.createAndListen(process.env.PORT || 8080);

var appRouter = violetSrvr.getAppRouter('');

// process.argv.forEach(function (val, index, array) {
//   console.log(index + ': ' + val);
// });
var skillUrl = 'http://localhost:3000';
if (process.argv.length > 2) skillUrl = process.argv[2];
console.log('Proxying to skill server at: ' + skillUrl);

// install a proxy to the the skill server
appRouter.all('/alexa', (req, res)=>{
  var url = skillUrl + req.url;
  console.log(`proxying: ${req.url}-->${url}`);
  req.pipe(request(url)).pipe(res);
});

violetSrvr.installTooling(appRouter, {getAppName: ()=>''});
