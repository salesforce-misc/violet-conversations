var nforce = require('nforce');
var org = nforce.createConnection({
  clientId: process.env.V_SFDC_CLIENT_ID,
  clientSecret: process.env.V_SFDC_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/oauth/_callback',
  // apiVersion: 'v27.0',  // optional, defaults to current salesforce API version
  // environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  mode: 'single' // optional, 'single' or 'multi' user mode, multi default
});
org.authenticate({ username: process.env.V_SFDC_USERNAME, password: process.env.V_SFDC_PASSWORD}, function(err, resp){
  // the oauth object was stored in the connection object
  if(err) {
    console.log('err: ', err);
    return;
  }

  console.log('Cached Token: ' + org.oauth.access_token);


});

var sfStore = {
  builtInTypesOfInterest: ['CreatedDate'],
  memory: {},
  load:  (objName, keyName, keyVal, filter, queryXtra)=>{
    // console.log('sfStore.load: ' + objName);
    var q = 'SELECT ';
    q+= sfStore.builtInTypesOfInterest
              .concat(sfStore.propOfInterest[objName].map((p)=>{return p+'__c';}))
              .join(', ');
    q+= ' FROM ' + objName+'__c' + ' WHERE';
    if (keyName && keyVal) q+= ' ' + keyName.substr(objName.length+1)+'__c = \'' + keyVal + '\'';
    if (keyName && keyVal && filter) q+= ' AND'
    if (filter) q+=' ' + filter;
    if (queryXtra) q+=' ' + queryXtra;
    console.log('soql: ' + q);

    return org.query({ query: q }).then(function(resp){
      if (!resp.records) {
        console.log('no results');
        return;
      }

      var memRecords = [];
      resp.records.forEach((rec)=>{
        var recStore = {};
        sfStore.builtInTypesOfInterest.forEach((p)=> {
          recStore[p] = rec.get(p);
        });
        sfStore.propOfInterest[objName].forEach((p)=> {
          recStore[p] = rec.get(p+'__c');
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
  store: (objName, optionalData)=>{
    var dl = nforce.createSObject(objName + '__c');
    var tgtObj;
    if (optionalData)
      tgtObj = optionalData;
    else
      tgtObj = sfStore.memory[objName]
    // console.log(sfStore.memory);
    console.log('storing: ' + objName, tgtObj);
    for(var key in tgtObj){
      dl.set(key+'__c', tgtObj[key]);
    }

    org.insert({ sobject: dl }, function(err, resp){
      if(err) {
        console.log('err: ', err);
        return;
      }
      console.log('Stored');
    });
  },
};

module.exports.store = sfStore;
