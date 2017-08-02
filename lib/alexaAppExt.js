
exports.reqListSlots =  function(req) {
  if (req.data.request.intent.slots)
    return Object.keys(req.data.request.intent.slots);
  else
    return [];
};

exports.reqContainsSlot =  function(req, slotName) {
  if (req.data.request.intent.slots)
    return slotName in req.data.request.intent.slots;
  else
    return false;
};
