/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

const Promise = require('bluebird');
const co = require('co');
const cheerio = require('cheerio');
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
var widgetHooks = {};
var intentWidgetTypes = ['choice'];

////////////////////
// Core Classes
////////////////////
class ConvoEl {
  constructor(_cdoc, _el, _node) {
    this.cdoc = _cdoc;
    this.el = _el;
    this.node = _node;
  }
  attrib(_name) {
    return this.el.attribs[_name];
  }
  attribKeys() {
    return Object.keys(this.el.attribs);
  }
  id() {
    // return this.node.attr('id');
    return this.el.attribs.id;
  }
  // element name: say, ask, decision, etc
  name() {
    return this.el.name;
  }
  text() {
    return this.node.text();
  }
  _node(_el) {
    return new ConvoEl(this.cdoc, _el, this.cdoc(_el));
  }
  children() {
    return this.node.children().get().map((el)=>{
      return this._node(el);
    });
  }
  find(_sel) {
    // how is this different from selector?
    return this.node.find(_sel).get().map((el)=>{
      return this._node(el);
    });
  }
}
class ConvoDoc {
  constructor(_cheerioDoc) {
    this.cheerioDoc = _cheerioDoc;
  }
  root() {
    var node = this.cheerioDoc.root();
    var el = node.get(0);
    return new ConvoEl(this.cheerioDoc, el, node);
  }
  node(_el) {
    return new ConvoEl(this.cheerioDoc, _el, this.cheerioDoc(_el));
  }
  selector(_sel) {
    return this.cheerioDoc(_sel).get().map((el)=>{
      return this.node(el);
    });
  }
}
class FlowScriptCompiler {

  static spc(len) {
    return '  '.repeat(len);
  }

  static load(_script) {
    return new ConvoDoc( cheerio.load(_script, {xml: {withDomLvl1: false}}) );
  }

  static walkTree(flowScriptDoc, node, visitParam, visitorCB) {
    node.children().forEach((childNode, ndx)=>{
      if (!childNode.el.type) {
        console.log('err element has no type'); return;
      }
      if (childNode.el.type != 'tag') {
        console.log('err element has unexpected type: ', tag); return;
      }
      // var childNode = flowScriptDoc.node(child);
      // if child.type == 'tag' (which seems to be all the time with .children() )
      //   child has props: type, name; ObjVals:attribs, prev, next, parent (and sometimes root); ArrVals: children
      // if type == text then child also has data

      // child.children has text children childNode.children().get() has only tag children

      var visitParamChild = visitorCB(childNode, ndx, node, visitParam, flowScriptDoc);
      FlowScriptCompiler.walkTree(flowScriptDoc, childNode, visitParamChild, visitorCB);
    });
  }

  static dump(flowScriptDoc) {
    // we visit tree with a nesting level as the visitParam so that we can show the heirarchy
    const dumpVisitor = (childNode, ndx, parent, /*visitParam*/lvl, flowScriptDoc)=>{
      var textVal = '';
      if (childNode.children().length == 0) textVal = ': ' + childNode.text();
      var attribsVal = ''
      var attribsKey = childNode.attribKeys();
      if (attribsKey.length > 0) attribsVal = '[' + attribsKey.map(k=>`${k}=${childNode.attrib(k)}`).join(',') + ']';
      console.log(`${FlowScriptCompiler.spc(lvl)}${childNode.name()}${attribsVal}${textVal}`)

      return lvl+1;
    };
    FlowScriptCompiler.walkTree(flowScriptDoc, flowScriptDoc.root(), 0, dumpVisitor);
  }

