/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const Promise = require('bluebird');
const co = require('co');
const debug = require('debug')('flowScriptCompiler');

////////////////////
// Utilities
////////////////////
const nullCB = ()=>{};

// handles generators, promises, and non promise values
const toPromise = (result)=>{
  if (result && result.next)
    result = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
  else
    result = Promise.resolve(result) // primarily to convert non-promises to promises
  return result;
}


////////////////////
// Singleton Data
////////////////////
var widgetsImpl = {};

////////////////////
// Core Class
////////////////////
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

  static resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode, exceptions={}) {
    if (!el && !elNode) console.log('ERROR: Cannot resolve with no elements');
    if (!el) el = elNode.get(0);
    if (!elNode) elNode = flowScriptDoc(el);

    // console.log('el: ', el.name)
    //console.log(`> resolveElementChildrenForOutlet: ${el.name} #${el.attribs.id} - ${elNode.text()}`)
    var elChildren = elNode.children().get();
    return Promise.map(elChildren, child=>{
      if (exceptions.hasOwnProperty(child.name)) return;
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, child);
    }, {concurrency:1} );
  }

  static registerWidgetImpl(name, cb=nullCB) {
    widgetsImpl[name] = cb;
  }

  static resolveElementForOutlet(response, flowScriptDoc, el, elNode) {
    if (!el && !elNode) console.log('ERROR: Cannot resolve with no elements');
    if (!el) el = elNode.get(0);

    if (widgetsImpl[el.name]) {
      debug(`:: Executing: ${el.name}#${el.attribs.id}`);
      return widgetsImpl[el.name](el.attribs, response, flowScriptDoc, el, elNode);
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
        var items = dialogNode.find('> item').get();
        if (items.length == 0) {
          console.log(`ERROR - <item> not found in dialog${dialogNode.get(0).attribs.id}`);
          return null;
        }

        for (let i of items) {
          if (!('required' in i.attribs)) continue;
          if (!response.contains(i.attribs.name)) return i.attribs.name;
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

    if (!dialogEl) dialogEl = dialogNode.get(0);

    var dialogGoal = dialogEl.attribs.id;
    if (!response.hasGoal(dialogGoal)) // TODO: this adding should ideally be done before the goal is run for the first time (as opposed to be done in the body of the goal)
      response.addGoal(dialogGoal); // dialogs need to be queued because they don't have a prompt

    var elicit = dialogEl.attribs.elicit;
    var itemToElicit = response.get(elicit, {dialog: dialogSvc});
    if (itemToElicit) {
      response.addGoal(itemToElicit);
      return false; // dependent goals not met
    }
    return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, dialogEl, dialogNode, /*exceptions*/{item: true});
  }

  static decisionChildTypeToRespondTo(flowScriptDoc, decisionChildType, decisionChildId, parentGoalId) {
    var decisionChildNode = flowScriptDoc(`#${decisionChildId}`)
    var intentDef = {
      name: decisionChildId
    };
    if (parentGoalId) intentDef.goal = parentGoalId;

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
    // do) compile ASM widgets by converting to goals (really registering intents)
    // post) ensure that the resolve's generated for above can use outlets (ASM widges as well as output widgets)

    debug('Compiler Starting >>>');

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

    // do) compile ASM widgets by converting to goals (really registering intents)
    const globalIntentTags = ['choice', 'dialog'];
    const decisionNodeHooksForRegistering = (parentGoalId, node, intentTags = globalIntentTags)=>{
      var respondArr = [];
      var intentTagSelector = intentTags.map(t=>`> ${t}`).join(', ');
      var intentTagNodes = node.find(intentTagSelector);
      intentTagNodes.get().forEach(child=>{
        var rTo = FlowScriptCompiler.decisionChildTypeToRespondTo(flowScriptDoc, child.name, child.attribs.id, parentGoalId);
        // console.log(`decisionNodeChild id: ${child.attribs.id} `, rTo)
        respondArr.push(rTo);
      });
      return respondArr;
    };
    flowScriptDoc('app').get().forEach(el=>{
      console.log(`app node: ${el.attribs.id}`);
      var node = flowScriptDoc(el);
      var respondArr = decisionNodeHooksForRegistering(null, node);
      respondArr.forEach(r=>{
        convoEngine.respondTo(r);
      });
    });
    flowScriptDoc('decision').get().forEach(el=>{
      console.log(`decision el: ${el.attribs.id}`);
      var decisionNode = flowScriptDoc(el);
      var goalObj = {
        goal: el.attribs.id,
        respondTo: []
      };

      var prompts = decisionNode.find('> prompt');
      if (prompts.length > 0)
        goalObj.prompt = prompts.get().map(n=>flowScriptDoc(n).text());
      console.log(`prompts.length: ${prompts.length} - ${goalObj.prompt}`)

      var asks = decisionNode.find('> ask');
      if (asks.length > 0)
        goalObj.ask = asks.get().map(n=>flowScriptDoc(n).text());
      console.log(`asks.length: ${asks.length} - ${goalObj.ask}`)

      goalObj.respondTo = decisionNodeHooksForRegistering(el.attribs.id, decisionNode);

      convoEngine.defineGoal(goalObj);
    });
    flowScriptDoc('dialog').get().forEach(el=>{
      console.log(`dialog el: ${el.attribs.id}`);
      var dialogNode = flowScriptDoc(el);

      // dialogs are triggered by the state machine, so hooked it in (all it will do is check for the next item)
      convoEngine.defineGoal({
        goal: el.attribs.id,
        resolve: (response) => {
          return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, null, dialogNode);
        }
      });

      // dialog's do have prompts but they are inside the item - the compilers output process will handle that
      var respondArr = decisionNodeHooksForRegistering(el.attribs.id, dialogNode, ['item']);
      respondArr.forEach(itemHook=>{
        var itemEl = dialogNode.find('#'+itemHook.name).get()[0];
        var itemNode = flowScriptDoc(itemEl);
        // console.log(`*** switching id from ${r.name} --> ${itemEl.attribs}`, itemEl.attribs)
        // itemHook.name = itemEl.attribs.name;
        var goalObj = {
          goal: itemEl.attribs.name,
          respondTo: [itemHook]
        };

        var prompts = itemNode.find('> prompt');
        if (prompts.length > 0)
          goalObj.prompt = prompts.get().map(n=>flowScriptDoc(n).text());
        console.log(`prompts.length: ${prompts.length} - ${goalObj.prompt}`)

        var asks = itemNode.find('> ask');
        if (asks.length > 0)
          goalObj.ask = asks.get().map(n=>flowScriptDoc(n).text());
        console.log(`asks.length: ${asks.length} - ${goalObj.ask}`)

        convoEngine.defineGoal(goalObj);
      });
    });
    // vvv taken care of in app and decision
    // flowScriptDoc('choice').get().forEach(n=>{
    //   console.log(`choice node: ${n.attribs.id}`);
    // })

    // post) ensure that the resolve's generated for above can use outlets (ASM widges as well as output widgets)

    if (debug.enabled) FlowScriptCompiler.dump(flowScriptDoc);
    debug('Compiler Done >>>');
  }

}

