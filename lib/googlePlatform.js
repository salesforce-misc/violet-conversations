/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const express = require('express');
const zip = require('express-easy-zip');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4'); // random uuid
// const DialogflowApp = require('actions-on-google').DialogflowApp;
// const dialogflowClient = require('dialogflow-fulfillment').WebhookClient;
const {WebhookClient, Text} = require('dialogflow-fulfillment');
const PlatformReq = require('./platformPlugin.js').PlatformReq;
const PlatformPlugin = require('./platformPlugin.js').PlatformPlugin;
const googlePlatformCfg = require('./googlePlatformCfg.js');
const debug = require('debug')('googlePlatform'); // to enable run as: DEBUG=googlePlatform OR DEBUG=*
const debugAPI = require('debug')('googleAPI'); // to enable run as: DEBUG=googleAPI OR DEBUG=*


// v1 sdk documentation: https://developers.google.com/actions/reference/nodejs/DialogflowApp
// v2 sdk documentation: https://github.com/dialogflow/dialogflow-fulfillment-nodejs/blob/master/docs/WebhookClient.md
// TODO: expose goals as context


class GooglePlatformReq extends PlatformReq {

  constructor(platform, request, response) {
    super(platform, request, response);

    this.fShouldEndSession = true;

    this.sessionStore = {};

    var sessionContext = this.platform.app.context.get('session');
    if (sessionContext) {
      Object.keys(sessionContext.parameters).forEach(pName=>{
        this.sessionStore[pName] = sessionContext.parameters[pName];
      });
    }
  }

  getUserId() {
    // this is specific for Google Actions (and won't work with the rest of Google Dialogflow integrations)
    // more information: https://developers.google.com/actions/identity/user-info#migrating_to_webhook-generated_ids
    var gActions = this.platform.app.conv();

    // use deprecated if available (recommended approach does not seem to work
    // in all situations)

    var userId = gActions.user.id;
    if (userId) {
      console.log('*** Using: UserId = conv.user.id');
      return userId;
    }

    // it seems that we are always generating the id
    if ('userId' in gActions.user.storage) {
      userId = gActions.user.storage.userId;
      console.log(`*** Found userId: `, userId);
    } else {
      userId = uuidv4();
      gActions.user.storage.userId = userId
      console.log(`*** Generated userId: `, userId);

      // TODO: do something different if gActions.user.verification == 'VERIFIED'
      // But, what about gActions.user.verification == undefined
    }
    return userId;
  }

  getInputTypes() {
    debugAPI('request parameters: ', this.platform.app.parameters)
    return Object.keys(this.platform.app.parameters);
  }

  getInputType(inputName) {
    return this.platform.app.parameters[inputName];
  }

  getSession() {
    var platReq = this;
    return {
      getAttributes: () => {
        return platReq.sessionStore;
      },
      get: (varStr) => {
        return platReq.sessionStore[varStr];
      },
      set: (varStr, val) => {
        platReq.sessionStore[varStr] = val;
      }
    };
  }

  say(str) {
    if (this.fShouldEndSession)
      this.platform._tell(str);
    else
      this.platform._ask(str);
  }

  shouldEndSession(flag) {
    this.fShouldEndSession = flag;
  }
}

const welcomeIntent  = 'Default Welcome Intent';
const fallbackIntent = 'Default Fallback Intent';

function _stripTags(str) {
  return str.replace(/<[^>]*>?/gm, '');
}

class GooglePlatform extends PlatformPlugin {

  _tell(str) {
    // console.log(`===> tell: `, str);
    let conv = this.app.conv();
    if (conv) {
      // console.log(`===> conv: `, Object.keys(conv));
      conv.close('<speak>' + str + '</speak>');
      this.app.add(conv);
    } else {
      this.app.add('<speak>' + str + '</speak>');
    }
  }

  _ask(str) {
    // console.log(`===> ask: `, str);
    // console.log(`===> this.app: `, Object.keys(this.app));
    let conv = this.app.conv();
    if (conv) {
      // console.log(`===> conv: `, Object.keys(conv));
      conv.ask('<speak>' + str + '</speak>');
      this.app.add(conv);
    } else {
      this.app.add('<speak>' + str + '</speak>');
    }
  }

  constructor(endpoint, violetCfg, convoModel) {
    super(endpoint, violetCfg, convoModel);
    this.platformIntentRegistry[welcomeIntent] = {
      params: {utterances: []},
      handler: (platReq) => {
        // this._tell('Hello, Welcome to my Dialogflow agent!');
        return this.launchCB(platReq);
      }
    };
    this.platformIntentRegistry[fallbackIntent] = {
      params: {utterances: []},
      handler: (platReq) => {
        this._tell('The default handler for unknown or undefined actions got triggered!');
        // this._tell('Can you please repeat that?');
      }
    };

    this.customSlots = {};
  }

  handleRequest(request, response) {
    const platform = this;
    try {
      platform.app = new WebhookClient({request: request, response: response});

      // bug fix based on https://github.com/dialogflow/dialogflow-fulfillment-nodejs/issues/187#issuecomment-442762158
      if (platform.app.session.indexOf('environments') !== -1) {
        const requestContexts = request.body.queryResult.outputContexts;
        for (let index = 0; index < requestContexts.length; index++) {
          const context = requestContexts[index];
          const name = context.name.split('/').slice(-1)[0];
          platform.app.context.set(name, context.lifespanCount, context.parameters);
        }
      }

      let intentName = platform.app.intent;
      var intentObj = platform.getIntentObj(intentName);
      if (!intentObj) {
        intentObj = this.platformIntentRegistry[fallbackIntent];
      }
      var platReq = new GooglePlatformReq(platform, request, response);
      let result = intentObj.handler(platReq);
      return Promise.resolve(result).then(()=>{
        platform.app.context.set(/*name*/'session', /*lifespan*/100, /*parameters*/platReq.sessionStore);
        platform.app.send_();
      });
    } catch (e) {
      console.log('Caught Error: ', e);
      response.end();
    }
  }

  setServerApp(violetRouter) {
    const platform = this;
    violetRouter.use(zip())

    violetRouter.use(bodyParser.json({ type: 'application/json' }));
    // violetRouter.get('/', function (request, response) {
    //   response.send('Go to /config for generating Dialogflow import data');
    // });
    violetRouter.get('/googleConfig', googlePlatformCfg.genConfigZip(platform));
    violetRouter.post('/' + this.endpoint, function (request, response) {
      // console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
      console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
      return platform.handleRequest(request, response);
    });
  }

  onError(cb) {
    this.errorCB = cb;
  }

  onLaunch(cb) {
    this.launchCB = cb;
  }

  regIntent(name, params, cb) {
    debug('googlPlatform: registering: ', name, params);
    // nothing to do here!
  }

  regCustomSlot(type, values) {
    this.customSlots[type] = values;
  }

}

module.exports = GooglePlatform;
