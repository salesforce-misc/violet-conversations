/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

// only load is implemented, need to implement store and update
var pg = require('pg');

var client = null;
if (process.env.DATABASE_URL) {
  client = new pg.Client({
    // connectionString: process.env.DATABASE_URL,
    ssl: true,
  });
} else {
  client = new pg.Client();
}

client.connect();


// a lot of the below can be simplified
var _getCompoundNameToStr = (commonName)=>{
  names = commonName.split('.');
  var ret = '';
  names.forEach((n)=>{
    if (ret.length>0) ret+='.';
    ret+=n;
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
    ret = __nget(ret, p);
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

var pgStore = {
  defaultPropOfInterest: [],
  _objProps: (params)=>{
    var objProps = pgStore.defaultPropOfInterest;
    if (params.objName) objProps = objProps.concat(pgStore.propOfInterest[params.objName]);
    if (params.propOfInterest) objProps = objProps.concat(params.propOfInterest);
    return objProps;
  },
  load:  (params)=>{
    // console.log('pgStore.load: ' + params.objName, pgStore._objProps(params));
    var q = 'SELECT ';
    if (params.query)
      q+=' ' + params.query;
    else
      q+= pgStore._objProps(params).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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

};

// module.exports.store = pgStore;
module.exports = function(violet) {
  if (violet) violet.setPersistentStore(pgStore);
  return {store: pgStore};
};
