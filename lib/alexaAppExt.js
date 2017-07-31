
exports.reqListSlots =  function(req, slotName) {
  return Object.keys(req.data.request.intent.slots);
};

exports.reqContainsSlot =  function(req, slotName) {
  return slotName in req.data.request.intent.slots;
};
