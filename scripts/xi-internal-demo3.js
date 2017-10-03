'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var request = require('request');
var requestP = require('request-promise');
var Promise = require('bluebird');

// violet.setSpokenRate('fast');
// violet.setSpokenRate('slow');

violet.respondTo([
      "what floor is Salesforce located on"
    ], (response) => {
    response.say('The 30th to 36th. Check in as at the front desk on this floor');
});

violet.respondTo([
      "how can I interact with the displays"
    ], (response) => {
    showCodeBlock();
    response.say(['Text hello to 415 941-5532']);
});

module.exports = violet;
