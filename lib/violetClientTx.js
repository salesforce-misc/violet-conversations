
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
    loadScript: (path)=>{
      var script = violetSrvr.loadScript(path);
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
    broadcast = broadcaster;
  };
  // reimplement _sayFinish to also broadcast
  var oldSayFinish = violet.__get_sayFinish();
  violet.__set_sayFinish((resp, response, potResponses) => {
    console.log('clientTx - _sayFinish called');
    oldSayFinish(resp, response, potResponses);
    console.log('Broadcasting: ' + violet.__getoutBuffer());
    broadcast({
      response: violet.__getoutBuffer()
    });
  });
  // reimplement _setAlert to also broadcast
  var oldSetAlert = violet.__get_setAlert;
  violet.__set_setAlert((cause) => {
    oldSetAlert(cause);
    broadcast({alert: fAlert.length > 0});
  });

};
