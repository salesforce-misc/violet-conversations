/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * This is a module of general purpose utilities that are helpful when building
 * Voice apps
 *
 * @module utils
 */

var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');

/**
 *  Loads a newline seperated array from a file - especially helpful when you
 *  have a long list of possible values
 *
 * @example
 *  violet.addInputTypes({
 *    category: {
 *      type: 'categoryType',
 *      values: utils.loadArrayFromFile(__dirname, 'potentialCategories.txt')
 *    }
 *  });
 * @param {string} dirName - path to target file
 * @param {string} fileName - newline seperated array backed file
 */
exports.loadArrayFromFile =  function(dirName, fileName) {
  return fs.readFileSync(path.join(dirName, fileName), 'utf8')
      .split('\n')
      .filter(v=>{return v.length>0;});
};

/**
 * Returns a random number
 *
 * @param {Number} min - generated number is to not be below this
 * @param {Number} max - generated number is to not be greater than this
 */
exports.getRand =  function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Converts an array to a string
 *
 * @example
 *   utils.getArrAsStr([1, 2, 3])
 *   // returns '1, 2 and 3'
 * @param {Object[]} arr - array of objects to be pulled togeter into a string
 */
exports.getArrAsStr = function(arr) {
  if (arr.length==1) return arr[0];
  arr.splice(arr.length-1, 0, 'and');
  return arr.join(', ').replace(', and, ', ' and ');
}

/** Converts numbers 0-999 to a string
 * @function getNumAsStr
 * @param {Number} num - that is converted into a string, i.e. 11 -> eleven
 */
var _getNumAsStr = exports.getNumAsStr = function(num, subpart=false) {
  if (typeof num == 'string') num = parseInt(num);
  if (num<0) return 'err';
  if (num==0) {
    if (subpart) return '';
    if (!subpart) return 'zero';
  }
  var hdr = ''; if (subpart) hdr = ' ';
  if (num<20) switch(num) {
    case 1: return hdr + 'one';
    case 2: return hdr + 'two';
    case 3: return hdr + 'three';
    case 4: return hdr + 'four';
    case 5: return hdr + 'five';
    case 6: return hdr + 'six';
    case 7: return hdr + 'seven';
    case 8: return hdr + 'eight';
    case 9: return hdr + 'nine';
    case 10: return hdr + 'ten';
    case 11: return hdr + 'eleven';
    case 12: return hdr + 'twelve';
    case 13: return hdr + 'thirteen';
    case 14: return hdr + 'fourteen';
    case 15: return hdr + 'fifteen';
    case 16: return hdr + 'sixteen';
    case 17: return hdr + 'seventeen';
    case 18: return hdr + 'eighteen';
    case 19: return hdr + 'nineteen';
  };
  if (num<20+10) return hdr + 'twenty' + _getNumAsStr(num-20, /*subpart*/true);
  if (num<30+10) return hdr + 'thirty' + _getNumAsStr(num-30, /*subpart*/true);
  if (num<40+10) return hdr + 'forty' + _getNumAsStr(num-40, /*subpart*/true);
  if (num<50+10) return hdr + 'fifty' + _getNumAsStr(num-50, /*subpart*/true);
  if (num<60+10) return hdr + 'sixty' + _getNumAsStr(num-60, /*subpart*/true);
  if (num<70+10) return hdr + 'seventy' + _getNumAsStr(num-70, /*subpart*/true);
  if (num<80+10) return hdr + 'eighty' + _getNumAsStr(num-80, /*subpart*/true);
  if (num<90+10) return hdr + 'ninety' + _getNumAsStr(num-90, /*subpart*/true);
  if (num<100+100) return hdr + 'one hundred' + _getNumAsStr(num-100, /*subpart*/true);
  if (num<200+100) return hdr + 'two hundred' + _getNumAsStr(num-200, /*subpart*/true);
  if (num<300+100) return hdr + 'three hundred' + _getNumAsStr(num-300, /*subpart*/true);
  if (num<400+100) return hdr + 'four hundred' + _getNumAsStr(num-400, /*subpart*/true);
  if (num<500+100) return hdr + 'five hundred' + _getNumAsStr(num-500, /*subpart*/true);
  if (num<600+100) return hdr + 'six hundred' + _getNumAsStr(num-600, /*subpart*/true);
  if (num<700+100) return hdr + 'seven hundred' + _getNumAsStr(num-700, /*subpart*/true);
  if (num<800+100) return hdr + 'eight hundred' + _getNumAsStr(num-800, /*subpart*/true);
  if (num<900+100) return hdr + 'nine hundred' + _getNumAsStr(num-900, /*subpart*/true);
  return 'err';
};

/** Supporting While Loop with promises
 * @deprecated Use the module 'promise-while' instead
 * @function promiseWhile
 * @param {Function} condition - function returning a boolean as to whether the loop should run
 * @param {Function} action - function returning a promise and performing the loop action
 */
var promiseWhile = exports.promiseWhile = Promise.method(function(condition, action) {
  if (!condition()) return;
  return action().then(promiseWhile.bind(null, condition, action));
});
// var _promiseFor = Promise.method(function(condition, action, value) {
//   /*assumes that action returns updated value*/
//   if (!condition(value)) return value;
//   return action(value).then(_promiseFor.bind(null, condition, action));
// });
