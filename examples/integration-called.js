'use strict';

var request = require('request');

// copy from the web-ui
var msgBody =
{
  "version": "1.0",
  "session": {
    "new": false,
    "sessionId": "amzn1.echo-api.session.abeee1a7-aee0-41e6-8192-e6faaed9f5ef",
    "application": {
      "applicationId": "amzn1.echo-sdk-ams.app.000000-d0ed-0000-ad00-000000d00ebe"
    },
    "attributes": {},
    "user": {
      "userId": "amzn1.account.AM3B227HF3FAM1B261HK7FFM3A2"
    }
  },
  "context": {
    "System": {
      "application": {
        "applicationId": "amzn1.echo-sdk-ams.app.000000-d0ed-0000-ad00-000000d00ebe"
      },
      "user": {
        "userId": "amzn1.account.AM3B227HF3FAM1B261HK7FFM3A2"
      },
      "device": {
        "supportedInterfaces": {
          "AudioPlayer": {}
        }
      }
    },
    "AudioPlayer": {
      "offsetInMilliseconds": 0,
      "playerActivity": "IDLE"
    }
  },
  "request": {
    "type": "IntentRequest",
    "requestId": "amzn1.echo-api.request.6919844a-733e-4e89-893a-fdcb77e2ef0d",
    "timestamp": "2015-05-13T12:34:56Z",
    "locale": "en-US",
    "intent": {
      "name": "MajorIntent",
      "slots": {}
    }
  }
};

var options = { method: 'POST',
  url: 'http://localhost:8080/alexa/local',
  headers: { 'content-type': 'application/json' },
  json: true,
  body: msgBody
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
  console.log(body);
});
