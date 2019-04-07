var violetApp = angular.module('violetApp');

const Recognizer = window.SpeechRecognition ||
                   window.webkitSpeechRecognition ||
                   window.mozSpeechRecognition ||
                   window.msSpeechRecognition ||
                   window.oSpeechRecognition;

const Synthesizer = window.speechSynthesis;

var synthUtterance = null; // we need this here - to get around GC bug

violetApp.service('voiceSvc', function(wakeWord) {
  var svc = this;

  this.initalized = false;
  this.sessionRunning = false;

  // this.autoRestart = true; // unfortunately browser based recognition stops automatically after 30s

  function _speak(speech, begCB, endCB) {
    Synthesizer.cancel();
    synthUtterance = new SpeechSynthesisUtterance(speech);
    synthUtterance.voice = Synthesizer.getVoices().filter(voice=> {
      return voice.name == 'Google UK English Female';
    })[0];
    synthUtterance.rate = 0.8;
    synthUtterance.onstart = (event)=>{
      console.log('synthUtterance - speak - onstart');
      if (begCB) begCB();
    };
    synthUtterance.onend = (event)=>{
      console.log('synthUtterance - speak - onend');
      if (endCB) endCB();
    };
    console.log('synthUtterance - speak');
    window.speechSynthesis.speak(synthUtterance);
  }
  function _processSkillResp(response, responseSpeech) {
    responseSpeech = responseSpeech.replace(/<break([^/]*)\/>/g, '');

    speechSSML = $.parseHTML(responseSpeech);
    speechSSML = speechSSML[0]; // go inside the outermost <speak> tag
    if (svc.isListening) {
      console.log('--> turning off listening')
      svc.recognition.stop();
    }
    console.log('--> going to speak: ', speechSSML.innerHTML);
    _speak(speechSSML.innerHTML, null, ()=>{
      // console.log('--> done speaking ', response);
      if (response.response.shouldEndSession) {
        console.log('--> done speaking - session end request');
        svc.isListening = false;
        notifyListeningChange();
      } else if (svc.isListening) {
        console.log('--> done speaking - restart listening');
        svc.recognition.start();
      }
    });
  }

  // exact match includes both direct phrases and slotted phrases
  function __exactMatchUserReq(txt) {
    var matchedIntent = svc.listeningModel.directPhrases[txt];

    if (matchedIntent) return {name: matchedIntent};

    // check if it is a slotted intent match
    // for loops ... 'in' is for prop names; 'of' is for prop values
    for (var intent in svc.listeningModel.slottedPhrases) {
      var intentSlottedPhrases = svc.listeningModel.slottedPhrases[intent];
      for (var re of intentSlottedPhrases.regExp) {
        var reMatch = re.exec(txt)
        if (reMatch) {
          console.log('matched: ', reMatch);
          // set slot values and return
          var slots = {};
          for (var slotNdx = 0; slotNdx < intentSlottedPhrases.slots.length; slotNdx++) {
            var slot = intentSlottedPhrases.slots[slotNdx];
            slots[slot.name] = {name: slot.name, value:reMatch[slotNdx+1]};
          }
          return {name: intent, slots};
        }
      }
    }

    // no match
    return {};
  }

  // returns true is we were able to process, so that the caller can try other attempts
  function _processUserReq(txt, findBestFit=false) {
    txt = txt.trim().toLowerCase();

    if (!svc.sessionRunning) {
      // if does not start with wake word we do nothing
      if (!txt.startsWith(wakeWord)) return false;
      console.log('session launched');
      svc.sessionRunning = true;
    }

    var match = __exactMatchUserReq(txt);

    // no match
    if (!match.name) {
      console.log(`Not in listeningModel: ${txt}`);
      if (!findBestFit) return false;

      // TODO: calc matchedIntent based for best fit, using metaphone2 transformation and levenshtein distance minimazation
      // https://github.com/words/double-metaphone/blob/master/index.js
      // https://gist.github.com/andrei-m/982927
      return false;
    }

    svc.skillCB(match, _processSkillResp);
    return true;
  }

  this.init = (interactionModel, skillCB)=>{
    svc.skillCB = skillCB;

    svc.prefixes = [
                      '', // allow phrase to be said by itself
                      `${wakeWord} ask ${interactionModel.languageModel.invocationName} `,
                      `${wakeWord} ask ${interactionModel.languageModel.invocationName} for `,
                      `${wakeWord} ask ${interactionModel.languageModel.invocationName} to `,
                      `${wakeWord} tell ${interactionModel.languageModel.invocationName} `,
                      `${wakeWord} tell ${interactionModel.languageModel.invocationName} for `,
                      `${wakeWord} tell ${interactionModel.languageModel.invocationName} to `
                    ];

    svc.listeningModel = {
      directPhrases: {},
      slottedPhrases: {}
    };

    // prep wake word
    svc.listeningModel.directPhrases[`${wakeWord} launch ${interactionModel.languageModel.invocationName}`] = 'LaunchRequest';

    // adapt intents to listeningModel
    interactionModel.languageModel.intents.forEach(intent=>{
      if (intent.slots) {
        function _compileSlottedSamplesToRE(intent) {
          var reList = [];
          intent.samples.forEach(s=>{
            svc.prefixes.forEach(p=>{
              var listeningSamples = p+s;
              intent.slots.forEach(slot=>{
                listeningSamples = listeningSamples.replace(new RegExp(`{${slot.name}}`, 'g'), '(\\w+)');
              });
              // console.log('Creating reg exp with: ', listeningSamples);
              reList.push(new RegExp(listeningSamples));
            });
          });
          return reList;
        }
        svc.listeningModel.slottedPhrases[intent.name] = {
          phrases: intent.samples,
          slots: intent.slots,
          regExp: _compileSlottedSamplesToRE(intent)
        };
        return;
      }
      intent.samples.forEach(s=>{
        s = s.toLowerCase();
        svc.prefixes.forEach(p=>{
          svc.listeningModel.directPhrases[p+s] = intent.name;
        });
      });
    });

    console.log('listeningModel: ', svc.listeningModel);

    if (this.initalized) return; // we don't reinit the Recognizer

    svc.recognition = new Recognizer();
    svc.recognition.maxAlternatives = 5;
    svc.recognition.continuous = window.location.protocol === 'http:';
    svc.recognition.lang = 'en-US';
    svc.recognition.onstart = function() {
    };

    svc.recognition.onsoundstart = function() {
      console.log('svc.recognition.onsoundstart');
    };

    svc.recognition.onerror = function(event) {
      switch (event.error) {
        case 'aborted':
          return;
        // case 'not-allowed':
        // case 'service-not-allowed':
        //   // if permission to use the mic is denied, turn off auto-restart
        //   svc.autoRestart = false;
        //   break;
        // case 'network':
        //   break;
      }
      console.log('svc.recognition.onerror', event);
    };

    svc.recognition.onend = function() {
      console.log(`svc.recognition.onened - autoRestart: ${svc.autoRestart}`);
      // if (svc.isListening && svc.autoRestart) svc.recognition.start();
    };

    svc.recognition.onresult = function(event) {
      // console.log('recognition results: ', event)
      // console.log('recognition results: ', event.results[event.resultIndex]);
      console.log('recognition results:');
      var result = event.results[event.resultIndex];
      for (let altNdx = 0; altNdx < result.length; altNdx++) {
        console.log('0.' + Math.floor(1000*result[altNdx].confidence) + ': ' + result[altNdx].transcript);
        var processed = _processUserReq(result[altNdx].transcript);
        if (processed) return;
      }
      // we were not able to process - try forcing it
      _processUserReq(result[0].transcript, true);

    };

    svc.initalized = true;
  };

  this.startListening = ()=>{
    try {
      this.isListening = true;
      notifyListeningChange();
      this.recognition.start();
    } catch (e) {
      console.error(e.message);
    }

  };
  this.stopListening = ()=>{
    this.isListening = false;
    notifyListeningChange();
    console.log(`stopListening`);
    this.recognition.stop();
  };

  this.listeningNotificationCB = [];
  this.addSessionNotification = (cb)=>{
    svc.listeningNotificationCB.push(cb);
  };
  function notifyListeningChange() {
    svc.listeningNotificationCB.forEach(cb=>{
      cb();
    })
  }

  // this.runExperiment = ()=>{
  //   _speak('test one');
  // };
});
