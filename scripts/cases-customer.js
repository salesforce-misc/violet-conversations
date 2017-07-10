'use strict';

var violet = require('../lib/violet.js')('einstein');
var violetUtils = require('../lib/violetUtils.js')(violet);

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'Case*': ['CaseNumber*', 'Contact*.Name*', /*'Contact*.Owner*.Name*',*/ 'Subject*', 'Status*', 'Priority*']
}

violet.addKeyTypes({
  "name": "AMAZON.LITERAL",
  "company": "AMAZON.LITERAL",
  "opportunityName": "AMAZON.LITERAL",
});

// implement login - as a function of how we deploy
const userName = 'Stella Pavlova';


violet.respondTo({
  expecting: ['status of my cases'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Contact*.Name*', userName);
    if (results.length == 0) {
      response.say('Sorry. You have no cases.');
      return;
    }

    // iterate through results and collect states in object 'status'
    var status = {};
    results.forEach((c)=>{
      if (!status[c.Status]) status[c.Status] = 0;
      status[c.Status]++;
    });

    var out = 'You have ' + results.length + ' cases. Of these'
    var states = Object.keys(status);
    states.forEach((s,ndx)=>{
      if (status[s]==1)
        out += status[s] + ' is ' + s;
      else
        out += status[s] + ' are ' + s;
      if (ndx == states.length-2) out += ' and ';
    });
    response.say(out);
}});


violet.respondTo({
  expecting: ['which case of mine changed states most recently'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Contact*.Name*', 'Stella Pavlova', null, 'order by LastModifiedDate limit 1')
    if (results.length == 0) {
      response.say('Sorry. You have no cases.');
      return;
    }
    var case = results[0];
    response.say('Your case ' + case.Subject + ' has status ' + case.Status + ' and priority ' + case.Priority);
}});

violet.respondTo({
  expecting: ['tell me when one of my cases changes state'],
  resolve: function *(response) {
    response.say('Sure');
    // TODO: put a hook in sfdc, when we hear back, do the below (and test that it works)
    // TODO: test and implement below
    //violet.sendAlertMessage('One of your cases has changed state');
    //... in violet implennt as `_setAlert('{{message}}')` and have callback to clear

}

violet.registerIntents();

module.exports = violet;
