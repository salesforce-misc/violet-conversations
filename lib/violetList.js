
/*
 * List Widget for Voice
 */

module.exports = (violet, widgetType, humanName, humanNamePl, itemTextProp) => {


  var listWidget = {
    getItemText: (ndx, results)=>{
      var listItemObj = results[ndx];
      return `${humanName} ${ndx+1} is ${listItemObj[itemTextProp]}. `;
    },

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
    },

    interactionGoal: ()=>{
      return `interactWith${widgetType}`;
    }

  };

  violet.defineGoal({
    goal: `hearPastThree${widgetType}`,
    prompt: [`Do you want to hear more ${humanNamePl}?`],
    respondTo: [{
      expecting: ['Yes'],
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
