/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const path = require('path');

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


function genConfigMeta(zipFiles, svcUrl) {
  addFile(zipFiles, `package.json`, {"version": "1.0.0"});
  // spec: https://dialogflow.com/docs/reference/agent-json-fields
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

exports.genConfigZip = function(platform) {
  return function(request, response) {
    var svcUrl = `${request.protocol}://${request.headers.host}${request.originalUrl}`;
    var configName = platform.appName;
    if (!configName) configName = 'config'
    var zipFiles = [];
    genConfigMeta(zipFiles, svcUrl);
    genConfigIntents(zipFiles, platform);
    genConfigEntities(zipFiles, platform);
    response.zip({
      filename: configName + '.zip',
      files: zipFiles
    });
  };
}
