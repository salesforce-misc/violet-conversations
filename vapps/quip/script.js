'use strict';

var violet = require('../../lib/violet').script();
var violetTime = require('../../lib/violetTime')(violet);
var violetToDoList = require('../../lib/violetList.js')(violet, 'Items', 'item', 'items', 'text');

var quipSvc = require('./svc.js');
var Promise = require('bluebird');

module.exports = violet;

violet.addInputTypes({
  "itemNo": "NUMBER",
  'itemName': {
      type: 'AMAZON.LITERAL',
      sampleValues: ['Review with Gina', 'Make Presentation', 'Make Poster']
  }
});

// // want to support this script in many forms
// u: Violet, add an item to the Acme Company EBC document
// v: Found the Acme Company EBC document. Which section would you like to update - Financials, EBC Agenda or ToDo?
// u: To Do
// v: Got it. What would you like to add to the checklist in the section ToDo?
// u: Make dinner reservations
// v: Got it. I added the item “make dinner reservations” to the checklist. Anything else?
// u: No thank you

/*
 * Assumptions:
 *  a) One hardcoded document
 *  b) One hardcoded list
 */

var makePretty=(str)=>{
 str = str.trim();
 return str.charAt(0).toUpperCase() + str.slice(1); // first letter uppercase
};

// ToDo - make the below configurable
var tgtDoc = 'Acme Company EBC'
var tgtDocId = 'TddAAATIqbb';
var tgtSec = 'To Do'
violet.respondTo(['add [[itemName]] to the list'],
  (response) => {
    response.say(`Got it. I added [[itemName]] to the checklist. Anything else?`);
    quipSvc.appendItemsToList(tgtDocId, [makePretty(response.get('itemName'))]);
});

violet.respondTo(['whats next {to be done|on my to do}'],
  (response) => {
    return quipSvc.getListItemP(tgtDocId).then((items)=>{
      var nxtItem = items.find(i=>{return (i.done==false);});
      if (!nxtItem) {
        response.say(`There are no items that need to be done on your list`);
        return;
      }
      response.set('tgtItem', nxtItem);
      response.say(`The next item is ${nxtItem.text}`);
    });
});

var ack = (response) => { response.say(['Got it.', 'Great.', 'Awesome']); }

// define the list interactions
violetToDoList.defineItemInteraction({
  prompt: [`Would you like to mark an item as done`],
  respondTo: [{
    expecting: [`mark item [[itemNo]] as {done|checked}`],
    resolve: (response) => {
      var item = violetToDoList.getItemFromResults(response, response.get('itemNo'));
      response.say(`Marking ${item.text} as done`);
      return quipSvc.modifyListItem(tgtDocId, item.id, [`<del>${item.html}</del>`]);
  }}, {
    expecting: ['go back'],
    resolve: function (response) {
      ack(response);
  }}]
});

violet.respondTo(['what all needs to be done', 'what all is open on my to do'],
  (response) => {
    return quipSvc.getListItemP(tgtDocId).then((items)=>{
      items = items.filter(i=>{return (i.done==false);});
      response.set('Items', items);
      violetToDoList.respondWithItems(response, items);
    });
});

violet.respondTo(['whats all is on my to do list'],
  (response) => {
    return quipSvc.getListItemP(tgtDocId).then((items)=>{
      response.set('Items', items);
      violetToDoList.respondWithItems(response, items);
    });
});

violet.respondTo(['mark item as checked'],
  (response) => {
    var tgtItem = response.get('tgtItem');
    if (tgtItem.id && tgtItem.html) {
      response.say(`Marking ${tgtItem.text} as done`);
      // TODO: implement this correctly
      return quipSvc.modifyListItem(tgtDocId, tgtItem.id, [`<del>${tgtItem.html}</del>`]);
    } else
      response.say(`Which item are you referring to`);
});
