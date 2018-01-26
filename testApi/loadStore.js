/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */


var violet = require('../../lib/violet.js').script();
var violetTime = require('../../lib/violetTime.js')(violet);

var violetSFStore = require('../../lib/violetSFStore.js');

violet.setPersistentStore(violetSFStore.store);

violetSFStore.store.propOfInterest = {
  'diabetesLog': ['user', 'timeOfCheckin', 'bloodSugarLvl', 'feetWounds', 'missedDosages']
}

// mock objects
var response = new Response(violet, {
  getSession: ()=>{}
}, {});

// test methods
var storeTest = () => {
  setTimeout(()=>{
    response.store('diabetesLog', {
      user: 'blah:blah:blah2',
      timeOfCheckin: 'after-meal',
      bloodSugarLvl: 125,
      feetWounds: true,
      missedDosages: false
    });
  }, 2*1000);
};

var loadTest = () => {
  setTimeout(()=>{
    response.load({objName: 'diabetesLog', keyName: 'diabetesLog.user', keyVal: 'blah:blah:blah2'});
  }, 2*1000);
};

var loadTest2 = () => {
  setTimeout(()=>{
    response.load({objName: 'diabetesLog', filter: 'CreatedDate < TODAY'});
  }, 2*1000);
};

var loadTest3 = () => {
  setTimeout(()=>{
    response.load({objName: 'diabetesLog', keyName: 'diabetesLog.user', keyVal: 'blah:blah:blah2', filter: 'CreatedDate < TODAY'});
  }, 2*1000);
};

// storeTest();
// loadTest();
// loadTest2();
loadTest3();
