/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */


/**
 * Plugin which automatically provides support for the current time and
 * simulation to advance it for testing purposes
 * @module violetTime
 */

module.exports = (violet) => {
  var simulatedTimeDeltaInMinutes = 0;

  var timerMgr = {
    timers: [],

    // setTimeout takes delay as the first parameter - it is more uniform to have cb as last parameter
    setTimeout: (delay, cb) => {
      var timer = setTimeout(()=>{timerMgr.done(timer);cb();}, delay);
      timerMgr.timers.push(timer);
    },
    done: (timer) => {
      var timerNdx = timerMgr.timers.indexOf(timer);
      if (timerNdx != -1) timerMgr.timers.splice(timerNdx, 1);
    },
    clear: () => {
      timerMgr.timers.forEach(timer=>{
        clearTimeout(timer);
      });
    }
  };

  var _currentTime = ()=>{
    return new Date(Date.now() + simulatedTimeDeltaInMinutes*60*1000);
  };
  var _currentTimeInMin = ()=>{
    return Date.now()/60*1000 + simulatedTimeDeltaInMinutes;
  };

  var timedAlerts = [];

  var _addTimedAlert = (tgtTimeInMinutes, resolve) => {
    _addRepeatingTimedAlert(tgtTimeInMinutes, -1, resolve);
  };
  var _addRepeatingTimedAlert = (tgtTimeInMinutes, repeatInMin, resolve) => {
    if (tgtTimeInMinutes<_currentTimeInMin) {
      console.log('*** ERR: Tried to schedule alert in past');
      return;
    }
    timedAlerts.push({tgtTimeInMinutes, repeatInMin, resolve});
  };

  var _checkForAlerts = () => {
    var currTimeInMin = _currentTimeInMin();
    var ndx=0;
    while(ndx<timedAlerts.length) {
      var ta = timedAlerts[ndx];
      if (ta.tgtTimeInMinutes>currTimeInMin) {
        ndx++;
        continue;
      }
      ta.resolve();
      timedAlerts.splice(ndx, 1);
      if (ta.repeatInMin>0)
        _addRepeatingTimedAlert(currTimeInMin+ta.repeatInMin, ta.repeatInMin, ta.resolve);
    }
  };

  var _repeatedCheckLength = 60*60*1000; // check every hour
  var timeoutId = -1;
  var _repeatedCheckForAlerts = () => {
    _checkForAlerts();
    timerMgr.setTimeout(_repeatedCheckLength, _repeatedCheckForAlerts);
  };
  timerMgr.setTimeout(_repeatedCheckLength, _repeatedCheckForAlerts);


  violet.addInputTypes({
    "time": "NUMBER",
    "timeUnit": {
      "type": "timeUnitType",
      "values": ["days", "hours", "minutes"]
    },
  });

  /**
   * Returns the current time to end-users
   */
  violet.respondTo({
    name: 'timeReq',
    expecting: "What is the current time",
    resolve: (response)=>{
      var time = _currentTime();
      response.say(`The time is currently ${time.getHours()} hours and ${time.getMinutes()} minutes`);
  }});

  /**
   * Advances the current time for development purposes
   */
  violet.respondTo({
    name: 'timeFwd',
    expecting: "Advance [[time]] [[timeUnit]]",
    resolve: (response) => {
      var time = parseInt(response.get('time') );
      switch (response.get('timeUnit') ) {
        case 'days':    simulatedTimeDeltaInMinutes += 24*60*time; break;
        case 'hours':   simulatedTimeDeltaInMinutes += 60*time; break;
        case 'minutes': simulatedTimeDeltaInMinutes += time;
      };
      response.say(["Advancing in 5 seconds"]);
      timerMgr.setTimeout(5*1000, ()=>{
        _checkForAlerts();
      });
  }});

  return {
    /**
     * Returns the current time incremented by any amount of delay that has
     * been requested.
     * @returns {Date}
     */
    currentTime: () => { return _currentTime(); },

    /**
     * Calls back after a certain amount of time has passed.
     */
    delay: (timeInMinutes, resolve) => {
      _addTimedAlert(_currentTimeInMin()+timeInMinutes, resolve);
    },

    /**
     * Calls back repeatedly after a certain amount of time has passed.
     */
    repeat: (timeInMinutes, resolve) => {
      _addRepeatingTimedAlert(_currentTimeInMin()+timeInMinutes, timeInMinutes, resolve);
    },

    /**
     * Clears any times that might be running (violetTime sets up a time to run
     * once every hour).
     */
    clearTimers: () => {
      timerMgr.clear();
    }

  };
};
