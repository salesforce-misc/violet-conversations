var Promise = require('bluebird');

exports.getRand =  function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

exports.getNumAsStr = function(num) {
  if (typeof num == 'string') num = parseInt(num);
  if (num<0) return 'err';
  if (num<20) switch(num) {
    case 1: return 'one';
    case 2: return 'two';
    case 3: return 'three';
    case 4: return 'four';
    case 5: return 'five';
    case 6: return 'six';
    case 7: return 'seven';
    case 8: return 'eight';
    case 9: return 'nine';
    case 10: return 'ten';
    case 11: return 'eleven';
    case 12: return 'twelve';
    case 13: return 'thirteen';
    case 14: return 'fourteen';
    case 15: return 'fifteen';
    case 16: return 'sixteen';
    case 17: return 'seventeen';
    case 18: return 'eighteen';
    case 19: return 'nineteen';
  };
  if (num<20+10) return 'twenty ' + _getNumAsStr(num-20);
  if (num<30+10) return 'thirty ' + _getNumAsStr(num-30);
  if (num<40+10) return 'forty ' + _getNumAsStr(num-40);
  if (num<50+10) return 'fifty ' + _getNumAsStr(num-50);
  if (num<60+10) return 'sixty ' + _getNumAsStr(num-60);
  if (num<70+10) return 'seventy ' + _getNumAsStr(num-70);
  if (num<80+10) return 'eighty ' + _getNumAsStr(num-80);
  if (num<90+10) return 'ninety ' + _getNumAsStr(num-90);
  if (num<100+100) return 'one hunder ' + _getNumAsStr(num-100);
  if (num<200+100) return 'two hunder ' + _getNumAsStr(num-200);
  if (num<300+100) return 'three hunder ' + _getNumAsStr(num-300);
  if (num<400+100) return 'four hunder ' + _getNumAsStr(num-400);
  if (num<500+100) return 'five hunder ' + _getNumAsStr(num-500);
  if (num<600+100) return 'six hunder ' + _getNumAsStr(num-600);
  if (num<700+100) return 'seven hunder ' + _getNumAsStr(num-700);
  if (num<800+100) return 'eight hunder ' + _getNumAsStr(num-800);
  if (num<900+100) return 'nine hunder ' + _getNumAsStr(num-900);
};

var promiseWhile = exports.promiseWhile = Promise.method(function(condition, action) {
  if (!condition()) return;
  return action().then(promiseWhile.bind(null, condition, action));
});
// var _promiseFor = Promise.method(function(condition, action, value) {
//   /*assumes that action returns updated value*/
//   if (!condition(value)) return value;
//   return action(value).then(_promiseFor.bind(null, condition, action));
// });
