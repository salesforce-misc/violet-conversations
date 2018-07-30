/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Class that primarily exists for documenting and defining what a store
 * plugin needs to support (they are expected to extend this class)
 */
class StorePlugin {

  constructor() {
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
