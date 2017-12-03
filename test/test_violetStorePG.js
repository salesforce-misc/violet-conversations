var co = require('co');
var assert = require('assert');
var vh = require('./violetHelper.js');

describe('violetStorePG', function() {
  this.timeout(10*1000);

  var initDB = (pgClient) => {
    // check if the type has been created
    return pgClient.query("select * from pg_type where typname = 'states'").then((results)=>{
      // create type if needed
      if (results.rows.length==0)
        return violetStorePG.client.query("create type states as enum ('New', 'Waiting', 'Running', 'Failed', 'Passed')");
      else
        return Promise.resolve();
    }).then(()=>{
      // create table if needed
      return pgClient.query(`
        create table if not exists Automated_Tests
          (Id serial primary key, Name text, Status States, Verified boolean)
        `);
    });
  }


  describe('basic crud support', function() {

    it('should be able to create a record and read to verify that it has been inserted', function() {
      var violetStorePG = require('../lib/violetStorePG')(vh.violet);
      violetStorePG.store.propOfInterest = {
        'Automated_Tests': ['Name', 'Status', 'Verified']
      };
      vh.violet.respondTo('Hello', function* (response) {
        response.say('Hi');
        var recName = `Important Record: ${Math.round(Math.random()*1000*1000)}`
        // var results = yield response.load('Automated_Tests', 'Status', 'New');
        // console.log('results: ', results);
        // assert.ok(Array.isArray(results));

        // Create
        yield response.store('Automated_Tests', {
          'Name': recName,
          Status: 'New',
          Verified: true
        });
        // Read
        var results = yield response.load({
          objName: 'Automated_Tests',
          keyName: 'Name',
          keyVal: recName
        });
        console.log('results: ', results);
        assert.ok(Array.isArray(results));
        assert.ok(results.length==1);
        assert.equal(results[0].name,recName);

        // Update
        yield response.update('Automated_Tests', 'Name', recName, {'Status': 'Running'});
        results = yield response.load({
          objName: 'Automated_Tests',
          keyName: 'Name',
          keyVal: recName
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
        assert.ok(results.length==1);
        assert.equal(results[0].status,'Running');

        // Delete
        yield response.delete('Automated_Tests', 'Name', recName, {'Status': 'Running'});
        results = yield response.load({
          objName: 'Automated_Tests',
          keyName: 'Name',
          keyVal: recName
        });
        // console.log('results: ', results);
        assert.ok(Array.isArray(results));
        assert.ok(results.length==0);

      });
      vh.initialize();
      return initDB(violetStorePG.client).then(()=>{
        return vh.sendIntent('Hello');
      }).then(({rcvdStr, body})=>{
        console.log('Received: ' + rcvdStr);
        assert.equal('Hi', rcvdStr);

        violetStorePG.client.end();
      }).catch(err=>{
        console.log('err', err, err.stack)
      });


    });

  });


});
