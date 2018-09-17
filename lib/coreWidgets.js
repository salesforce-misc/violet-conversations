/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const FlowScriptCompiler = require('./flowScriptCompiler.js');

// null implementation for a few cases when we don't need to do anything
FlowScriptCompiler.registerNonNestableWidgetImpl('ask');
FlowScriptCompiler.registerNonNestableWidgetImpl('prompt');
FlowScriptCompiler.registerNonNestableWidgetImpl('expecting');

FlowScriptCompiler.registerWidgetImpl('choice', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
});
FlowScriptCompiler.registerNonNestableWidgetImpl('say', (response, flowScriptDoc, elNode)=>{
  response.say(elNode.contents(), elNode.attrib('quick'));
});
FlowScriptCompiler.registerWidgetImpl('sayOne', (response, flowScriptDoc, elNode)=>{
  response.say(elNode.children().map(n=>n.contents()), elNode.attrib('quick'));
});
FlowScriptCompiler.registerWidgetImpl('decision', (response, flowScriptDoc, elNode)=>{
  response.addGoal(elNode.id());
});

FlowScriptCompiler.registerWidgetHook('app', (flowScriptDoc, convoEngine, node)=>{
  var respondArr = FlowScriptCompiler.choiceHooksForRegistering(flowScriptDoc, null, node);
  respondArr.forEach(r=>{
    convoEngine.respondTo(r);
  });
});
FlowScriptCompiler.registerWidgetHook('decision', (flowScriptDoc, convoEngine, decisionNode)=>{
  var goalObj = {
    goal: decisionNode.id(),
    respondTo: []
  };

  var prompts = decisionNode.find('> prompt');
  if (prompts.length > 0) {
    goalObj.prompt = prompts.map(n=>n.text());
    console.log(`  prompts[${goalObj.prompt.length}]:`, goalObj.prompt);
  }

  var asks = decisionNode.find('> ask');
  if (asks.length > 0) {
    goalObj.ask = asks.map(n=>n.text());
    console.log(`  asks[${goalObj.ask.length}]:`, goalObj.ask);
  }

  goalObj.respondTo = FlowScriptCompiler.choiceHooksForRegistering(flowScriptDoc, decisionNode.id(), decisionNode);

  convoEngine.defineGoal(goalObj);
});

const resolveForDialog = (response, flowScriptDoc, dialogNode)=>{
  var dialogSvc = {
    nextReqdParam: () => {
      var items = dialogNode.find('> item');
      if (items.length == 0) {
        console.log(`ERROR - <item> not found in dialog${dialogNode.id()}`);
        return null;
      }

      for (let i of items) {
        if (!('required' in i.el.attribs)) continue;
        if (!response.contains(i.el.attribs.name)) return i.el.attribs.name;
      }
      // if we come here we have looked at all properties and have them
      return null;
    },
    hasReqdParams: () => {
      if (dialogSvc.nextReqdParam() == null)
        return true;
      else
        return false;
    }
  };

  var dialogGoal = dialogNode.attrib('id');
  if (!response.hasGoal(dialogGoal)) // TODO: this adding should ideally be done before the goal is run for the first time (as opposed to be done in the body of the goal)
    response.addGoal(dialogGoal); // dialogs need to be queued because they don't have a prompt

  var elicit = dialogNode.attrib('elicit');
  var itemToElicit = response.get(elicit, {dialog: dialogSvc});
  if (itemToElicit) {
    response.addGoal(itemToElicit);
    return false; // dependent goals not met
  }
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, dialogNode, /*exceptions*/{item: true});
}

FlowScriptCompiler.registerWidgetImpl('dialog', (response, flowScriptDoc, elNode)=>{
  return resolveForDialog(response, flowScriptDoc, elNode);
});
