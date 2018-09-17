/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const FlowScriptCompiler = require('./flowScriptCompiler.js');

FlowScriptCompiler.registerWidgetImpl('jump', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, flowScriptDoc.selector(elNode.attrib('target'))[0]);
});

FlowScriptCompiler.registerWidgetImpl('resolve', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = FlowScriptCompiler.toPromise(response.get(value));
  return result.then(()=>{
    FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('if', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = FlowScriptCompiler.toPromise(response.get(value));
  return result.then((cond)=>{
    if (cond) return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});

const resolveForCase = (response, flowScriptDoc, caseNode)=>{
  var value = caseNode.attrib('value');
  var result = response.get(value);

  for (let c of caseNode.find('case')) {
    var caseCond = c.el.attribs.value;
    var result = response.get('' + value + caseCond)
    if (result) {
      FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, c);
      return;
    }
  };
  FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, caseNode.find('default')[0]);
};

FlowScriptCompiler.registerWidgetImpl('check', (response, flowScriptDoc, elNode)=>{
  resolveForCase(response, flowScriptDoc, elNode);
});
