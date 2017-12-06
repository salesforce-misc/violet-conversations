/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */


/**
 * List Widget for Voice - supports the common use case when a user needs to
 * interact with one of multiple items.
 *
 * @module violetList
 *
 * @param {Violet} violet - the pointer to the violet instance so that we can
 *  hook in appropriately to script resources. This plugin does expect that
 *  the calling script defineGoal with goal name as given by the
 *  <code>interactionGoal</code> method.
 * @param {string} widgetType - a string representing the type for the contents
 *  of this widget. This widget is called by setting the list in question with
 *  name being the same as the <code>widgetType</code> and calling the
 *  <code>respondWithItems</code> method.
 * @param {string} humanName - what to refer to an item in this list when
 *  speaking to the user.
 * @param {string} humanNamePl - what to refer to mutliple items in this list
 *  when speaking to the user.
 * @param {string} itemTextProp - how to get the itemText (the main name) of a
 *  list item.
 */

module.exports = (violet, widgetType, humanName, humanNamePl, itemTextProp) => {


  /**
   * Core object returned by the plugin
   *
   * @class
   */
  var listWidget = {
    /**
     * Returns the goal that will be called when the user can interact with an
     * item. This method should be called to define a goal in the parent script.
     */
    interactionGoal: ()=>{
      return `interactWith${widgetType}`;
    },

    /**
     * Returns the text to speak to describe the target itemTextProp. This
     * method is called by the widget and can be redefined to customize the
     * the interaction with the user.
     *
     * @param {number} ndx - what is the item number being spoken
     * @param {Object[]} results - array of items being spoken
     * @returns {string} by default `${humanName} ${ndx+1} is ${results[ndx][itemTextProp]}. `
     */
    getItemText: (ndx, results)=>{
      var listItemObj = results[ndx];
      return `${humanName} ${ndx+1} is ${listItemObj[itemTextProp]}. `;
    },

    /**
     * When this method is called it launches the widget. It lists the first 3
     * items and asks the user it he wants to hear more items or if he wants to
     * interact with an item.
     *
     * @param {response} response - so that the widget can prompt the user
     * @param {Object[]} results - array of items that need to be spoken
     */
    respondWithItems: (response, results)=>{
      var out = 'I found ' + results.length + ' ' + humanNamePl + '. '
      for(var ndx=0; ndx<3 && ndx<results.length; ndx++) {
        out += listWidget.getItemText(ndx, results);
      }
      response.say(out);

      if (results.length>3)
        response.addGoal(`hearPastThree${widgetType}`)
      response.addGoal(`interactWith${widgetType}`)
    },

    /**
     * Used by the widget to list the next 7 items till the 17th item.
     *
     * @param {response} response - so that the widget can prompt the user
     * @param {Object[]} results - array of items that need to be spoken
     * @param {Object[]} start - array of items that need to be spoken
     */
    respondWithMoreItems: (response, results, start=0)=>{
      var out = '';
      for(var ndx=3+start; ndx<10+start && ndx<results.length; ndx++) {
        out += listWidget.getItemText(ndx, results);
      }
      response.say(out);

      if (results.length>10 && start==0) // we dont speak past 17 cases
        response.addGoal(`hearPastTen${widgetType}`)
      response.addGoal(`interactWith${widgetType}`)
    },

    /**
     * Will get an item from the result set, giving an error to the user if the
     * requested item is not in the array.
     *
     * @param {response} response - so that the widget can prompt the user
     * @param {number} itemNo - index of the item to be retrieved
     * @returns {Object} object that is desired or undefined if itemNo is
     *  invalid
     */
    getItemFromResults: (response, itemNo)=>{
      const errMgrNotFoundItems = `Could not find ${humanNamePl}`;
      const errMgrNotFoundTgtItem = `Could not find ${humanName} ${itemNo}`;
      const errMgrInvalidItemNo = `Invalid ${humanName} Number`;
      if (itemNo) {
        itemNo = parseInt(itemNo)-1;
      }
      if (itemNo == undefined || itemNo == null || itemNo<0 || itemNo>17)
        return response.say(errMgrInvalidItemNo);

      var results = response.get(widgetType);
      if (results == undefined || results == null || !Array.isArray(results))
        return response.say(errMgrNotFoundItems);
      if (results.length<itemNo)
        return response.say(errMgrNotFoundTgtItem);

      return results[itemNo];
    }

  };

  violet.defineGoal({
    goal: `hearPastThree${widgetType}`,
    prompt: [`Do you want to hear more ${humanNamePl}?`],
    respondTo: [{
      expecting: ['Yes', 'Hear more'],
      resolve: (response) => {
       response.say(`Getting more ${humanNamePl}.`);
       var results = response.get(widgetType);
       listWidget.respondWithMoreItems(response, results);
    }}, {
      expecting: ['No'],
      resolve: (response) => {
        response.addGoal(`interactWith${widgetType}`);
    }}]
  });

  violet.defineGoal({
    goal: `hearPastTen${widgetType}`,
    prompt: [`Do you want to hear more ${humanNamePl}?`],
    respondTo: [{
      expecting: ['Yes'],
      resolve: (response) => {
       response.say(`Getting more ${humanNamePl}.`);
       var results = response.get(widgetType);
       listWidget.respondWithMoreItems(response, results, 10);
    }}, {
      expecting: ['No'],
      resolve: (response) => {
        response.addGoal(`interactWith${widgetType}`);
    }}]
  });


  return listWidget;

};
