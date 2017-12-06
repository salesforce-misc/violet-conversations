/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Plugin which makes it easy to store, update, retrieve, and delete data form
 * an underlying data store, i.e. a Salesforce Org. Additionally there is
 * some support for performing and returning search results as well.
 * <br><br>
 * You can give the API a SOQL query or use one of the easier API's and
 * the plugin will generate the query.
 * <br><br>
 * When giving accessing the api's using a '*' at the end of an object name
 * or object data key is used to indicate a built-in attribute for Force.com;
 * attributes are otherwise assumed to be custom and have a '__c' added to
 * them.
 *
 * @module violetStoreSF
 */

var nforce = require('nforce');
var org = nforce.createConnection({
  clientId: process.env.V_SFDC_CLIENT_ID,
  clientSecret: process.env.V_SFDC_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/oauth/_callback',
  // apiVersion: 'v27.0',  // optional, defaults to current salesforce API version
  // environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  autoRefresh: true,
  onRefresh: function(newOauth, oldOauth, cb) {
    console.log('SF Refresh Access Token - old: ', oldOauth.access_token);
    console.log('SF Refresh Access Token - new: ', newOauth.access_token);
    cb();
  },
  mode: 'single' // optional, 'single' or 'multi' user mode, multi default
});
var connectionCB = [];
org.authenticate({ username: process.env.V_SFDC_USERNAME, password: process.env.V_SFDC_PASSWORD}, function(err, resp){
  // the oauth object was stored in the connection object
  if (err) {
    console.log('err: ', err);
    return;
  }

  console.log('SF Access Token: ' + org.oauth.access_token);
  connectionCB.forEach(cb=>{cb()});
  connectionCB = null;
});

const builtIn='*';

var _nameToStr = (commonName)=>{
  if (commonName.endsWith(builtIn))
    return commonName.slice(0,-builtIn.length);
  else
    return commonName+'__c';
};

var _getCompoundNameToStr = (commonName)=>{
  names = commonName.split('.');
  var ret = '';
  names.forEach((n)=>{
    if (ret.length>0) ret+='.';
    ret+=_nameToStr(n);
  });
  return ret;
};
var _getCompoundProperty = (obj, prop)=>{
  var __nget=(o,p)=>{
    if (o==null) {
      console.log('Trying to get property: ' + prop + ' from null');
      return null;
    }
    if (o.get)
      return o.get(p);
    else
      return o[p];
  }
  var ret = obj;
  propItems = prop.split('.');
  propItems.forEach((p, ndx)=>{
    ret = __nget(ret, _nameToStr(p));
  });
  return ret;
}
var _setCompundProperty = (obj, prop, val)=>{
  prop = prop.replace(/\*/g,'');  // strip the built-in property differentiator
  propItems = prop.split('.');
  var lastObj = null;
  propItems.forEach((p, ndx)=>{
    lastObj = obj;
    if (obj[p]==undefined) obj[p]={};
    obj = obj[p];
  });
  lastObj[propItems[propItems.length-1]] = val;
}
var _dedupe = (ary)=>{
  return ary.sort().filter((item, ndx, _ary)=>{
    if (ndx!=0 && item == ary[ndx-1]) return false;
    return true;
  });
}


/**
 * Implements support for the core operations supported by Violet (for
 * Force.com).
 *
 * @class
 */
