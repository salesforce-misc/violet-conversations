function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function getSvcPath() {
  var svcPath = location.origin;
  if (location.pathname !== '/') svcPath += location.pathname;
  return svcPath + '/alexa';
}

// For Angular
var violetApp = angular.module('violetApp');
violetApp.controller('VioletController', function($scope, $http, voiceSvc) {
  $scope.request = {};
  $scope.response = null;
  $scope.responseSpeech = null;
  $scope.requestAndIntent = null;
  $scope.session = {};
  $scope.intent = null;

  $scope.changeRequestAndIntent = function() {
    var requestType = '';
    if ($scope.requestAndIntent === '') {
      $scope.request = {};
      return;
    }
    var intentNdx = $scope.requestAndIntent.indexOf(':');
    if (intentNdx == -1) {
      // not an intentRequest
      requestType = $scope.requestAndIntent;
      $scope.request = clone($scope.templates[requestType]);
      $scope.request.session.attributes = $scope.session;
      return;
    }
    requestType = $scope.requestAndIntent.substr(0, intentNdx);
    var intent = $scope.requestAndIntent.substr(intentNdx+1);
    $scope.request = clone($scope.templates[requestType]);
    $scope.request.session.attributes = $scope.session;
    $scope.request.request.intent.slots = {};
    $scope.request.request.intent.name = intent;
  }

  // get interactionModel
  $scope.interactionModel={};
  var svcPath = location.origin;
  if (location.pathname !== '/') svcPath += location.pathname;
  $http.get(`${svcPath}/alexa?schema=true&schemaType=askcli`)
    .then(function onSuccess(response) {
      // console.log(`URL Request: ${location.origin}${location.pathname}/alexa?schema=true&schemaType=askcli`);
      console.log('Received from askcli: ', response.data);
      $scope.interactionModel=response.data.interactionModel;

      for (var ndx=0; ndx<$scope.interactionModel.languageModel.intents.length; ndx++) {
        var i = $scope.interactionModel.languageModel.intents[ndx];

        // remove utterances with just a phrase slot type, i.e. AMAZON.SearchQuery and no carriers (other platorms work with them)
        if (i.slots) {
          var phraseSlotNames = i.slots.filter(s=>s.type=='AMAZON.SearchQuery').map(s=>s.name);
          phraseSlotNames.forEach(psn=>{
            psn = `{${psn}}`;
            // console.log(`Slot to filter: `, psn, ` in: `, i.samples);
            for (var ndx2=0; ndx2<i.samples.length; ndx2++) {
              if (i.samples[ndx2] === psn) {
                i.samples.splice(ndx2,1);
                ndx2--; // because we have deleted one item from the array
              }
            }
          });
        }

        // remove intents that can't be triggered (if there are no utterances and they are not external trigger, i.e. intents with a '.' in them)
        if (i.samples.length != 0) continue;    // if there are no utterances
        if (i.name.indexOf('.') != -1) continue; // external trigger (like AMAZON.HELP)
        $scope.interactionModel.languageModel.intents.splice(ndx,1);
        ndx--; // because we have deleted one item from the array
      }


      // get custom slot types
      response.data.interactionModel.languageModel.types.forEach(cst=>{
        cst.valuesStr = cst.values.map(v=>{return v.name.value}).join(', ');
      });
      $scope.customSlotTypes = response.data.interactionModel.languageModel.types;

      voiceSvc.init($scope.interactionModel, callSkill);
    }).catch(function onError(error) {
      console.log('Received error from askcli', error);
      console.log(error.message);
    });


  $scope.post = function() {
    if (Object.keys($scope.request).length !== 0) {
      $http.post(getSvcPath(), $scope.request).then(function onSuccess(response) {
        $scope.response = response.data;
        // Copy session variables
        if ($scope.response) {
          if ($scope.response.response && $scope.response.response.outputSpeech) {
            $scope.responseSpeech = $scope.response.response.outputSpeech.ssml;
          } else {
            $scope.responseSpeech = 'Error - No outputSpeech';
          }
          if ($scope.response.sessionAttributes) {
            $scope.session = $scope.response.sessionAttributes;
            $scope.request.session.attributes = $scope.session;
          }
        }})
        .catch(function onError(error) {
          alert(error.message);
        });
      } else {
        alert("Error: Cannot send an empty request object. Please select a request type.");
      }
  }

  $scope.getIntents = function() {
    if (!$scope.interactionModel.languageModel) return null;
    return $scope.interactionModel.languageModel.intents;
  }

  $scope.getIntent = function() {
    if (!$scope.interactionModel.languageModel) return null;
    try {
      var intents = $scope.interactionModel.languageModel.intents;
      for (var i = 0; i < intents.length; i++) {
        var intent = intents[i];
        if (intent.name == $scope.request.request.intent.name) {
          return intent;
        }
      };
      return null;
    } catch(e) { return null; }
  };

  function callSkill(intentInfo, postCallCB) {
    if (!intentInfo.name || intentInfo.name === '') return;

    if (intentInfo.name === 'LaunchRequest') {
      $scope.requestAndIntent = 'LaunchRequest'; // purely for UI
      $scope.request = clone($scope.templates[intentInfo.name]);
      $scope.request.session.attributes = $scope.session;
    } else {
      $scope.requestAndIntent = 'IntentRequest:'+intentInfo.name; // purely for UI
      $scope.request = clone($scope.templates['IntentRequest']);
      $scope.request.session.attributes = $scope.session;
      if (intentInfo.slots)
        $scope.request.request.intent.slots = intentInfo.slots;
      else
        $scope.request.request.intent.slots = {};
      $scope.request.request.intent.name = intentInfo.name;
    }

    $http.post(getSvcPath(), $scope.request).then(function onSuccess(response) {
      $scope.response = response.data;
      // Copy session variables
      if ($scope.response) {
        if ($scope.response.response && $scope.response.response.outputSpeech) {
          $scope.responseSpeech = $scope.response.response.outputSpeech.ssml;
        } else {
          $scope.responseSpeech = 'Error - No outputSpeech';
        }
        if ($scope.response.sessionAttributes) {
          $scope.session = $scope.response.sessionAttributes;
          $scope.request.session.attributes = $scope.session;
        }

        if (postCallCB) postCallCB($scope.response, $scope.responseSpeech);
      }})
      .catch(function onError(error) {
        alert(error.message);
      });

  };

  $scope.toggleListening = ()=>{
    userReq = true;
    if (!voiceSvc.isListening)
      voiceSvc.startListening();
    else
      voiceSvc.stopListening();
    userReq = false;
  };

  // update for showing in UI
  $scope.isListening = false;
  function updateListening() {
    if ($scope.$$phase) { // not great Angular, but this happens because the voice service does not do a $scope.apply after the speech notification comes in
      $scope.isListening = voiceSvc.isListening;
    } else {
      // happens when the violet app changes conversation state
      $scope.$apply(function () {
        $scope.isListening = voiceSvc.isListening;
      });
    }
  }
  voiceSvc.addSessionNotification(updateListening);

  // $scope.runExperiment = ()=>{
  //   voiceSvc.runExperiment();
  // };

  $scope.templates = templates;

});
