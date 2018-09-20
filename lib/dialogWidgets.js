/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const FlowScriptCompiler = require('./flowScriptCompiler.js');

FlowScriptCompiler.registerIntentWidgetType('dialog');

FlowScriptCompiler.registerWidgetImpl('item', (response, flowScriptDoc, elNode)=>{
  // just run the contents
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
});

FlowScriptCompiler.registerWidgetHook('dialog', (flowScriptDoc, convoEngine, dialogNode)=>{
  // dialogs are triggered by the state machine, so hooked it in (all it will do is check for the next item)
  convoEngine.defineGoal({
    goal: dialogNode.id(),
    resolve: (response) => {
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, dialogNode);
    }
  });

  // dialog's do have prompts but they are inside the item - the compilers output process will handle that
  var respondArr = FlowScriptCompiler.choiceHooksForRegistering(flowScriptDoc, dialogNode.id(), dialogNode, ['item']);
  respondArr.forEach(itemHook=>{
    var itemNode = dialogNode.find('#'+itemHook.name)[0];
    // console.log(`*** switching id from ${r.name} --> ${itemNode.el.attribs}`, itemNode.el.attribs)
    // itemHook.name = itemNode.attrib('name');
    var goalObj = {
      goal: itemNode.attrib('name'),
      respondTo: [itemHook]
    };

    var prompts = itemNode.find('> prompt');
    if (prompts.length > 0)
      goalObj.prompt = prompts.map(n=>n.text());
    console.log(`prompts.length: ${prompts.length} - ${goalObj.prompt}`)

    var asks = itemNode.find('> ask');
    if (asks.length > 0)
      goalObj.ask = asks.map(n=>n.text());
    console.log(`asks.length: ${asks.length} - ${goalObj.ask}`)

    convoEngine.defineGoal(goalObj);
  });
});
