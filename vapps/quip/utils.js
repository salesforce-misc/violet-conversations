
var spaces = module.exports.spaces = function(cnt) {
  if (cnt == 0) return '';
  return ' ' + spaces(cnt-1);
}

// based on https://gist.github.com/alexhawkins/931c0af2d827dd67a3e8
var prettyJSON = module.exports.prettyJSON = function(givenHdr, obj, ndent=0, internalCall=false) {
  var rowHdr = givenHdr + spaces(2*ndent);
  var xtraHdr = '';
  if (!internalCall) xtraHdr = rowHdr;
  var arrOfKeyVals = [],
      arrVals = [],
      objKeys = [];

  /*********CHECK FOR PRIMITIVE TYPES**********/
  if (typeof obj === 'number' || typeof obj === 'boolean' || obj === null)
    return xtraHdr + '' + obj;
  else if (typeof obj === 'string')
    return xtraHdr + '"' + obj + '"';

  /*********CHECK FOR ARRAY**********/
  else if (Array.isArray(obj)) {
    if (obj[0] === undefined)
      return xtraHdr + '[]';
    else {
      obj.forEach(function(el) {
        arrVals.push(prettyJSON(givenHdr, el, ndent, true));
      });
      return xtraHdr + '[' + arrVals + ']';
    }
  }
  /*********CHECK FOR OBJECT**********/
  else if (obj instanceof Object) {
    var kvHdr = rowHdr + spaces(2*(ndent+1))
    objKeys = Object.keys(obj);
    objKeys.forEach(function(key) {
      var keyOut = "'" + key + "': ";
      var keyValOut = obj[key];
      if (keyValOut instanceof Function || typeof keyValOut === undefined)
        arrOfKeyVals.push('');
      else if (typeof keyValOut === 'string')
        arrOfKeyVals.push(keyOut + "'" + keyValOut + "'");
      else if (typeof keyValOut === 'boolean' || typeof keValOut === 'number' || keyValOut === null)
        arrOfKeyVals.push(keyOut + keyValOut);
      else if (keyValOut instanceof Object) {
          arrOfKeyVals.push(keyOut + prettyJSON(givenHdr, keyValOut, ndent+1, true));
      }
    });
    return xtraHdr + '{\n' + kvHdr + arrOfKeyVals.join(',\n' + kvHdr) +'\n' + rowHdr + '}';
  }
};
