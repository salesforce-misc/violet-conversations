var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violetTime', function() {

  describe('api', function() {

    it('default usage should give current time', function() {
      var violetTime = require('../lib/violetTime')(vh.violet);
      var vTime = violetTime.currentTime();
      assert.equal(new Date().getTime(), vTime.getTime());
      violetTime.clearTimers();
    });

    // hard to test delay and repeat given that they function with delays

  });

  describe('intents', function() {

    it('requesting an advance of 2 hours is acknowledged and time is updated', function() {
      var violetTime = require('../lib/violetTime')(vh.violet);
      vh.initialize();
      return vh.sendIntent('Advance', {time: 2, timeUnit: 'hours'}).then(({rcvdStr, body})=>{
        assert.equal('Advancing in 5 seconds', rcvdStr);

        var vTime = violetTime.currentTime();
        var timeIn2Hours = new Date(Date.now()+2*60*60*1000).getTime();
        assert.equal(timeIn2Hours, vTime.getTime());
        violetTime.clearTimers();
      });
    });

    it('it is possible to get the current time', function() {
      var violetTime = require('../lib/violetTime')(vh.violet);
      vh.initialize();
      return vh.sendIntent('What is the current time').then(({rcvdStr, body})=>{
        assert.ok(rcvdStr.startsWith('The time is currently'));
        violetTime.clearTimers();
      });
    });


  });

});
