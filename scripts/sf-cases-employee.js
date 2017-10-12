'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);
var violetCasesList = require('../lib/violetList.js')(violet, 'Cases', 'case', 'cases');

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'Case*': ['Id*', 'CaseNumber*', 'Contact*.Name*', /*'Contact*.Owner*.Name*',*/ 'Subject*', 'Status*', 'Priority*']
}

violet.addInputTypes({
  "caseNo": "NUMBER",
  "caseStatus": {
    "type": "caseStatusType",
    "values": ["New", "Working", "Escalated", "Closed"]
  },
  "casePriority": {
    "type": "casePriorityType",
    "values": ["Low", "Medium", "High"]
  },
});

// implement login - as a function of how we deploy
const ownerAlias = 'VSinh';


// almost identical to the cases-user example with the query being on an owner instead
violet.respondTo({
  expecting: ['status of my cases'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Owner*.Alias*', ownerAlias);
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
        out += ' ' + status[s] + ' is ' + s;
      else
        out += ' ' + status[s] + ' are ' + s;
      if (ndx == states.length-2)
        out += ' and ';
      else if (ndx < states.length-2)
        out += ','
    });
    response.say(out);
}});

violetCasesList.getItemText = (ndx, results) => {
  var caseObj = results[ndx];
  return 'Result ' + (ndx+1) + ' is ' + caseObj.Subject + ', and has status ' + caseObj.Status + '. ';
}


violet.defineGoal({
  goal: violetCasesList.interactionGoal(),
  prompt: ['Would you like to hear or set the priority, change status, or add a comment along with the case number'],
  respondTo: [{
    expecting: ['{hear|} priority for case [[caseNo]]'],
    resolve: (response) => {
      var caseObj = violetCasesList.getItemFromResults(response, response.get('caseNo'));
      response.say('Case ' + caseObj.Subject + ' has priority ' + caseObj.Priority);
  }}, {
    expecting: ['Set priority for case [[caseNo]] to [[casePriority]]'],
    resolve: function *(response) {
      var caseObj = violetCasesList.getItemFromResults(response, response.get('caseNo'));
      yield response.update('Case*', 'CaseNumber*', caseObj.CaseNumber, {
          'Priority*': response.get('casePriority')
      });
      response.say('Case ' + caseObj.Subject + ' has priority updated to [[casePriority]]');
  }}, {
    expecting: ['Change status for case [[caseNo]] to [[caseStatus]]'],
    resolve: function *(response) {
      var caseObj = violetCasesList.getItemFromResults(response, response.get('caseNo'));
      yield response.update('Case*', 'CaseNumber*', caseObj.CaseNumber, {
          Status: response.get('caseStatus')
      });
      response.say('Case ' + caseObj.Subject + ' has status updated to [[caseStatus]]');
  }}, {
    expecting: ['Add comment to case [[caseNo]] saying {{commentText]]'],
    resolve: function *(response) {
      var caseObj = violetCasesList.getItemFromResults(response, response.get('caseNo'));
      yield response.store('CaseComment*', {
        'CommentBody*': 'Text String',
        'ParentId*': caseObj.Id
      });
      response.say('Case ' + caseObj.Subject + ' has comment added');
  }}]
});


violet.respondTo({
  expecting: ['what are my {open|} cases'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Owner*.Alias*', ownerAlias, "Status <> 'Closed'");
    response.set('CaseResults', results);
    violetCasesList.respondWithItems(response, results);
}});

violet.respondTo({
  expecting: ['what are my [[caseStatus]] cases', 'what cases of mine have status {set to|} [[caseStatus]]'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Owner*.Alias*', ownerAlias, "Status = '" + response.get('caseStatus') + "'");
    response.set('CaseResults', results);
    if (results.length == 0) {
      response.say('Sorry. You have no cases.');
      return;
    }
    violetCasesList.respondWithItems(response, results);
}});

violet.respondTo({
  expecting: ['what are my [[casePriority]] priority cases', 'what cases of mine have priority {set to|} [[casePriority]]'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Owner*.Alias*', ownerAlias, "Priority = '" + response.get('casePriority') + "'");
    response.set('CaseResults', results);
    if (results.length == 0) {
      response.say('Sorry. You have no cases.');
      return;
    }
    violetCasesList.respondWithItems(response, results);
}});

violet.respondTo({
  expecting: ['what cases of mine have status {set to|} [[caseStatus]] and priority {set to|} [[casePriority]]',
              'what cases of mine have priority {set to|} [[casePriority]] and status {set to|} [[caseStatus]]'],
  resolve: function *(response) {
    var results = yield response.load('Case*', 'Owner*.Alias*', ownerAlias, "(Status = '" + response.get('caseStatus') + "' AND Priority = '" + resposne.get('casePriority') +  "')");
    response.set('CaseResults', results);
    if (results.length == 0) {
      response.say('Sorry. You have no cases.');
      return;
    }
    violetCasesList.respondWithItems(response, results);
}});


module.exports = violet;
