/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

class StoreResponseMixin {
  /**
   * Retrieves the given object from the Salesforce database.
   *
   * @param {Object} queryParams - query parameters
   * @param {string} queryParams.objName - the object/table name in the data
   *   store where the give object is to be updated
   * @param {string} queryParams.keyName - the key name to find the object to be updated
   * @param {string} queryParams.keyVal - the key value to find the object to be updated
   * @param {string} queryParams.query - the SOQL query, i.e. what gets executed is "SELECT <query>"
   * @param {string} queryParams.filter - additional query results filter - this
   *  is added to the end of the SQL query
   * @param {string} queryParams.queryXtra - additional bits to be
   *  added to the end of the query, for example "LIMIT 100". "LIMIT 100" is auto added.
   *  Use false to prevent auto adding, for example when using aggregate queries.
   * alternatively, can pass in params as: objName, keyName, keyVal, filter, queryXtra
  */
  load(params) {
    if (arguments.length>1) {
      var p = {};
      if (arguments[0]) p.objName   = arguments[0];
      if (arguments[1]) p.keyName   = arguments[1];
      if (arguments[2]) p.keyVal    = arguments[2];
      if (arguments[3]) p.filter    = arguments[3];
      if (arguments[4]) p.queryXtra = arguments[4];
      params = p;
    }

    if (!params.objName && !params.query) {
      console.log('Need object or query to load');
      return Promise.resolve();
    }

    if (!params.query) params.query = ''
    if (typeof params.queryXtra === "undefined") params.queryXtra = ''
    if (params.queryXtra !== false && params.query.toLowerCase().indexOf('limit') == -1 &&
          params.queryXtra.toLowerCase().indexOf('limit') == -1)
      params.queryXtra += ' limit 100';

    if (params.objName)
      console.log('Loading object: ' + params.objName);
    else
    console.log('Loading: ', params);
    return this.persistentStore.load(params);
  }
  store(objName, dataToStore) {
    console.log('Storing object: ' + objName);
    return this.persistentStore.store(objName, dataToStore);
  }
  update(objName, keyName, keyVal, updateData) {
    console.log('Updating object: ' + objName);
    return this.persistentStore.update(objName, keyName, keyVal, updateData);
  }
  delete(objName, keyName, keyVal, deleteData) {
    console.log('Deleting object: ' + objName);
    return this.persistentStore.delete(objName, keyName, keyVal, deleteData);
  }
}

/**
 * Reusable functionality for a store plugin to leverage - also sets up methods
 * that can be accessed from the response object provided to intents.
 */
class StorePlugin {

  constructor(violet) {
    if (violet) violet.registerResponseDecorator(this);
  }

  initResponse(response) {
    var srn = new StoreResponseMixin();
    response.persistentStore = this;
    Reflect.ownKeys(Reflect.getPrototypeOf(srn)).forEach(meth=>{
      if (meth === 'constructor') return;
      response[meth] = srn[meth];
    })
    return response;
  }

  // methods starting with _ are 'protected', i.e. only for use by implementing stores

  _dedupe(ary) {
    return ary.sort().filter((item, ndx, _ary)=>{
      if (ndx!=0 && item == ary[ndx-1]) return false;
      return true;
    });
  }

  _nameToStr(commonName) {
    return commonName
  }

  _getCompoundNameToStr(commonName) {
    var names = commonName.split('.');
    var ret = '';
    names.forEach((n)=>{
      if (ret.length>0) ret+='.';
      ret+=this._nameToStr(n);
    });
    return ret;
  }

  _objProps(params) {
    var objProps = [];
    if (params.objName) objProps = objProps.concat(this.propOfInterest[params.objName]);
    if (params.propOfInterest) objProps = objProps.concat(params.propOfInterest);
    if (objProps.length == 0) return objProps; // return empty array if we don't have a way to get any propOfInterest
    return objProps.concat(this.defaultPropOfInterest);
  }

  _buildQuery(params) {
    var q = 'SELECT ';
    if (params.query)
      q+=' ' + params.query;
    else
      q+= this._dedupe(this._objProps(params).map((p)=>{return this._getCompoundNameToStr(p);})).join(', ');
    if (params.objName)
      q+= ' FROM ' + this._getCompoundNameToStr(params.objName);
    if (params.keyName || params.filter) q+= ' WHERE';
    if (params.keyName && params.keyVal) {
      if (params.keyName.startsWith(params.objName))
        q+= ' ' + this._getCompoundNameToStr(params.keyName.substr(params.objName.length+1)) + ' = \'' + params.keyVal + '\'';
      else
        q+= ' ' + this._getCompoundNameToStr(params.keyName)+' = \'' + params.keyVal + '\'';
    }
    if (params.keyName && params.keyVal && params.filter) q+= ' AND'
    if (params.filter) q+=' ' + params.filter;
    if (params.queryXtra) q+=' ' + params.queryXtra;

    return q;
  }

}

module.exports = StorePlugin;
