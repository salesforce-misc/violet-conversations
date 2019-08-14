/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const path = require('path');
const express = require('express');
const zip = require('express-easy-zip');
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4'); // random uuid
// const DialogflowApp = require('actions-on-google').DialogflowApp;
// const dialogflowClient = require('dialogflow-fulfillment').WebhookClient;
const {WebhookClient, Text} = require('dialogflow-fulfillment');
const PlatformReq = require('./platformPlugin.js').PlatformReq;
const PlatformPlugin = require('./platformPlugin.js').PlatformPlugin;
const debug = require('debug')('googlePlatform'); // to enable run as: DEBUG=googlePlatform OR DEBUG=*
const debugAPI = require('debug')('googleAPI'); // to enable run as: DEBUG=googleAPI OR DEBUG=*


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

function guessSamples(violetType, customSlots) {
  switch (violetType) {
    case 'number':
      return [Math.floor(Math.random() * 100)];
    case 'firstName':
      return ["John"];
    case 'date':
      return ["11 October"];
    case 'time':
      return ["5:20 pm"];
    case 'phoneNumber':
      return ["(123) 456 7890"];
    case 'phrase':
      return ["phrase sample"];
  }
  if (customSlots[violetType]) return customSlots[violetType];
  console.log(`ERR - googlePlatform: cannot guess ${violetType}`)
  return ['UNKNOWN TYPE'];
}
function getTypeName(violetType) {
  if (violetToPlatformTypeMap[violetType]) return violetToPlatformTypeMap[violetType];
  return `@${violetType}`;
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
  svcUrl = svcUrl.replace('Config','')

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
  googlePlatform.getAllIntentNames().forEach((intentName)=>{
    // spec: https://dialogflow.com/docs/reference/agent/intents
    var intentInfo = {
      name: intentName,
      auto: true, // <-- ml enabled
      webhookUsed: true
    };
    var intentObj = googlePlatform.getIntentObj(intentName);
    var inputTypes = intentObj.params.inputTypes;
    if (inputTypes) {
      intentInfo.responses = [{
        parameters: []
      }];
      Object.keys(inputTypes).forEach((inputName)=>{
        intentInfo.responses[0].parameters.push({
            isList: false,
            name: inputName,
            value: "$" + inputName,
            dataType: getTypeName(inputTypes[inputName])
        });
      });
    }
    addFile(zipFiles, `intents${path.sep}${intentName}.json`, intentInfo)

    var gUtterances = [];
    intentObj.params.utterances.forEach((utterance)=>{
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
          guData.meta = getTypeName(inputTypes[guData.alias]);

          // set: text
          if (u.startsWith('-|')) {
            guData.text = guessSamples(inputTypes[guData.alias], googlePlatform.customSlots);
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
function genConfigEntities(zipFiles, googlePlatform) {
  Object.keys(googlePlatform.customSlots).forEach(typeName=>{
    // spec: https://dialogflow.com/docs/reference/agent/entities
    var entityInfo = {
      name: typeName,
      isEnum: true,
      automatedExpansion: false,
    };

    addFile(zipFiles, `entities${path.sep}${typeName}.json`, entityInfo)

    var entityEntries = [];
    googlePlatform.customSlots[typeName].forEach(val=>{
      entityEntries.push({
        value: val,
        synonyms: [val]
      });
    });

    addFile(zipFiles, `entities${path.sep}${typeName}_entries_en.json`, entityEntries)
  });
}

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
    violetRouter.get('/googleConfig', function (request, response) {
      var zipFiles = [];
      genConfigMeta(zipFiles, request);
      genConfigIntents(zipFiles, platform);
      genConfigEntities(zipFiles, platform);
      var configName = platform.appName;
      if (!configName) configName = 'config'
      response.zip({
        filename: configName + '.zip',
        files: zipFiles
      });
    });
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
