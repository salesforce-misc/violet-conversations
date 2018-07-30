/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const nullCB = ()=>{};
var widgetsImpl = {};

class FlowScriptCompiler {

  static spc(len) {
    return '  '.repeat(len);
  }

  static walkTree(flowScriptDoc, el, visitParam, visitorCB) {
    el.children().get().forEach((child, ndx)=>{
      if (!child.type) {
        console.log('err node has no type'); return;
      }
      if (child.type != 'tag') {
        console.log('err node has unexpected type: ', tag); return;
      }
      var childNode = flowScriptDoc(child);
      // if child.type == 'tag' (which seems to be all the time with .children() )
      //   child has props: type, name; ObjVals:attribs, prev, next, parent (and sometimes root); ArrVals: children
      // if type == text then child also has data

      // child.children has text children childNode.children().get() has only tag children

      var visitParamChild = visitorCB(childNode, child, ndx, el, visitParam, flowScriptDoc);
      FlowScriptCompiler.walkTree(flowScriptDoc, childNode, visitParamChild, visitorCB);
    });
  }

  static dump(flowScriptDoc) {
    // we visit tree with a nesting level as the visitParam so that we can show the heirarchy
    const dumpVisitor = (childNode, child, ndx, parent, /*visitParam*/lvl, flowScriptDoc)=>{
      var textVal = '';
      if (childNode.children().get().length == 0) textVal = ': ' + childNode.text();
      var attribsVal = ''
      var attribsKey = Object.keys(child.attribs);
      if (attribsKey.length > 0) attribsVal = '[' + attribsKey.map(k=>`${k}=${child.attribs[k]}`).join(',') + ']';
      console.log(`${FlowScriptCompiler.spc(lvl)}${child.name}${attribsVal}${textVal}`)

      return lvl+1;
    };
    FlowScriptCompiler.walkTree(flowScriptDoc, flowScriptDoc.root(), 0, dumpVisitor);
  }

