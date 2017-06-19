
// module.exports = require('./demo1-script.js');
// module.exports = require('./fins-script.js');
// module.exports = require('./sample-tutorial-script.js');
// module.exports = require('./hls-diabetes-script.js');

var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);

var violetSFStore = require('../../lib/violetSFStore.js');

violet.setPersistentStore(violetSFStore.store);

violetSFStore.store.propOfInterest = {
  'doctor': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
}

// mock objects
var response = violet._getResponseForDebugging({
  getSession: ()=>{}
}, {});

// test methods
var storeTest = () => {
  response.set('<<diabetesLog.user>>', 'blah:blah:blah2' );
  response.set('<<diabetesLog.timeOfCheckin>>', 'after-meal' );
  response.set('<<diabetesLog.bloodSugarLvl>>', 125 );
  response.set('<<diabetesLog.feetWounds>>', true );
  response.set('<<diabetesLog.missedDosages>>', false );
  setTimeout(()=>{
    response.store('<<diabetesLog>>');
  }, 2*1000);
};

var loadTest = () => {
  setTimeout(()=>{
    response.load('<<doctor>>', '<<doctor.user>>', 'blah:blah:blah2');
  }, 2*1000);
};

var loadTest2 = () => {
  setTimeout(()=>{
    response.load('<<doctor>>', null, null, null);
  }, 2*1000);
};

var loadTest3 = () => {
  setTimeout(()=>{
    response.load('<<doctor>>', '<<doctor.user>>', 'blah:blah:blah2', 'CreatedDate >= TODAY');
  }, 2*1000);
};

// storeTest();
// loadTest();
// loadTest2();
loadTest2();
