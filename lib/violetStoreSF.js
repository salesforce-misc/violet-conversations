var nforce = require('nforce');
var org = nforce.createConnection({
  clientId: process.env.V_SFDC_CLIENT_ID,
  clientSecret: process.env.V_SFDC_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/oauth/_callback',
  // apiVersion: 'v27.0',  // optional, defaults to current salesforce API version
  // environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  autorefresh: true,
  onRefresh: function(newOauth, oldOauth, cb) {
    console.log('*** onRefresh - oldOauth: ', oldOauth);
    console.log('*** onRefresh - newOauth: ', newOauth);
    cb();
  },
  mode: 'single' // optional, 'single' or 'multi' user mode, multi default
});
org.authenticate({ username: process.env.V_SFDC_USERNAME, password: process.env.V_SFDC_PASSWORD}, function(err, resp){
  // the oauth object was stored in the connection object
  if(err) {
    console.log('err: ', err);
    return;
  }

  console.log('SF Cached Token: ' + org.oauth.access_token);
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
  memory: {},
  _objProps: (_objName)=>{
    return sfStore.defaultPropOfInterest.concat(sfStore.propOfInterest[_objName]);
  },
  load:  (objName, keyName, keyVal, filter, queryXtra)=>{
    // console.log('sfStore.load: ' + objName, sfStore._objProps(objName));
    var q = 'SELECT ';
    q+= sfStore._objProps(objName).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
    q+= ' FROM ' + _getCompoundNameToStr(objName);
    if (keyName || filter) q+= ' WHERE';
    if (keyName && keyVal) {
      if (keyName.startsWith(objName))
        q+= ' ' + _getCompoundNameToStr(keyName.substr(objName.length+1)) + ' = \'' + keyVal + '\'';
      else
        q+= ' ' + _getCompoundNameToStr(keyName)+' = \'' + keyVal + '\'';
    }
    if (keyName && keyVal && filter) q+= ' AND'
    if (filter) q+=' ' + filter;
    if (queryXtra) q+=' ' + queryXtra;
    console.log('soql: ' + q);

    return org.query({ query: q }).then(function(resp){
      if (!resp.records) {
        console.log('no results');
        return;
      } else console.log('found ' + resp.records.length + ' records');

      var memRecords = [];
      resp.records.forEach((rec)=>{
        var recStore = {};
        sfStore._objProps(objName).forEach((p)=> {
          _setCompundProperty(recStore, p, _getCompoundProperty(rec,p));
        });
        memRecords.push(recStore);
      });
      sfStore.memory[objName] = memRecords;
      //console.log('sfStore.memory', sfStore.memory);
      return memRecords;
    }).catch((err)=>{
      console.log('sfdc query err', err);
    });
  },
  search: (objName, searchStr)=>{
    // identical to load, except that we have a little more preamble in query,
    // we pull properties from a hardcoded 'search' object, call the method
    // `search` instead of `query` and get results in `searchRecords` instead of
    // `records`
    console.log('sfStore.search: ' + searchStr + ' in ' + objName);
    var q = 'FIND {' + searchStr + '} IN ALL FIELDS RETURNING ' + _getCompoundNameToStr(objName) + '(';
    q+= sfStore._objProps(objName).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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
        sfStore._objProps(objName).forEach((p)=> {
          _setCompundProperty(recStore, p, _getCompoundProperty(rec,p));
        });
        memRecords.push(recStore);
      });
      sfStore.memory[objName] = memRecords;
      //console.log('sfStore.memory', sfStore.memory);
      return memRecords;
    }).catch((err)=>{
      console.log('sfdc search err', err);
    });
  },
  get:   (varName)=>{return sfStore.memory[varName];},
  set:   (varName, val)=>{
    var subObjNdx = varName.indexOf('.');
    if (subObjNdx == -1) {
      sfStore.memory[varName] = val;
      return;
    }
    var tgtObj = sfStore.memory[varName.substr(0,subObjNdx)];
    if (tgtObj == undefined) {
      tgtObj = {};
      sfStore.memory[varName.substr(0,subObjNdx)] = tgtObj;
    }
    tgtObj[varName.substr(subObjNdx+1)] = val;
  },
  clear:   (varName)=>{delete sfStore.memory[varName];},
  store: (objName, optionalData)=>{
    var dl = nforce.createSObject(_getCompoundNameToStr(objName));
    var tgtObj;
    if (optionalData)
      tgtObj = optionalData;
    else
      tgtObj = sfStore.memory[objName]
    // console.log(sfStore.memory);
    console.log('storing: ' + objName, tgtObj);
    for(var key in tgtObj){
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
  update: (objName, keyName, keyVal, updateData)=>{
    // console.log('sfStore.update: ' + objName, sfStore._objProps(objName));
    var q = 'SELECT ';
    q+= sfStore._objProps(objName).map((p)=>{return _getCompoundNameToStr(p);}).join(', ');
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
  return {store: sfStore};
};
