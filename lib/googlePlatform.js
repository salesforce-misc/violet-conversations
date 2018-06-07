/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const path = require('path');
const express = require('express');
const zip = require('express-easy-zip');
const bodyParser = require('body-parser');
const DialogflowApp = require('actions-on-google').DialogflowApp;

// TODO:
// - take advantage of DialogFlowApp.setContext - https://developers.google.com/actions/reference/nodejs/DialogflowApp#setContext


const violetToPlatformTypeMap = {
  'number': '@sys.number'
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
        url: req.protocol + '://' + req.get('Host') + req.url,
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
    var slots = googlePlatform.intentParams[intentName].slots;
    if (slots) {
      intentInfo.responses = [{
        parameters: []
      }];
      Object.keys(slots).forEach((slotName)=>{
        intentInfo.responses[0].parameters.push({
            isList: false,
            name: slotName,
            value: "$" + slotName,
            dataType: violetToPlatformTypeMap[slots[slotName]]
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
      utterance.split(/[{}]/).forEach((u,ndx)=>{
        if (u.length == 0) return;
        var fVar = (ndx%2 == 0) ? false : true;
        var guData = {userDefined: false}
        if (fVar) {
          var nameMarker = u.indexOf('|');

          // set: alias
          if (nameMarker == -1)
            guData.alias = u;
          else
            guData.alias = u.substr(nameMarker+1);

          // set: meta
          guData.meta = violetToPlatformTypeMap[slots[guData.alias]]

          // set: text
          if (u.startsWith('-|')) {
            guData.text = guessSamples(slots[guData.alias]);
          } else {
            guData.text = u.substring(0, nameMarker);
          }
        } else {
          guData.text = u;
        }
        gUtteranceInfo.data.push(guData);
      });
      gUtterances.push(gUtteranceInfo);
    });

    addFile(zipFiles, `intents${path.sep}${intentName}_usersays_en.json`, gUtterances)
  });
}

class GooglePlatform {

  constructor(appName) {
    this.appName = appName;
    this.intentHandlers = {};
    this.intentParams = {};
    this.customSlots = {};
    this.intentHandlers = {
      'input.welcome': () => {
        this.app.ask('Hello, Welcome to my Dialogflow agent!');
      },
      'default': () => {
        this.app.ask('The default handler for unknown or undefined actions got triggered!');
      }
    };
  }

  getAppName() {
    return this.appName;
  }

  setServerApp(violetRouter) {
    const platform = this;
    violetRouter.use(zip())

    violetRouter.use(bodyParser.json({ type: 'application/json' }));
    violetRouter.get('/', function (request, response) {
      response.send('Go to /config for generating Dialogflow import data');
    });
    violetRouter.get('/config', function (request, response) {
      var zipFiles = [];
      genConfigMeta(zipFiles, request);
      genConfigIntents(zipFiles, platform);
      response.zip({
        filename: platform.appName + '.zip',
        files: zipFiles
      });
    });
    violetRouter.post('/', function (request, response) {
      try {
        // console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
        console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
        if (!request.body.result) {
          const invalidReq = 'Invalid Webhook Request (expecting v1 webhook request)';
          console.log(invalidReq);
          return response.status(400).end(invalidReq);
        }

        platform.app = new DialogflowApp({request: request, response: response});
        //let intentName = platform.app.getIntent(); // <-- Not sure why this does not work
        let intentName = request.body.result.metadata.intentName;
        if (!platform.intentHandlers[intentName]) {
          intentName = 'default';
        }
        var sessionStore = {};
        request.getSession = () => {
          return {
            get: (varStr) => {
              return sessionStore[varStr];
            },
            set: (varStr, val) => {
              sessionStore[varStr] = val;
            }
          };
        };
        request.slot = (pName) => {
          return request.body.result.parameters[pName];
        };
        var shouldEndSession = true;
        response.shouldEndSession = (flag) => { shouldEndSession = flag; }
        response.say = (str) => {
          if (shouldEndSession) platform.app.tell(str);
          else platform.app.ask(str);
        }
        console.log(`Received request for: ${intentName}`)
        var sessionContext = platform.app.getContext('session');
        if (sessionContext) sessionStore = sessionContext.parameters;
        Object.keys(request.body.result.parameters).forEach(pName=>{
          sessionStore[pName] = request.body.result.parameters[pName];
        });
        platform.intentHandlers[intentName](request, response);
        platform.app.setContext('session', 100, sessionStore);
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
    console.log('registering: ', name, params);
    this.intentHandlers[name] = cb;
    this.intentParams[name] = params;
  }

  regCustomSlot(type, values) {
    this.customSlots[type] = values;
  }

  getSlotsFromReq(requ) {
    return Object.keys(requ.body.result.parameters);
  }


}

module.exports = GooglePlatform;
