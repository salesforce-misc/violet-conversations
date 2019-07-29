/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the ScriptParser class that helps parse Violet Scripts. This is the
 * lower level - within strings parsing and is used by both the Script API as
 * well as the Flow Language.
 *
 * @module scriptParser
 */
var utteranceHelper = require('alexa-utterances');
var utils = require('./utils.js');

const internalPrefixId = 'violet';
const internalIdSep = '_';

var _isPromise = obj => obj && typeof obj.then == 'function';
 /**
  * A set of static methods to help the ConversationEngine parse the Violet
  * Script.
  * <br><br>
  * Methods in this class are currently only used internally and therefore
  * documentation is not exposed.
  *
  * @class
  */
class ScriptParser {
  static get paramsRE() {
    return /\[\[([a-zA-Z0-9_,+\-*\/\s\\\.\(\)\']*)\]\]/;
  }
  static get paramsGRE() {
    return /\[\[([a-zA-Z0-9_,+\-*\/\s\\\.\(\)\']*)\]\]/g;
  }

  static interpolate(originalStr, foundStr, foundStrPos, replaceStr) {
    if (_isPromise(replaceStr)) {
      console.log('ERROR: Cannot interpolate a promise');
      return 'error';
    }
    return originalStr.substring(0, foundStrPos) + replaceStr + originalStr.substring(foundStrPos + foundStr.length);
  }
  static interpolateParamsFromStore(str, varExtractionRE, store) {
    var varMatch;
    while ((varMatch = varExtractionRE.exec(str)) != null) {
      // varMatch[0] - {{varName}}
      // varMatch[1] - varName
      // varMatch.index - match position
      // input - input string
      // console.log('matched: ', varMatch[1])
      str = ScriptParser.interpolate(str, varMatch[0], varMatch.index, store.get(varMatch[1]));
    }
    return str;
  };

  static forPunctuation(userSpeech) {
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return userSpeechItem.replace(/[,?]/g,'');
    });
    userSpeech = userSpeech.map(function(userSpeechItem) {
      return ScriptParser.interpolateParamsFromStore(userSpeechItem, /(\d+)/, {get: (num)=>{return utils.getNumAsStr(num);}});
    });
    return userSpeech;
  }

  static forInputTypes(inputTypes, userSpeech) {
    // I. prevent conflicts between {x|y} and {|var}: split {x|y} into x, y
    var userSpeechSplit = userSpeech.map(userSpeechItem => utteranceHelper(userSpeechItem) );
    userSpeech = Array.prototype.concat(... userSpeechSplit); //single level flatten
    // II. change to variable/slot format: [[varName]] -> {-|varName}
    userSpeech = userSpeech.map((userSpeechItem) => {
      userSpeechItem = userSpeechItem.trim().replace(/\s+/,' ');
      // try to put in literal sampleValues (if available)
      // we want to do:
      // return userSpeechItem.replace(ScriptParser.paramsGRE,'{-|\$1}');
      // but instead of the '-' we want to put in real values depending on the param matched
      var literalSampleValuesStore = {
        get: (inStr)=>{
          // console.log('** inStr: ' + inStr);
          if (inStr.startsWith(internalPrefixId) && !inputTypes[inStr]) {
            // just-in-time add internal types
            inputTypes[inStr] = inStr.split(internalIdSep)[1];
          }

          var sampleValues = '-';
          if (inputTypes[inStr] && inputTypes[inStr].sampleValues) {
            inputTypes[inStr].sampleValues = inputTypes[inStr].sampleValues
                              .map(v=>{return v.trim();});
            sampleValues = inputTypes[inStr].sampleValues.join('|');
            // console.log('** literalSampleValuesStore: ' + inStr + ': ' + sampleValues);
          } else if (!inputTypes[inStr]) {
            console.error('ERROR - Received unexpected type :', inStr);
            inputTypes[inStr] = ScriptParser.getDefaultType();
          }
          return '{' + sampleValues + '|' + inStr + '}';
        }
      };
      return ScriptParser.interpolateParamsFromStore(userSpeechItem, ScriptParser.paramsRE, literalSampleValuesStore);
    });
    return userSpeech;
  }

  static forPhraseEquivalents(phraseEquivalents, userSpeech) {
    // return userSpeech;
    var max = userSpeech.length;
    for (var ndx = 0; ndx<max; ndx++) {
      var userSpeechItem = userSpeech[ndx];
      // go through all equivalent phrases (phraseEquivalents x equivSets) to see if there are any matches
      phraseEquivalents.forEach((equivSets) => {
        equivSets.forEach((phrase, phraseNdx) => {
          var phrasePos = userSpeechItem.toLowerCase().indexOf(phrase.toLowerCase());
          if (phrasePos == -1) return;

          // found a match, lets add everything in the equivSets
          var foundPhrasePos = phrasePos;
          var foundPhrase = phrase;
          var foundPhraseNdx = phraseNdx;
          equivSets.forEach((phraseToInclude, phraseToIncludeNdx) => {
            if (phraseToIncludeNdx == foundPhraseNdx) return;
            userSpeech.push(ScriptParser.interpolate(userSpeechItem, foundPhrase, foundPhrasePos, phraseToInclude));
          });
        });
      });
    }
    return userSpeech;
  }

  static getVarType(inputTypes, type) {
    var name = inputTypes[type];

    // support custom types
    if (name && typeof name == 'object') name = name.type;

    return name;
  }

  static getDefaultType() {
    return "phrase";
  }

  static extractParamsFromSpeech(inputTypes, userSpeech) {
    var expectedParams = {};
    userSpeech.forEach((speechStr) => {
      var extractedVars = speechStr.match(/\|[a-zA-Z_]*}/g);
      if (!extractedVars) return;
      extractedVars.forEach((extractedVar) => {
        var ev = extractedVar.slice(1,-1); // strip first and last characters
        if (ev.length == 0) return;
        var evName = ScriptParser.getVarType(inputTypes, ev);
        if (evName) expectedParams[ev] = evName;
      });
    });
    return expectedParams;
  }

}

module.exports = ScriptParser;
