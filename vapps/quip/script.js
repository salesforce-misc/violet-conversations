'use strict';

var violet = require('../../lib/violet').script();
var violetTime = require('../../lib/violetTime')(violet);
var quipSvc = require('./svc.js');
var Promise = require('bluebird');

module.exports = violet;

violet.addInputTypes({
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

violet.respondTo(['whats next on my to do'],
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