  static resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode) {
    if (!el && !elNode) console.log('ERROR: Cannot resolve with no elements');
    if (!el) el = elNode.get(0);
    if (!elNode) elNode = flowScriptDoc(el);

    // console.log('el: ', el.name)
    //console.log(`> resolveElementChildrenForOutlet: ${el.name} #${el.attribs.id} - ${elNode.text()}`)
    elNode.children().get().forEach((child)=>{
      FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, child);
    });
  }

  static registerWidgetImpl(name, cb=nullCB) {
    widgetsImpl[name] = cb;
  }

  static resolveElementForOutlet(response, flowScriptDoc, el, elNode) {
    if (!el && !elNode) console.log('ERROR: Cannot resolve with no elements');
    if (!el) el = elNode.get(0);

    if (widgetsImpl[el.name]) {
      widgetsImpl[el.name](e.attribs, response, flowScriptDoc, el, elNode);
    } else {
      response.say(`Dont know how to handle conversation nodes of type ${el.name}`);
    }
  }

  static resolveForCase(response, flowScriptDoc, caseEl, caseNode) {
    if (!caseEl) caseEl = caseNode.get(0);

    var value = caseEl.attribs.value;
    var result = response.get(value);

    for (let c of caseNode.find('case').get()) {
      var caseCond = c.attribs.value;
      var result = response.get('' + value + caseCond)
      if (result) {
        FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, c);
        return;
      }
    };
    FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, caseNode.find('default').get());
  }

  static resolveForDialog(response, flowScriptDoc, dialogEl, dialogNode) {
    var dialogSvc = {
      nextReqdParam: () => {
        var items = dialogNode.find('> item');
        if (items.length == 0) {
          console.log(`ERROR - <item> not found in dialog${dialogNode.get(0).attribs.id}`);
          return null;
        }

        for (let i of items) {
          if (!i.attribs.required) continue;
          if (!response.contains(i.attribs.name)) return i.attribs.name;
        }
        // if we come here we have looked at all properties and have them
        return null;
      }
    };
    if (!dialogEl) dialogEl = dialogNode.get(0);
    var elicit = dialogEl.attribs.elicit;
    var itemToElicit = response.get(elicit, {dialog: dialogSvc});
    if (itemToElicit) {
      response.addGoal(itemToElicit);
      return false; // dependent goals not met
    }
    return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, dialogEl, dialogNode);
  }

  static decisionChildTypeToRespondTo(flowScriptDoc, decisionChildType, decisionChildId, goalId) {
    var decisionChildNode = flowScriptDoc(`#${decisionChildId}`)
    var intentDef = {
      name: decisionChildId
    };
    if (goalId) intentDef.goal = goalId;

    var expectings = decisionChildNode.find('> expecting');
    if (expectings.length == 0) console.log(`ERROR - <expecting> not found in ${decisionChildType}#${decisionChildId}`)
    if (expectings.length > 0)
      intentDef.expecting = expectings.get().map(n=>flowScriptDoc(n).text());

    intentDef.resolve = (response) => {
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, null, decisionChildNode);
    };

    return intentDef;
  }

  static compile(flowScriptDoc, scriptModels, convoEngine) {
    // TODO: support 3rd party widgets  with declared dependencies

    // the hard part here is in the automated-state-management (ASM), to support it
    // we need to:
    // ignore) 'decoration' widgets that do nothing and have other widgets set them up (like <expecting>)
    // prep-i) add id's on nodes so that we can refer to them easily afterwords
    // prep-ii) compile input widgets (so that ASM widgets can use them)
    // do) compile ASM widgets by converting to goals
    // post) ensure that the resolve's generated for above can use outlets (ASM widges as well as output widgets)

    console.log('Compiler Starting >>>');

    // ignore) 'decoration' widgets that do nothing and have other widgets set them up (like <expecting>)
    // :-)

    // prep-i) add id's on nodes so that we can refer to them easily afterwords
    const idVisitor = (childNode, child, ndx, parent, /*visitParam*/ idPrefix, flowScriptDoc)=>{
      if (idPrefix.length != 0) idPrefix += '_';
      const myId = idPrefix + ndx;
      if (!childNode.attr('id')) childNode.attr('id', 'node-' + myId);
      return myId;
    };
    FlowScriptCompiler.walkTree(flowScriptDoc, flowScriptDoc.root(), '', idVisitor);

    // prep-ii) compile input widgets (so that ASM widgets can use them)
    // not supported right now :-)

    // do) compile ASM widgets by converting to goals
    // ignore for now
    flowScriptDoc('app').get().forEach(node=>{
      console.log(`app node: ${node.attribs.id}`);
      var choices = flowScriptDoc(node).find('> choice');
      choices.get().forEach(child=>{
        var rTo = FlowScriptCompiler.decisionChildTypeToRespondTo(flowScriptDoc, child.name, child.attribs.id)
        // console.log(`choice id: ${n.attribs.id} `, rTo)
        convoEngine.respondTo(rTo)
      })
    })
    flowScriptDoc('decision').get().forEach(node=>{
      var decisionNode = flowScriptDoc(node);
      console.log(`decision node: ${node.attribs.id}`);
      var goalObj = {
        goal: node.attribs.id,
        respondTo: []
      };

      var prompts = decisionNode.find('> prompt');
      if (prompts.length > 0)
        goalObj.prompt = prompts.get().map(n=>flowScriptDoc(n).text());
      console.log(`prompts.length: ${prompts.length} - ${goalObj.prompts}`)

      var asks = decisionNode.find('> ask');
      if (asks.length > 0)
        goalObj.asks = asks.get().map(n=>flowScriptDoc(n).text());

      var decisionChilds = decisionNode.find('> choice, > dialog');
      decisionChilds.get().forEach(c=>{
        var rTo = FlowScriptCompiler.decisionChildTypeToRespondTo(flowScriptDoc, c.name, c.attribs.id, goalObj.goal)
        // console.log(`decisionChild id: ${n.attribs.id} `, rTo)
        goalObj.respondTo.push(rTo)
      })

      convoEngine.defineGoal(goalObj);
    })
    // vvv taken care of in app and decision
    // flowScriptDoc('choice').get().forEach(n=>{
    //   console.log(`choice node: ${n.attribs.id}`);
    // })

    // post) ensure that the resolve's generated for above can use outlets (ASM widges as well as output widgets)

    FlowScriptCompiler.dump(flowScriptDoc);
    console.log('Compiler Done >>>');
  }

}

// we don't need to do anything in these cases
FlowScriptCompiler.registerWidgetImpl('prompt');
FlowScriptCompiler.registerWidgetImpl('expecting');
FlowScriptCompiler.registerWidgetImpl('item');

FlowScriptCompiler.registerWidgetImpl('dialog', (attribs, response, flowScriptDoc, el, elNode)=>{
  return FlowScriptCompiler.resolveForDialog(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('choice', (attribs, response, flowScriptDoc, el, elName)=>{
  FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('say', (attribs, response, flowScriptDoc, el, elName)=>{
  if (!elNode) elNode = flowScriptDoc(el);
  response.say(elNode.text());
});
FlowScriptCompiler.registerWidgetImpl('sayOne', (attribs, response, flowScriptDoc, el, elName)=>{
  if (!elNode) elNode = flowScriptDoc(el);
  response.say(elNode.children().get().map(n=>flowScriptDoc(n).text()));
});
FlowScriptCompiler.registerWidgetImpl('decision', (attribs, response, flowScriptDoc, el, elName)=>{
  response.addGoal(attribs.id);
});
FlowScriptCompiler.registerWidgetImpl('jump', (attribs, response, flowScriptDoc, el, elName)=>{
  FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, null, flowScriptDoc(attribs.target));
});

// app logic integration elements
FlowScriptCompiler.registerWidgetImpl('resolve', (attribs, response, flowScriptDoc, el, elName)=>{
  var value = attribs.value;
  response.get(value); // TODO: likely want to wait for this to finish running
  FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('if', (attribs, response, flowScriptDoc, el, elName)=>{
  var value = attribs.value;
  var result = response.get(value);
  if (result) FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('check', (attribs, response, flowScriptDoc, el, elName)=>{
  FlowScriptCompiler.resolveForCase(response, flowScriptDoc, el, elNode);
});

module.exports = FlowScriptCompiler;
