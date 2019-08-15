/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const debug = require('debug')('alexaAPI'); // to enable run as: DEBUG=alexaAPI OR DEBUG=*


exports.reqListSlots =  function(req) {
  if (req.data.request.intent && req.data.request.intent.slots) {
    debug('request slots: ', req.data.request.intent.slots)
    return Object.keys(req.data.request.intent.slots);
  } else
    return [];
};

exports.reqContainsSlot =  function(req, slotName) {
  if (req.data.request.intent.slots)
    return slotName in req.data.request.intent.slots;
  else
    return false;
};
