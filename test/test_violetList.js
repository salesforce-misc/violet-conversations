var assert = require('assert');
var vh = require('./violetHelper.js');

var basicListDef = (violet)=>{
  var daysList = require('../lib/violetList-api')(violet, 'Days', 'day', 'days', 'dayStr');
  vh.violet.addInputTypes({
    "dayNo": "NUMBER"
  });
  vh.violet.defineGoal({
    goal: daysList.interactionGoal(),
    prompt: ['Would you like to hear the length of a day, available time for a day'],
    respondTo: [{
      expecting: ['{hear|} length of day [[dayNo]]'],
      resolve: (response) => {
        var dayObj = daysList.getItemFromResults(response, response.get('dayNo'));
        response.say(dayObj.dayStr + ' has length ' + dayObj.day.length);
    }},{
      expecting: ['{hear|} available time for day [[dayNo]]'],
      resolve: (response) => {
        var dayObj = daysList.getItemFromResults(response, response.get('dayNo'));
        if (dayObj.availTime > 1)
          response.say(`${dayObj.dayStr} has ${dayObj.availTime} slots available`);
        else
          response.say(`${dayObj.dayStr} has only ${dayObj.availTime} slot available`);
    }}]
  });
  vh.violet.respondTo('Schedule a repeating meeting', (response) => {
    response.say('Which day would you like that for');
    var days = [];
    var addDay = (dayStr, availTime) => { days.push({dayStr, availTime})};
    addDay('Monday', 4+2);
    addDay('Tuesday', 4);
    addDay('Wednesday', 4+2);
    addDay('Thursday', 4);
    addDay('Friday', 4+2);
    addDay('Saturday', 1);
    addDay('Saunday', 1);
    response.set('Days', days);
    daysList.respondWithItems(response, days);
  });
}


describe('violet list', function() {
  // this.timeout(10*10*60*1000);

  it('can use the list widget to hear items', function() {
    basicListDef(vh.violet);
    vh.initialize();
    return vh.sendIntent('Schedule a repeating meeting').then(({rcvdStr, sessionAttributes, body})=>{
      // console.log(rcvdStr);
      assert.equal(rcvdStr, 'Which day would you like that for <break time="500ms"/>  I found 7 days. day 1 is Monday. day 2 is Tuesday. day 3 is Wednesday.  <break time="500ms"/> Would you like to hear the length of a day, available time for a day or Do you want to hear more days?');
      return vh.sendIntent('Hear more', null, sessionAttributes);
    }).then(({rcvdStr, body})=>{
      // console.log(rcvdStr);
      assert.equal(rcvdStr, 'Getting more days. <break time="500ms"/>  day 4 is Thursday. day 5 is Friday. day 6 is Saturday. day 7 is Saunday.  <break time="500ms"/> Would you like to hear the length of a day, available time for a day');
    });
  });

  it('can use the list widget to interact with items', function() {
    basicListDef(vh.violet);
    vh.initialize();
    return vh.sendIntent('Schedule a repeating meeting').then(({rcvdStr, sessionAttributes, body})=>{
      // console.log(rcvdStr);
      assert.equal(rcvdStr, 'Which day would you like that for <break time="500ms"/>  I found 7 days. day 1 is Monday. day 2 is Tuesday. day 3 is Wednesday.  <break time="500ms"/> Would you like to hear the length of a day, available time for a day or Do you want to hear more days?');
      return vh.sendIntent('available time for day', {dayNo: 1}, sessionAttributes);
    }).then(({rcvdStr, body})=>{
      // console.log(rcvdStr);
      assert.equal(rcvdStr, 'Monday has 6 slots available');
    });
  });


});
