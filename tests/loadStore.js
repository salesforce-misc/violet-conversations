
var violet = require('../../lib/violet.js')('einstein');
var violetUtils = require('../../lib/violetUtils.js')(violet);

var violetSFStore = require('../../lib/violetSFStore.js');

violet.setPersistentStore(violetSFStore.store);

violetSFStore.store.propOfInterest = {
  'diabetesLog': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
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
    response.load('<<diabetesLog>>', '<<diabetesLog.user>>', 'blah:blah:blah2');
  }, 2*1000);
};

var loadTest2 = () => {
  setTimeout(()=>{
    response.load('<<diabetesLog>>', null, null, 'CreatedDate < TODAY');
  }, 2*1000);
};

var loadTest3 = () => {
  setTimeout(()=>{
    response.load('<<diabetesLog>>', '<<diabetesLog.user>>', 'blah:blah:blah2', 'CreatedDate < TODAY');
  }, 2*1000);
};

// storeTest();
// loadTest();
// loadTest2();
loadTest3();
