/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const DialogflowApp = require('actions-on-google').DialogflowApp;

const violetToPlatformTypeMap = {
  'NUMBER': '@sys.number'
};
function guessSamples(violetType) {
  switch (violetType) {
    case 'NUMBER':
      return Math.floor(Math.random() * 100);
    default:
      console.log(`ERR - googlePlatform: ${violetType} not supported`)
      return 'UNKNOWN TYPE'
  }
}

// TODO:
//  0. test, test, test
//  1. generate intent files for importing into DialogFlow (doc: https://dialogflow.com/docs/reference/agent/intents)
//  2. take advantage of DialogFlowApp.setContext - https://developers.google.com/actions/reference/nodejs/DialogflowApp#setContext
//  3. create instructions - in part based on README.md here: https://github.com/actions-on-google/dialogflow-number-genie-nodejs

function writeFile(location, name, jsonBody) {
  const fName = `${location}${path.sep}${name}`;
  // ensure directory exists
  fName.split(path.sep).slice(0,-1).reduce(function(prev, curr, i) { // slice to not create directory for target file
    const acc = prev + path.sep + curr;
    // console.log(`checking: ${acc}`)
    if (fs.existsSync(acc) === false) {
      fs.mkdirSync(acc);
      console.log('*** created: ' + acc)
    }
    return acc;
  });
  fs.writeFile(fName, JSON.stringify(jsonBody, null, 2), (err) => {
    if (err) {
      console.log(`Error writing ${fName}`, err);
    } else {
      console.log(`Wrote ${fName}`);
    }
  });
}
function genConfigMeta(location) {
  writeFile(location, `package.json`, {"version": "1.0.0"});
  // spec: https://dialogflow.com/docs/reference/agent-json-fields
  writeFile(location, `agent.json`, {
      // "description": "",
      webhook: {
        url: "https://deployURL",
        available: true
      },
      language: "en"
    });
};
function genConfigIntents(location, googlePlatform) {
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
    writeFile(location, `intents${path.sep}${intentName}.json`, intentInfo)

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

    writeFile(location, `intents${path.sep}${intentName}_usersays_en.json`, gUtterances)
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
        app.ask('Hello, Welcome to my Dialogflow agent!');
      },
      'default': () => {
        app.ask('The default handler for unknown or undefined actions got triggered!');
      }
    };
  }

  getAppName() {
    return this.appName;
  }

  setServerApp(violetRouter) {
    const platform = this;

    violetRouter.use(bodyParser.json({ type: 'application/json' }));
    violetRouter.get('/', function (request, response) {
      response.send('Go to /genConfig for generating DialogFlow import data');
    });
    violetRouter.get('/genConfig', function (request, response) {
      var location = process.cwd() + path.sep + 'gen';
      console.log(`Generating config at: ${location}`);
      response.send(`Generating config at: ${location}`);
      genConfigMeta(location);
      genConfigIntents(location, platform);
    });
    violetRouter.post('/', function (request, response) {
      try {
        // console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
        // console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
        if (!request.body.result) {
          const invalidReq = 'Invalid Webhook Request (expecting v1 webhook request)';
          console.log(invalidReq);
          return response.status(400).end(invalidReq);
        }

        this.app = new DialogflowApp({request: request, response: response});
        let intentName = this.app.getIntent();
        if (!this.intentHandlers[intentName]) {
          intentName = 'default';
        }
        var shouldEndSession = true;
        response.shouldEndSession = (flag) => { shouldEndSession = flag; }
        response.say = (str) => {
          if (shouldEndSession) app.tell(str);
          else app.ask(str);
        }
        this.intentHandlers[intent](request, response);
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