// we don't need to do anything in these cases
FlowScriptCompiler.registerWidgetImpl('ask');
FlowScriptCompiler.registerWidgetImpl('prompt');
FlowScriptCompiler.registerWidgetImpl('expecting');

FlowScriptCompiler.registerWidgetImpl('dialog', (attribs, response, flowScriptDoc, el, elNode)=>{
  return FlowScriptCompiler.resolveForDialog(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('choice', (attribs, response, flowScriptDoc, el, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('item', (attribs, response, flowScriptDoc, el, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
});
FlowScriptCompiler.registerWidgetImpl('say', (attribs, response, flowScriptDoc, el, elNode)=>{
  if (!elNode) elNode = flowScriptDoc(el);
  response.say(elNode.text(), attribs.quick);
});
FlowScriptCompiler.registerWidgetImpl('sayOne', (attribs, response, flowScriptDoc, el, elNode)=>{
  if (!elNode) elNode = flowScriptDoc(el);
  response.say(elNode.children().get().map(n=>flowScriptDoc(n).text()), attribs.quick);
});
FlowScriptCompiler.registerWidgetImpl('decision', (attribs, response, flowScriptDoc, el, elNode)=>{
  response.addGoal(attribs.id);
});
FlowScriptCompiler.registerWidgetImpl('jump', (attribs, response, flowScriptDoc, el, elNode)=>{
  return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, null, flowScriptDoc(attribs.target));
});

// app logic integration elements
FlowScriptCompiler.registerWidgetImpl('resolve', (attribs, response, flowScriptDoc, el, elNode)=>{
  var value = attribs.value;
  var result = toPromise(response.get(value));
  return result.then(()=>{
    FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('if', (attribs, response, flowScriptDoc, el, elNode)=>{
  var value = attribs.value;
  var result = toPromise(response.get(value));
  return result.then((cond)=>{
    if (cond) return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, el, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('check', (attribs, response, flowScriptDoc, el, elNode)=>{
  FlowScriptCompiler.resolveForCase(response, flowScriptDoc, el, elNode);
});

module.exports = FlowScriptCompiler;
