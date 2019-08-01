/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const FlowScriptCompiler = require('./flowScriptCompiler.js');

FlowScriptCompiler.registerWidgetImpl('jump', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, flowScriptDoc.selector(elNode.attrib('target'))[0]);
});

FlowScriptCompiler.registerWidgetImpl('scriptlet', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
});

FlowScriptCompiler.registerWidgetImpl('resolve', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = FlowScriptCompiler.toPromise(response.get(value));
  return result.then((ret)=>{
    if (ret!=false)
      return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('if', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = FlowScriptCompiler.toPromise(response.get(value));
  return result.then((cond)=>{
    if (cond) return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});

const resolveForCase = async (response, flowScriptDoc, caseNode)=>{
  var value = caseNode.attrib('value');
  var cond = await response.get(value);
  var condMatched = false;
  for (let c of caseNode.find('case')) {
    var caseCond = c.el.attribs.value;
    var caseResult = await response.get(`'${cond}' == '${caseCond}'`)
    // var caseResult = await response.get(`${cond} == ${caseCond}`)
    // console.log(`..... case checking: ${cond} == ${caseCond} returned: ${caseResult}`);
    if (caseResult) {
      condMatched = true;
      await FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, c);
      break;
    }
  }
  if (!condMatched) {
    var defaultTags = caseNode.find('default')
    if (defaultTags.length > 0) {
      await FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, defaultTags[0]);
    }
  }
};

FlowScriptCompiler.registerWidgetImpl('check', (response, flowScriptDoc, elNode)=>{
  return resolveForCase(response, flowScriptDoc, elNode);
});
