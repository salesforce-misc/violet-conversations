/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Plugin which makes it easy to store, update, and retrieve data form a
 * Salesforce Org.
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


var sfStore = {
  defaultPropOfInterest: ['CreatedDate*'],
  _objProps: (params)=>{
    var objProps = [];
    if (params.objName) objProps = objProps.concat(sfStore.propOfInterest[params.objName]);
    if (params.propOfInterest) objProps = objProps.concat(params.propOfInterest);
    if (objProps.length == 0) return objProps; // return empty array if we don't have a way to get any propOfInterest
    return objProps.concat(sfStore.defaultPropOfInterest);
  },
  /** */
  load:  (params)=>{
    // console.log('sfStore.load: ' + params.objName, sfStore._objProps(params));
    var q = 'SELECT ';
    if (params.query)
      q+=' ' + params.query;
    else
      q+= sfStore._objProps(params).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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
  /** */
  search: (objName, searchStr)=>{
    // identical to load, except that we have a little more preamble in query,
    // we pull properties from a hardcoded 'search' object, call the method
    // `search` instead of `query` and get results in `searchRecords` instead of
    // `records`
    console.log('sfStore.search: ' + searchStr + ' in ' + objName);
    var q = 'FIND {' + searchStr + '} IN ALL FIELDS RETURNING ' + _getCompoundNameToStr(objName) + '(';
    q+= sfStore._objProps({objName}).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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
  /** */
  store: (objName, dataToStore)=>{
    var dl = nforce.createSObject(_getCompoundNameToStr(objName));
    // console.log(dataToStore);
    console.log('storing: ' + objName, dataToStore);
    for(var key in dataToStore){
      dl.set(_getCompoundNameToStr(key), tgtObj[key]);
    }

    org.insert({ sobject: dl }, function(err, resp){
      if(err) {
        console.log('err: ', err);
        return;
      }
      console.log('Stored');
    });
  },
  /** */
  update: (objName, keyName, keyVal, updateData)=>{
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var q = 'SELECT ';
    q+= sfStore._objProps({objName}).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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
};

// module.exports.store = sfStore;
module.exports = function(violet) {
  if (violet) violet.setPersistentStore(sfStore);
  return {
    connected: ()=>{
      if (connectionCB == null) return Promise.resolve();
      return new Promise(function(resolve, reject) {
        connectionCB.push(()=>{resolve()});
      });
    },
    store: sfStore
  };
};
