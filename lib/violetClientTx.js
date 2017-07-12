
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
  if (violet.createAndListen) return createWSSAndListenForClient(violet, srvrInstance);

  // extend violet
  // setup basic notification functionality
  violet.broadcast = () => {console.log('Broadcasting not initialized...');}
  violet.setBroadcaster = (broadcaster) => {
    broadcast = broadcaster;
  };
  // reimplement _sayFinish to also broadcast
  var oldSayFinish = violet._sayFinish;
  violet._sayFinish = (resp, response, potResponses) => {
    oldSayFinish(resp, response, potResponses);
    console.log('Broadcasting: ' + violet.outBuffer);
    broadcast({
      response: violet.outBuffer
    });
  };
  // reimplement _setAlert to also broadcast
  var oldSetAlert = violet._setAlert;
  violet._setAlert = (cause) => {
    oldSetAlert(cause);
    broadcast({alert: fAlert.length > 0});
  };

};
