var assert = require('assert');

const identityCB = function(x) {
  return x;
};

module.exports.testCRUD = function *({response, colTx=identityCB, jsTx=identityCB}) {
  var recKeyVal = `Important Record: ${Math.round(Math.random()*1000*1000)}`
  // var results = yield response.load('Automated_Tests', 'Status', 'New');
  // console.log('results: ', results);
  // assert.ok(Array.isArray(results));

  // Create
  var createData = {
    Status: 'New',
    Verified: true
  }
  createData[colTx('Name')] = recKeyVal;
  yield response.store('Automated_Tests', createData);
  // Read
  var results = yield response.load({
    objName: 'Automated_Tests',
    keyName: colTx('Name'),
    keyVal: recKeyVal
  });
  console.log('results: ', results);
  assert.ok(Array.isArray(results));
  assert.ok(results.length==1);
  assert.equal(results[0][jsTx('Name')],recKeyVal);

  // Update
  yield response.update('Automated_Tests', colTx('Name'), recKeyVal, {'Status': 'Running'});
  results = yield response.load({
    objName: 'Automated_Tests',
    keyName: colTx('Name'),
    keyVal: recKeyVal
  });
  console.log('results: ', results);
  assert.ok(Array.isArray(results));
  assert.ok(results.length==1);
  assert.equal(results[0][jsTx('Status')],'Running');

  // Delete
  yield response.delete('Automated_Tests', colTx('Name'), recKeyVal, {'Status': 'Running'});
  results = yield response.load({
    objName: 'Automated_Tests',
    keyName: colTx('Name'),
    keyVal: recKeyVal
  });
  // console.log('results: ', results);
  assert.ok(Array.isArray(results));
  assert.ok(results.length==0);
};
