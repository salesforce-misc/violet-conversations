/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const path = require('path');
const express = require('express');
const zip = require('express-easy-zip');
const bodyParser = require('body-parser');
// const DialogflowApp = require('actions-on-google').DialogflowApp;
const dialogflowClient = require('dialogflow-fulfillment').WebhookClient;
const PlatformReq = require('./platformPlugin.js').PlatformReq;
const PlatformPlugin = require('./platformPlugin.js').PlatformPlugin;


// v1 sdk documentation: https://developers.google.com/actions/reference/nodejs/DialogflowApp
// v2 sdk documentation: https://github.com/dialogflow/dialogflow-fulfillment-nodejs/blob/master/docs/WebhookClient.md
// TODO: expose goals as context

const violetToPlatformTypeMap = {
  'number': '@sys.number',
  'firstName': '@sys.given-name',
  'date': '@sys.date',
  'time': '@sys.time',
  'phoneNumber': '@sys.phone-number',
  'phrase': '@sys.any'
};

function guessSamples(violetType) {
  switch (violetType) {
    case 'number':
      return Math.floor(Math.random() * 100);
    case 'firstName':
      return "John";
    case 'date':
      return "11 October";
    case 'time':
      return "5:20 pm";
    case 'phoneNumber':
      return "(123) 456 7890";
    case 'phrase':
      return "phrase sample";
    default:
      console.log(`ERR - googlePlatform: ${violetType} not supported`)
      return 'UNKNOWN TYPE'
  }
}


function addFile(zipFiles, name, jsonBody) {
  zipFiles.push({
    name: name,
    content: JSON.stringify(jsonBody, null, 2)
  })
}
function genConfigMeta(zipFiles, req) {
  addFile(zipFiles, `package.json`, {"version": "1.0.0"});
  // spec: https://dialogflow.com/docs/reference/agent-json-fields
  var svcUrl = req.protocol + '://' + req.headers.host + req.originalUrl
  svcUrl = svcUrl.replace('/config','')

  addFile(zipFiles, `agent.json`, {
      // "description": "",
      webhook: {
        url: svcUrl,
        available: true
      },
      language: "en"
    });
};
function genConfigIntents(zipFiles, googlePlatform) {
  Object.keys(googlePlatform.intentParams).forEach((intentName)=>{
    // spec: https://dialogflow.com/docs/reference/agent/intents
    var intentInfo = {
      name: intentName,
      auto: true, // <-- ml enabled
      webhookUsed: true
    };
    var inputTypes = googlePlatform.intentParams[intentName].inputTypes;
    if (inputTypes) {
      intentInfo.responses = [{
        parameters: []
      }];
      Object.keys(inputTypes).forEach((inputName)=>{
        intentInfo.responses[0].parameters.push({
            isList: false,
            name: inputName,
            value: "$" + inputName,
            dataType: violetToPlatformTypeMap[inputTypes[inputName]]
        });
      });
    }
    addFile(zipFiles, `intents${path.sep}${intentName}.json`, intentInfo)

    var gUtterances = [];
    googlePlatform.intentParams[intentName].utterances.forEach((utterance)=>{
      var gUtteranceInfo = {
        data: [],
        isTemplate: false,
        count: 0,
      };
      var utteranceTextMaxLen = 1;
      utterance.split(/[{}]/).forEach((u,ndx)=>{
        if (u.length == 0) return;
        var fVar = (ndx%2 == 0) ? false : true;
        var guData = {userDefined: false}
        if (fVar) {
          var nameMarker = u.lastIndexOf('|');

          // set: alias
          if (nameMarker == -1)
            guData.alias = u;
          else
            guData.alias = u.substr(nameMarker+1);

          // set: meta
          guData.meta = violetToPlatformTypeMap[inputTypes[guData.alias]]

          // set: text
          if (u.startsWith('-|')) {
            guData.text = [guessSamples(inputTypes[guData.alias])];
          } else {
            guData.text = u.substring(0, nameMarker).split('|');
            utteranceTextMaxLen = Math.max(utteranceTextMaxLen, guData.text.length);
          }
        } else {
          guData.text = [u];
        }
        gUtteranceInfo.data.push(guData);
      });
      // split up utterances when there are multiple samples provided
      for (var utteranceNdx = 0; utteranceNdx < utteranceTextMaxLen; utteranceNdx++) {
        var gUtteranceInfoInst = {
          isTemplate: false,
          count: 0,
        };
        gUtteranceInfoInst.data = gUtteranceInfo.data.map(guData=>{
          // console.log(`  .`);
          var guDataInst = Object.assign({}, guData);
          if (utteranceNdx<guData.text.length)
            guDataInst.text = guData.text[utteranceNdx];
          else
            guDataInst.text = guData.text[0];
          return guDataInst;
        });

        gUtterances.push(gUtteranceInfoInst);
      }

    });

    addFile(zipFiles, `intents${path.sep}${intentName}_usersays_en.json`, gUtterances)
  });
}

