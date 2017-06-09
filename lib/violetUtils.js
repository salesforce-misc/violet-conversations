
module.exports = (violet) => {
  var simulatedTimeDeltaInMinutes = 0;

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
        _addRepeatingTimedAlert(currTimeInMin+ta.repeatInMin, ta.repeatInMin, resolve);
    }
  };

  var _repeatedCheckLength = 60*60*1000; // check every hour
  var _repeatedCheckForAlerts = () => {
    _checkForAlerts();
    setTimeout(_repeatedCheckForAlerts, _repeatedCheckLength);
  };
  setTimeout(_repeatedCheckForAlerts, _repeatedCheckLength);


  violet.addKeyTypes({
    "time": "NUMBER",
    "timeUnit": {
      "type": "timeUnitType",
      "values": ["days", "hours", "minutes"]
    },
  });

  violet.respondTo("What is the current time", (response)=>{
    var time = _currentTime();
    response.out(`The time is currently ${time.getHours()} hours and ${time.getMinutes()} minutes`);
  });

  violet.respondTo([
        "Advance ((time)) ((timeUnit))"
      ], (response) => {
    var time = parseInt(response.get('((time))') );
    switch (response.get('((timeUnit))') ) {
      case 'days':    simulatedTimeDeltaInMinutes += 24*60*timeUnit; break;
      case 'hours':   simulatedTimeDeltaInMinutes += 60*timeUnit; break;
      case 'minutes': simulatedTimeDeltaInMinutes += timeUnit;
    };
    response.say(["Advancing in 5 seconds"]);
    setTimeout(()=>{
      _checkForAlerts();
    }, 5*1000)
  });

  return {
    currentTime: () => { return _currentTime(); },

    delay: (timeInMinutes, resolve) => {
      _addTimedAlert(_currentTimeInMin()+timeInMinutes, resolve);
    },

    repeat: (timeInMinutes, resolve) => {
      _addRepeatingTimedAlert(_currentTimeInMin()+timeInMinutes, timeInMinutes, resolve);
    }

  };
};
