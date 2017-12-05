var co = require('co');
var assert = require('assert');
var vh = require('./violetHelper.js');
var storeHelper = require('./violetStoreHelper.js');

describe('violetStorePG', function() {
  this.timeout(10*1000);

  var initDB = (violetStorePG) => {
    return violetStorePG.connect().then((pgClient)=>{
      // check if the type has been created
      return pgClient.query("select * from pg_type where typname = 'states'").then((results)=>{
        // create type if needed
        if (results.rows.length==0)
          return pgClient.query("create type states as enum ('New', 'Waiting', 'Running', 'Failed', 'Passed')");
      }).then(()=>{
        // create table if needed
        return pgClient.query(`
          create table if not exists Automated_Tests
            (Id serial primary key, Name text, Status States, Verified boolean)
          `);
      });
    });
  }


  describe('basic crud support', function() {

    it('should be able to create a record and read to verify that it has been inserted', function() {
      var violetStorePG = require('../lib/violetStorePG')(vh.violet);
      violetStorePG.store.propOfInterest = {
        'Automated_Tests': ['Name', 'Status', 'Verified']
      };
      vh.violet.respondTo('Hello', function (response) {
        response.say('Hi');
        return co(storeHelper.testCRUD({response, jsTx: (x)=>{return x.toLowerCase()}}));
      });
      vh.initialize();
      return initDB(violetStorePG).then(()=>{
        return vh.sendIntent('Hello');
      }).then(({rcvdStr, body})=>{
        console.log('Received: ' + rcvdStr);
        assert.equal('Hi', rcvdStr);

        violetStorePG.cleanup();
      });

    });

  });


});
