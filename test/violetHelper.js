
var requestP = require('request-promise');

const violetUrlBase = 'http://localhost:8080/alexa/'

var violetSrvr, violetUrl;

module.exports.startServer = (appName) => {
  violetUrl = violetUrlBase + appName;
  violetSrvr = require('../lib/violetSrvr.js')('/alexa');
  return violetSrvr.createAndListen(process.env.PORT || 8080);
}

module.exports.initialize = (_violet) => {
  violet = _violet;
  violet.registerIntents();
  violet.setServerApp(violetSrvr.getSvcRouter());
  // violetSrvr.displayScriptInitialized(srvrInstance, violet);
};

module.exports.getIntent = (spokenPhrase) => {
  return requestP(violetUrl + '?utterances').then(function (body) {
    var utterances = body.split('\n').map(u=>{
      var intentSep = u.indexOf(' ');
      return {
        intent: u.substring(0, intentSep),
        utterance: u.substring(intentSep+1)
      }
    });
    // console.log('>>> utterances', utterances);
    var utteranceObj = utterances.find(u=>{return u.utterance.indexOf(spokenPhrase) != -1});
    return utteranceObj.intent;
  });
};

module.exports.sendRequest = (intentName, params) => {
  // console.log(`Request for ${intentName}`);
  var msgBody = templates['IntentRequest'];
  msgBody.request.intent.name = intentName;
  msgBody.request.intent.slots = {};
  if (params) {
    Object.keys(params).forEach(k=>{
      msgBody.request.intent.slots[k] = {value: params[k], name: k};
    });
    // console.log('params: ', msgBody.request.intent.slots);
  }

  // console.log(msgBody);
  var options = { method: 'POST',
    url: violetUrl,
    headers: { 'content-type': 'application/json' },
    json: true,
    body: msgBody
  };

  return requestP(options).then(function (body) {
    // console.log(body);
    var rcvdStr = body.response.outputSpeech.ssml;
    rcvdStr = rcvdStr.replace(/<\/?speak>/g,'');
    return {rcvdStr, body};
  });
};
