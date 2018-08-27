/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Plugin which makes it easy to store, update, retrieve, and delete data form
 * an underlying Postgres data store.
 * <br><br>
 * You can give the API a SQL query or use one of the easier API's and
 * the plugin will generate the query.
 *
 * @module violetStorePG
 */

// only load is implemented, need to implement store and update
const StorePlugin = require('./storePlugin.js');
var pg = require('pg');

var client = null;
var connectionCB = [];
var _connectToDB = function() {
  if (process.env.DATABASE_URL) {
    client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: true,
    });
  } else {
    client = new pg.Client();
  }

  console.log('Connecting to Postgres');
  return client.connect().then(()=>{
    console.log('Connected to Postgres');
    connectionCB.forEach(cb=>{cb()});
    connectionCB = null;
    return Promise.resolve(client);
  });
}
_connectToDB();


/**
 * Implements support for the core operations supported by Violet (for
 * Postgres).
 */
class VioletStorePG extends StorePlugin {

  constructor(violet) {
    super(violet);
    this.defaultPropOfInterest = [];
  }

  /**
   * Retrieves given object from the underlying data store.
   *
   * @example <caption>performing a raw (SQL) query</caption>
   * resolve: function *(response) {
   *   var results = yield response.load({
   *     query: "CreatedDate, Status, Verified FROM Automated_Tests WHERE Status = 'New'  limit 100"
   *   });
   *   response.say(`Found ${results.length} tests`);
   * });
   *
   * @example <caption>query with parameters as needed</caption>
   * violetSFStore.store.propOfInterest = {
   *   'Automated_Tests': ['Name', 'Status', 'Verified']
   * };
   * ...
   * resolve: function *(response) {
   *   var results = yield response.load({
   *     objName: 'Automated_Tests',
   *     keyName: 'Status',
   *     keyVal: 'New'
   *   });
   *   response.say(`Found ${results.length} tests`);
   * });
   *
   * @example <caption>basic query</caption>
   * violetSFStore.store.propOfInterest = {
   *   'Automated_Tests': ['Name', 'Status', 'Verified']
   * };
   * ...
   * resolve: function *(response) {
   *   var results = yield response.load('Automated_Tests', 'Status', 'New');
   *   response.say(`Found ${results.length} tests`);
   * });
   *
   * @param {Object} queryParams - query parameters
   * @param {string} queryParams.objName - the object/table name in the data
   *   store where the give object is to be updated
   * @param {string} queryParams.keyName - the key name to find the object to be updated
   * @param {string} queryParams.keyVal - the key value to find the object to be updated
   * @param {string} queryParams.query - the SQL query, i.e. what gets executed is "SELECT <query>"
   * @param {string} queryParams.filter - additional query results filter - this
   *  is added to the end of the SQL query
   * @param {string} queryParams.queryXtra - additional additional bits to be
   *  added to the end of the query, for example "LIMIT 100"
   * @returns {Promise} Promise that resolves with the data
   */
  load(params) {
    // console.log('this.load: ' + params.objName, this._objProps(params));
    var q = this._buildQuery(params);
    console.log('sql: ' + q);

    return client.query(q).then(function(resp){
      // console.log(resp);
      if (!resp.rows) {
        console.log('no results');
        return;
      } else console.log('found ' + resp.rows.length + ' records');

      return resp.rows;

    }).catch((err)=>{
      console.log('sfdc query err', err);
    });
  }

