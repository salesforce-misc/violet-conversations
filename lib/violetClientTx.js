/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

// This plugin has been deprecated

var ws = require('ws');

var createWSSAndListenForClient = (violetSrvr, srvrInstance)=>{
  var wss = new ws.Server({ server: srvrInstance });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
  });

  var broadcast = (jsonObj) => {
    console.log('Broadcasting...', jsonObj);
    wss.clients.forEach((client) => {
      client.send(JSON.stringify(jsonObj));
    });
  }

  // return an overloaded violetSrvr object where we link the broadcaster to the target script
  return {
    loadScript: (path, name)=>{
      var script = violetSrvr.loadScript(path, name);
      if (script.setBroadcaster) script.setBroadcaster(broadcast);
    }
  };
};

module.exports = (violet, srvrInstance) => {
  if (violet.createAndListen) {
    console.log('clientTx - server initialization');
    return createWSSAndListenForClient(violet, srvrInstance);
  }

  // extend violet
  console.log('clientTx - conversation initialization');

  // setup basic notification functionality
  violet.broadcast = () => {console.log('Broadcasting not initialized...');}
  violet.setBroadcaster = (broadcaster) => {
    violet.broadcast = broadcaster;
  };
  // reimplement _sendFromQueue to also broadcast
  var oldSendFromQueue = violet.outputMgr.sendFromQueue;
  violet.outputMgr.sendFromQueue = (spokenRate, response, potResponses) => {
    var outStr = oldSendFromQueue.call(violet.outputMgr, spokenRate, response, potResponses);
    if (!outStr) return;
    violet.broadcast({
      response: outStr
    });
  };

  var fAlert = [];

  violet.setAlert = function(cause) {
    fAlert.push(cause);
    violet.broadcast({alert: fAlert.length > 0});
  };
  violet.clearAlert = function(cause) {
    var ndx = fAlert.indexOf(cause);
    if (ndx > 0) fAlert.splice(ndx, 1);
  };
  violet.respondTo({name: 'setAlert', expecting: ["set alert"], resolve: (response) => {response.setAlert('intent'); }});
  violet.respondTo({name: 'unsetAlert', expecting: ["disable alert", "clear alert"], resolve: (response) => {response.clearAlert('intent'); }});


};