class GooglePlatformReq extends PlatformReq {

  constructor(platform, request, response) {
    super(platform, request, response);

    this.shouldEndSession = true;

    this.sessionStore = {};
    var sessionContext = this.platform.app.getContext('session');
    if (sessionContext) {
      sessionStore = sessionContext.parameters;
      if (!sessionStore) sessionStore = {};
    }
    Object.keys(this.platform.app.parameters).forEach(pName=>{
      sessionStore[pName] = this.platform.app.parameters[pName];
    });
  }

  getUserId() {
    // TODO: is this correct, i.e. for Google (it works for Alexa)
    return this.request.userId;
  }

  getInputTypes() {
    return Object.keys(this.platform.app.parameters);
  }

  getInputType(inputName) {
    return this.platform.app.parameters[inputName];
  }

  getSession() {
    return {
      getAttributes: () => {
        return this.sessionStore;
      },
      get: (varStr) => {
        return this.sessionStore[varStr];
      },
      set: (varStr, val) => {
        this.sessionStore[varStr] = val;
      }
    };
  }

  say(str) {
    if (shouldEndSession)
      platform._tell(str);
    else
      platform._ask(str);
  }

  shouldEndSession(flag) {
    this.shouldEndSession = flag;
  }
}

class GooglePlatform extends PlatformPlugin {

  _tell(str) {
    this.app.add(str);
  }

  _ask(str) {
    let conv = this.app.conv();
    conv.ask(str);
    this.app.add(conv);
  }

  constructor(endpoint) {
    super(endpoint);
    this.intentHandlers = {};
    this.intentParams = {};
    this.customSlots = {};
    this.intentHandlers = {
      'input.welcome': () => {
        this._tell('Hello, Welcome to my Dialogflow agent!');
      },
      'default': () => {
        this._tell('The default handler for unknown or undefined actions got triggered!');
      }
    };
  }

  setServerApp(violetRouter) {
    const platform = this;
    violetRouter.use(zip())

    violetRouter.use(bodyParser.json({ type: 'application/json' }));
    // violetRouter.get('/', function (request, response) {
    //   response.send('Go to /config for generating Dialogflow import data');
    // });
    violetRouter.get('/googleConfig', function (request, response) {
      var zipFiles = [];
      genConfigMeta(zipFiles, request);
      genConfigIntents(zipFiles, platform);
      var configName = platform.appName;
      if (!configName) configName = 'config'
      response.zip({
        filename: configName + '.zip',
        files: zipFiles
      });
    });
    violetRouter.post('/' + this.endpoint, function (request, response) {
      try {
        // console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
        console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

        platform.app = new dialogflowClient({request: request, response: response});
        console.log(platform.app.parameters)
        let intentName = platform.app.intent;
        if (!platform.intentHandlers[intentName]) {
          intentName = 'default';
        }
        console.log(`Received request for: ${intentName}`)
        let result = platform.intentHandlers[intentName](new GooglePlatformReq(platform, request, response));
        Promise.resolve(result).then(()=>{
          platform.app.setContext({name: 'session', lifespan: 100, parameters: sessionStore});
          platform.app.send_();
        })
      } catch (e) {
        console.log('Caught Error: ', e);
        response.end();
      }
    });
  }

  onError(cb) {
    this.errorCB = cb;
  }

  onLaunch(cb) {
    this.launchCB = cb;
  }

  regIntent(name, params, cb) {
    console.log('googlPlatform: registering: ', name, params);
    this.intentHandlers[name] = cb;
    this.intentParams[name] = params;
  }

  regCustomSlot(type, values) {
    this.customSlots[type] = values;
  }

}

module.exports = GooglePlatform;