  /**
   * Adds given object to the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.store('CaseComment', {
   *     'CommentBody': 'Text String',
   *     'ParentId': caseObj.Id
   *   });
   *   response.say(`Case ${caseObj.Subject} has comment added`);
   * }
   *
   * @param {string} objName - the object/table name in the data store where
   *   the give object is to be stored
   * @param {Object} dataToStore - the object to be written (i.e. a set of
   *   key:value pairs)
   * @returns {Promise} Promise that resolves when the data has been written in
   *   the store
   */
  store(objName, dataToStore) {
    var objKeys = Object.keys(dataToStore);
    var objValues =  objKeys.map(k=>{return dataToStore[k]});
    var insertValues = Object.keys(objKeys).map(k=>{return '$'+(parseInt(k)+1)});
    var insertStmt = `insert into ${this._getCompoundNameToStr(objName)} (${objKeys.join(', ')}) values (${insertValues.join(', ')})`;
    console.log('storing: ' + insertStmt, objValues);
    return client.query({text: insertStmt, values: objValues}).then(()=>{
      console.log('Stored');
    }).catch((err)=>{
      console.log('pg store err', err);
    });
  }

  /**
   * Updates given object in the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.update('Case', 'CaseNumber', caseObj.CaseNumber, {
   *       'Priority': response.get('casePriority')
   *   });
   *   response.say( `Case ${caseObj.Subject} has priority updated to [[casePriority]]`);
   * }
   *
   * @param {string} objName - the object/table name in the data store where
   *   the give object is to be updated
   * @param {string} keyName - the key name to find the object to be updated
   * @param {Object} keyVal - the key value to find the object to be updated
   * @param {Object} updateData - the object values to be updated (i.e. a set of
   *   key:value pairs)
   * @returns {Promise} Promise that resolves when the data has been updated in
   *   the store
   */
  update(objName, keyName, keyVal, updateData) {
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var objKeys = Object.keys(updateData);
    var objValues =  objKeys.map(k=>{return updateData[k]});
    var updateValues = Object.keys(objKeys).map(k=>{return '$'+(parseInt(k)+1)});
    var updateStmt = `UPDATE ${this._getCompoundNameToStr(objName)}
              SET (${objKeys.join(', ')}) = (${updateValues.join(', ')})
              WHERE ${this._getCompoundNameToStr(keyName)} = '${keyVal}'`;

    console.log('updating: ' + updateStmt, objValues);
    return client.query({ text: updateStmt, values: objValues }).then(function(){
      console.log('Updated');
    }).catch((err)=>{
      console.log('pg update err', err);
    });
  }

  /**
   * Deletes given object in the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.update('Case', 'CaseNumber', caseObj.CaseNumber);
   *   response.say( `Case ${caseObj.Subject} has been removed`);
   * }
   *
   * @param {string} objName - the object/table name in the data store where
   *   the give object is to be deleted
   * @param {string} keyName - the key name to find the object to be deleted
   * @param {Object} keyVal - the key value to find the object to be deleted
   * @returns {Promise} Promise that resolves when the data has been deleted in
   *   the store
   */
  delete(objName, keyName, keyVal) {
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var deleteStmt = `Delete FROM ${this._getCompoundNameToStr(objName)}
              WHERE ${this._getCompoundNameToStr(keyName)} = '${keyVal}'`;

    console.log('deleting: ' + deleteStmt);
    return client.query(deleteStmt).then(function(){
      console.log('Deleted');
    }).catch((err)=>{
      console.log('pg delete err', err);
    });
  }


};

// module.exports.store = pgStore;
module.exports = function(violet) {
  var pgStore = new VioletStorePG(violet);
  var connectionsCnt = 0;
  return {
    /** Allows access to the store */
    store: pgStore,
    /**
     * Returns a promise which will resolve with the store having access to the
     * Postgres DB
     */
    connect: ()=>{
      connectionsCnt++;
      if (client == null) return _connectToDB();                  // likely someone already cleaned-up
      if (connectionCB == null) return Promise.resolve(client);   // already connected
      return new Promise(function(resolve, reject) {              // trying to connect - add ourselves to the CB
        connectionCB.push(()=>{resolve(client)});
      });
    },
    /**
     * Close connection to the DB
     */
    cleanup: ()=>{
      connectionsCnt--;
      if (connectionsCnt > 0) return;
      console.log('Cleaning connection to Postgres');
      client.end();
      client = null;
    },
  };
};