  static resolveElementChildrenForOutlet(response, flowScriptDoc, elNode, exceptions={}) {
    // el = elNode.get(0);
    // console.log('el: ', el.name)
    //console.log(`> resolveElementChildrenForOutlet: ${el.name} #${el.attribs.id} - ${elNode.text()}`)
    var elChildren = elNode.children();
    return Promise.map(elChildren, child=>{
      if (exceptions.hasOwnProperty(child.name)) return;
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, child);
    }, {concurrency:1} );
  }

  static registerWidgetImpl(name, cb=nullCB) {
    widgetsImpl[name] = cb;
  }
  static registerWidgetHook(name, cb) {
    widgetHooks[name] = cb;
  }
  static registerIntentWidgetType(name, cb) {
    intentWidgetTypes.push(name)
  }

  static resolveElementForOutlet(response, flowScriptDoc, node) {
    if (widgetsImpl[node.name()]) {
      debug(`:: Executing: ${node.name()}#${node.id()}`);
      return widgetsImpl[node.name()](response, flowScriptDoc, node);
    } else {
      response.say(`Dont know how to handle conversation nodes of type ${node.name()}`);
      console.trace('Unexpected node name is undefined');
    }
  }

  static resolveForCase(response, flowScriptDoc, caseNode) {
    var caseEl = caseNode.get(0);

    var value = caseEl.attribs.value;
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
  }

  static resolveForDialog(response, flowScriptDoc, dialogNode) {
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

    var dialogEl = dialogNode.get(0);

    var dialogGoal = dialogEl.attribs.id;
    if (!response.hasGoal(dialogGoal)) // TODO: this adding should ideally be done before the goal is run for the first time (as opposed to be done in the body of the goal)
      response.addGoal(dialogGoal); // dialogs need to be queued because they don't have a prompt

    var elicit = dialogEl.attribs.elicit;
    var itemToElicit = response.get(elicit, {dialog: dialogSvc});
    if (itemToElicit) {
      response.addGoal(itemToElicit);
      return false; // dependent goals not met
    }
    return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, dialogNode, /*exceptions*/{item: true});
  }

  static choiceHooksToRespondTo(flowScriptDoc, decisionChildType, decisionChildId, parentGoalId) {
    var decisionChildNode = flowScriptDoc.selector(`#${decisionChildId}`)[0];
    var intentDef = {
      name: decisionChildId
    };
    if (parentGoalId) intentDef.goal = parentGoalId;

    var expectings = decisionChildNode.find('> expecting');
    if (expectings.length == 0) console.log(`ERROR - <expecting> not found in ${decisionChildType}#${decisionChildId}`)
    if (expectings.length > 0)
      intentDef.expecting = expectings.map(n=>n.text());

    // console.log(`tagging intentDef.resolve for ${decisionChildId} and ${decisionChildNode.name()}`);
    intentDef.resolve = (response) => {
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, decisionChildNode);
    };

    return intentDef;
  }

  static choiceHooksForRegistering(flowScriptDoc, parentGoalId, node, intentTags = intentWidgetTypes) {
    var respondArr = [];
    var intentTagSelector = intentTags.map(t=>`> ${t}`).join(', ');
    var intentTagNodes = node.find(intentTagSelector);
    intentTagNodes.forEach(child=>{
      var rTo = FlowScriptCompiler.choiceHooksToRespondTo(flowScriptDoc, child.name(), child.id(), parentGoalId);
      // console.log(`decisionNodeChild id: ${child.attribs.id} `, rTo)
      respondArr.push(rTo);
    });
    return respondArr;
  }

  static compile(flowScriptDoc, scriptModels, convoEngine) {
    // TODO: support 3rd party widgets with declared dependencies

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
    const idVisitor = (childNode, ndx, parent, /*visitParam*/ idPrefix, flowScriptDoc)=>{
      if (idPrefix.length != 0) idPrefix += '_';
      const myId = idPrefix + ndx;
      if (!childNode.node.attr('id')) childNode.node.attr('id', 'node-' + myId);
      return myId;
    };
    FlowScriptCompiler.walkTree(flowScriptDoc, flowScriptDoc.root(), '', idVisitor);

    // prep-ii) compile input widgets (so that ASM widgets can use them)
    // not supported right now :-)

    // do) compile ASM widgets by converting to goals (really registering intents)
    console.log(`Registered widgetHooks: `, Object.keys(widgetHooks));
    Object.keys(widgetHooks).forEach(widgetName=>{
      flowScriptDoc.selector(widgetName).forEach(node=>{
        console.log(`${widgetName}-id: ${node.id()}`);
        widgetHooks[widgetName](flowScriptDoc, convoEngine, node);
      });
    });
    // vvv taken care of in app and decision
    // flowScriptDoc.selector('choice').forEach(n=>{
    //   console.log(`choice node: ${n.id()}`);
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

FlowScriptCompiler.registerWidgetImpl('dialog', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveForDialog(response, flowScriptDoc, elNode);
});
FlowScriptCompiler.registerWidgetImpl('choice', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
});
FlowScriptCompiler.registerWidgetImpl('item', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
});
FlowScriptCompiler.registerWidgetImpl('say', (response, flowScriptDoc, elNode)=>{
  response.say(elNode.text(), elNode.attrib('quick'));
});
FlowScriptCompiler.registerWidgetImpl('sayOne', (response, flowScriptDoc, elNode)=>{
  response.say(elNode.children().map(n=>n.text()), elNode.attrib('quick'));
});
FlowScriptCompiler.registerWidgetImpl('decision', (response, flowScriptDoc, elNode)=>{
  response.addGoal(elNode.id());
});
FlowScriptCompiler.registerWidgetImpl('jump', (response, flowScriptDoc, elNode)=>{
  return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, flowScriptDoc.selector(elNode.attrib('target'))[0]);
});

// app logic integration elements
FlowScriptCompiler.registerWidgetImpl('resolve', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = toPromise(response.get(value));
  return result.then(()=>{
    FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('if', (response, flowScriptDoc, elNode)=>{
  var value = elNode.attrib('value');
  var result = toPromise(response.get(value));
  return result.then((cond)=>{
    if (cond) return FlowScriptCompiler.resolveElementChildrenForOutlet(response, flowScriptDoc, elNode);
  });
});
FlowScriptCompiler.registerWidgetImpl('check', (response, flowScriptDoc, elNode)=>{
  FlowScriptCompiler.resolveForCase(response, flowScriptDoc, elNode);
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

FlowScriptCompiler.registerIntentWidgetType('dialog');

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
      goalObj.ask = asks.get().map(n=>n.text());
    console.log(`asks.length: ${asks.length} - ${goalObj.ask}`)

    convoEngine.defineGoal(goalObj);
  });
});


module.exports = FlowScriptCompiler;
