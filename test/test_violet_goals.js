var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violet goals', function() {

  describe('response mechanics', function() {

    it('a goals needs to be set for it to be flagged as being set', function() {
      vh.violet.respondTo('Hello', (response) => {
        assert.equal(false, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('once a goals is set they can be checked', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        assert.equal(true, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('once a goals is set and it is cleared they cannot be checked', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        response.clearGoal('welcome');
        assert.equal(false, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });

    it('multiple goals still allow the first goal to be verified', function() {
      vh.violet.respondTo('Hello', (response) => {
        response.addGoal('welcome');
        response.addGoal('inform');
        assert.equal(true, response.hasGoal('welcome'));
      });
      vh.initialize();
      return vh.sendIntent('Hello');
    });


  });

});