var sfStore = {
  defaultPropOfInterest: ['Id*', 'CreatedDate*'],
  _objProps: (params)=>{
    var objProps = [];
    if (params.objName) objProps = objProps.concat(sfStore.propOfInterest[params.objName]);
    if (params.propOfInterest) objProps = objProps.concat(params.propOfInterest);
    if (objProps.length == 0) return objProps; // return empty array if we don't have a way to get any propOfInterest
    return objProps.concat(sfStore.defaultPropOfInterest);
  },

  /**
   * Retrieves given object from the underlying data store.
   *
   * @example <caption>performing a raw (SOQL) query</caption>
   * resolve: function *(response) {
   *   var results = yield response.load({
   *     query: "CreatedDate, Status__c, Verified__c FROM Automated_Tests__c WHERE Status__c = 'New'  limit 100"
   *   });
   *   response.say(`Found ${results.length} tests`);
   * });
   *
   * @example <caption>query with parameters as needed</caption>
   * violetSFStore.store.propOfInterest = {
   *   'Automated_Tests': ['Name*', 'Status', 'Verified']
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
   *   'Automated_Tests': ['Name*', 'Status', 'Verified']
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
   * @param {string} queryParams.query - the SOQL query, i.e. what gets executed is "SELECT <query>"
   * @param {string} queryParams.filter - additional query results filter - this
   *  is added to the end of the SQL query
   * @param {string} queryParams.queryXtra - additional additional bits to be
   *  added to the end of the query, for example "LIMIT 100"
   * @returns {Promise} Promise that resolves with the data
   */
  load:  (params)=>{
    // console.log('sfStore.load: ' + params.objName, sfStore._objProps(params));
    var q = 'SELECT ';
    if (params.query)
      q+=' ' + params.query;
    else
      q+= _dedupe(sfStore._objProps(params).map((p)=>{return _getCompoundNameToStr(p);})).join(', ');
    if (params.objName)
      q+= ' FROM ' + _getCompoundNameToStr(params.objName);
    if (params.keyName || params.filter) q+= ' WHERE';
    if (params.keyName && params.keyVal) {
      if (params.keyName.startsWith(params.objName))
        q+= ' ' + _getCompoundNameToStr(params.keyName.substr(params.objName.length+1)) + ' = \'' + params.keyVal + '\'';
      else
        q+= ' ' + _getCompoundNameToStr(params.keyName)+' = \'' + params.keyVal + '\'';
    }
    if (params.keyName && params.keyVal && params.filter) q+= ' AND'
    if (params.filter) q+=' ' + params.filter;
    if (params.queryXtra) q+=' ' + params.queryXtra;
    console.log('soql: ' + q);

    return org.query({ query: q }).then(function(resp){
      if (!resp.records) {
        console.log('no results');
        return;
      } else console.log('found ' + resp.records.length + ' records');

      var objProperties = sfStore._objProps(params);
      if (objProperties.length==0) {
        // we can't convert to js object
        return resp.records;
      }

      var memRecords = [];
      resp.records.forEach((rec)=>{
        var recStore = {};
        objProperties.forEach((p)=> {
          _setCompundProperty(recStore, p, _getCompoundProperty(rec,p));
        });
        memRecords.push(recStore);
      });
      //console.log('memRecords', memRecords);
      return memRecords;
    }).catch((err)=>{
      console.log('sfdc query err', err);
    });
  },

  /**
   * Does a search
   *
   * @example
   * violetSFStore.store.propOfInterest = {
   *  'KnowledgeArticleVersion*': ['Id*', 'Title*', 'Summary*', 'UrlName*', 'LastPublishedDate*']
   * }
   * ...
   * yield violetSFStore.store.search('KnowledgeArticleVersion*', 'security')
   *
   * @param {string} objName - the object/table name which is to be searched
   * @param {string} searchStr - the search string to look up
   * @returns {Promise} Promise that resolves when the data has been found
   */
  search: (objName, searchStr)=>{
    // identical to load, except that we have a little more preamble in query,
    // we pull properties from a hardcoded 'search' object, call the method
    // `search` instead of `query` and get results in `searchRecords` instead of
    // `records`
    console.log('sfStore.search: ' + searchStr + ' in ' + objName);
    var q = 'FIND {' + searchStr + '} IN ALL FIELDS RETURNING ' + _getCompoundNameToStr(objName) + '(';
    q+= _dedupe(sfStore._objProps({objName}).map((p)=>{return _getCompoundNameToStr(p);})).join(', ');
    q+=" WHERE PublishStatus='Online' AND LANGUAGE ='en_US')"
    console.log('sosl: ' + q);

    return org.search({ search: q/*, raw: true*/ }).then(function(resp){
      // console.log(resp);
      if (!resp.searchRecords) {
        console.log('no results');
        return;
      } else console.log('found ' + resp.searchRecords.length + ' records');

      var memRecords = [];
      resp.searchRecords.forEach((rec)=>{
        var recStore = {};
        sfStore._objProps({objName}).forEach((p)=> {
          _setCompundProperty(recStore, p, _getCompoundProperty(rec,p));
        });
        memRecords.push(recStore);
      });
      //console.log('memRecords', memRecords);
      return memRecords;
    }).catch((err)=>{
      console.log('sfdc search err', err);
    });
  },

  /**
   * Adds given object to the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.store('CaseComment*', {
   *     'CommentBody*': 'Text String',
   *     'ParentId*': caseObj.Id
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
  store: (objName, dataToStore)=>{
    var dl = nforce.createSObject(_getCompoundNameToStr(objName));
    // console.log(dataToStore);
    console.log('storing: ' + objName, dataToStore);
    for(var key in dataToStore){
      dl.set(_getCompoundNameToStr(key), dataToStore[key]);
    }

    return org.insert({ sobject: dl }).then(()=>{
      console.log('Stored');
    });
  },

  /**
   * Updates given object in the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.update('Case*', 'CaseNumber*', caseObj.CaseNumber, {
   *       'Priority*': response.get('casePriority')
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
  update: (objName, keyName, keyVal, updateData)=>{
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var q = 'SELECT ';
    q+= _dedupe(sfStore._objProps({objName}).map((p)=>{return _getCompoundNameToStr(p);})).join(', ');
    q+= ' FROM ' + _getCompoundNameToStr(objName);
    q+= ' WHERE ';
    if (keyName.startsWith(objName))
      q+= _getCompoundNameToStr(keyName.substr(objName.length+1)) + ' = \'' + keyVal + '\'';
    else
      q+= _getCompoundNameToStr(keyName)+' = \'' + keyVal + '\'';
    q+=' LIMIT 1';
    console.log('soql: ' + q);

    return org.query({ query: q }).then(function(resp){
      if (!resp.records || resp.records.length == 0) {
        console.log('no results');
        return;
      }

      var dbObj = resp.records[0];

      console.log('query succeded... updating: ' + objName, updateData);
      for(var key in updateData){
        dbObj.set(_getCompoundNameToStr(key), updateData[key]);
      }

      return org.update({ sobject: dbObj }).then(()=>{ console.log('Updated'); });

    }).catch((err)=>{
      console.log('sfdc update err', err);
    });
  },

  /**
   * Deletes given object in the underlying data store.
   *
   * @example
   * resolve: function *(response) {
   *   var caseObj = ...
   *   yield response.update('Case*', 'CaseNumber*', caseObj.CaseNumber);
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
  delete: (objName, keyName, keyVal)=>{
    // console.log('sfStore.delete: ' + objName, sfStore._objProps({objName}));
    var q = 'SELECT ';
    q+= _dedupe(sfStore._objProps({objName}).map((p)=>{return _getCompoundNameToStr(p);})).join(', ');
    q+= ' FROM ' + _getCompoundNameToStr(objName);
    q+= ' WHERE ';
    if (keyName.startsWith(objName))
      q+= _getCompoundNameToStr(keyName.substr(objName.length+1)) + ' = \'' + keyVal + '\'';
    else
      q+= _getCompoundNameToStr(keyName)+' = \'' + keyVal + '\'';
    q+=' LIMIT 1';
    console.log('soql: ' + q);

    return org.query({ query: q }).then(function(resp){
      if (!resp.records || resp.records.length == 0) {
        console.log('no results');
        return;
      }

      var dbObj = resp.records[0];

      console.log('query succeded... updating: ' + objName);

      return org.delete({ sobject: dbObj }).then(()=>{ console.log('Deleted'); });

    }).catch((err)=>{
      console.log('sfdc delete err', err);
    });
  },
};

module.exports = function(violet) {
  if (violet) violet.setPersistentStore(sfStore);
  return {
    /**
     * Returns a promise which will resolve with the store having access to the
     * Salesforce API's
     */
    connected: ()=>{
      if (connectionCB == null) return Promise.resolve();
      return new Promise(function(resolve, reject) {
        connectionCB.push(()=>{resolve()});
      });
    },
    /** Allows access to the store */
    store: sfStore
  };
};
