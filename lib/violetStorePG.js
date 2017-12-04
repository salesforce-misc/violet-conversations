/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Plugin which makes accessing a Postgres DB Easy.
 * @module violetStorePG
 */

// only load is implemented, need to implement store and update
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

var pgStore = {
  defaultPropOfInterest: [],
  _objProps: (params)=>{
    var objProps = pgStore.defaultPropOfInterest;
    if (params.objName) objProps = objProps.concat(pgStore.propOfInterest[params.objName]);
    if (params.propOfInterest) objProps = objProps.concat(params.propOfInterest);
    return objProps;
  },
  /** */
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
  },
  /** */
  store: (objName, dataToStore)=>{
    var objKeys = Object.keys(dataToStore);
    var objValues =  objKeys.map(k=>{return dataToStore[k]});
    var insertValues = Object.keys(objKeys).map(k=>{return '$'+(parseInt(k)+1)});
    var insertStmt = `insert into ${_getCompoundNameToStr(objName)} (${objKeys.join(', ')}) values (${insertValues.join(', ')})`;
    console.log('storing: ' + insertStmt, objValues);
    return client.query({text: insertStmt, values: objValues}).then(()=>{
      console.log('Stored');
    }).catch((err)=>{
      console.log('pg store err', err);
    });
  },
  /** */
  update: (objName, keyName, keyVal, updateData)=>{
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var objKeys = Object.keys(updateData);
    var objValues =  objKeys.map(k=>{return updateData[k]});
    var updateValues = Object.keys(objKeys).map(k=>{return '$'+(parseInt(k)+1)});
    var updateStmt = `UPDATE ${_getCompoundNameToStr(objName)}
              SET (${objKeys.join(', ')}) = (${updateValues.join(', ')})
              WHERE ${_getCompoundNameToStr(keyName)} = '${keyVal}'`;

    console.log('updating: ' + updateStmt, objValues);
    return client.query({ text: updateStmt, values: objValues }).then(function(){
      console.log('Updated');
    }).catch((err)=>{
      console.log('pg update err', err);
    });
  },
  /** */
  delete: (objName, keyName, keyVal)=>{
    // console.log('sfStore.update: ' + objName, sfStore._objProps({objName}));
    var deleteStmt = `Delete FROM ${_getCompoundNameToStr(objName)}
              WHERE ${_getCompoundNameToStr(keyName)} = '${keyVal}'`;

    console.log('deleting: ' + deleteStmt);
    return client.query(deleteStmt).then(function(){
      console.log('Deleted');
    }).catch((err)=>{
      console.log('pg delete err', err);
    });
  },


};

// module.exports.store = pgStore;
module.exports = function(violet) {
  if (violet) violet.setPersistentStore(pgStore);
  var connectionsCnt = 0;
  return {
    store: pgStore,
    connect: ()=>{
      connectionsCnt++;
      if (client == null) return _connectToDB();                  // likely someone already cleaned-up
      if (connectionCB == null) return Promise.resolve(client);   // already connected
      return new Promise(function(resolve, reject) {              // trying to connect - add ourselves to the CB
        connectionCB.push(()=>{resolve(client)});
      });
    },
    cleanup: ()=>{
      connectionsCnt--;
      if (connectionsCnt > 0) return;
      console.log('Cleaning connection to Postgres');
      client.end();
      client = null;
    },
  };
};
