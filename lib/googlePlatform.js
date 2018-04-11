/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const express = require('express');
const bodyParser = require('body-parser');
const DialogflowApp = require('actions-on-google').DialogflowApp;

// TODO:
//  0. test, test, test
//  1. generate intent files for importing into DialogFlow (use todoBasic and jovo as examples; doc: https://dialogflow.com/docs/reference/agent-json-fields and https://dialogflow.com/docs/reference/agent/intents)
//  2. take advantage of DialogFlowApp.setContext - https://developers.google.com/actions/reference/nodejs/DialogflowApp#setContext
//  3. create instructions - in part based on README.md here: https://github.com/actions-on-google/dialogflow-number-genie-nodejs

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
    // from gdf script
    // var app = express()
    violetRouter.use(bodyParser.json({ type: 'application/json' }));
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
