var nforce = require('nforce');
var org = nforce.createConnection({
  clientId: '3MVG9CEn_O3jvv0xvI7vP9xy6IOxenZhffeVUMDB4em7lwBscmoOiEppz0vvG1aPnxkfNutT33UT0kIS2lkpP',
  clientSecret: '5942961125728216688',

  redirectUri: 'http://localhost:3000/oauth/_callback',
  // apiVersion: 'v27.0',  // optional, defaults to current salesforce API version
  // environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  mode: 'single' // optional, 'single' or 'multi' user mode, multi default
});
org.authenticate({ username: 'hls-test@salesforce.com', password: 's@lesforce1'}, function(err, resp){
  // the oauth object was stored in the connection object
  if(err) {
    console.log('err: ', err);
    return;
  }

  console.log('Cached Token: ' + org.oauth.access_token);


});

var sfStore = {
  memory: {},
  load:  (objName, keyName, keyVal, filter)=>{
    console.log(objName);
    var q = 'SELECT';
    var propOfInterest = sfStore.propOfInterest[objName];
    var first = true;
    propOfInterest.forEach((p)=> {
      if (!first) q+= ',';
      q += ' ' + p + '__c';
      first = false;
    });
    q+= ' FROM ' + objName+'__c' + ' WHERE';
    // if (keyName && keyVal) q+= ' ' + keyName.substr(objName.length+1)+'__c = \'' + keyVal + '\'';
    // if (keyName && keyVal && filter) q+= ' AND'
    if (filter) q+=' ' + filter;
    console.log('soql: ' + q);

    org.query({ query: q }, function(err, resp){
      if (err) {
        console.log('err', err);
        return;
      }
      if (!resp.records) {
        console.log('no results');
        return;
      }

      var memRecords = [];
      resp.records.forEach((rec)=>{
        var recStore = {};
        propOfInterest.forEach((p)=> {
          recStore[p] = rec.get(p+'__c');
        });
        memRecords.push(recStore);
      });
      sfStore.memory[objName] = memRecords;
      console.log('sfStore.memory', sfStore.memory);
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
  store: (objName)=>{
    var dl = nforce.createSObject(objName + '__c');
    var tgtObj = sfStore.memory[objName]
    console.log(sfStore.memory);
    console.log(objName);
    console.log(tgtObj);
    for(var key in tgtObj){
      dl.set(key+'__c', tgtObj[key]);
    }

    org.insert({ sobject: dl }, function(err, resp){
      if(err) {
        console.log('err: ', err);
        return;
      }
      console.log('It worked!');
    });
  },
};

module.exports.store = sfStore;
