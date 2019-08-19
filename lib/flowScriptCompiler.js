/* Copyright (c) 2017-present, salesforce.com, inc. All rights reserved */
/* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */

/**
 * Defines the FlowScriptCompiler class that helps Violet handle Conversation
 * Flow's defined by our HTML inspired language
 *
 * @module flowScriptCompiler
 */
const Promise = require('bluebird');
const co = require('co');
const cheerio = require('cheerio');
const debug = require('debug')('flowScriptCompiler'); // to enable run as: DEBUG=flowScriptCompiler OR DEBUG=*
const warn = require('debug')('warn:flowScriptCompiler'); // to enable run as: DEBUG=warn:flowScriptCompiler OR DEBUG=*
////////////////////
// Utilities
////////////////////
const nullCB = ()=>{};


////////////////////
// Singleton Data
////////////////////
var widgetsImpl = {};
var implNotNestable = [];
var widgetHooks = {};
var intentWidgetTypes = ['choice'];

////////////////////
// Support Classes
////////////////////
class ConvoEl {
  constructor(_cdoc, _el, _node) {
    this.cdoc = _cdoc;
    this.el = _el;
    this.node = _node;
  }
  hasAttrib(_name) {
    return _name in this.el.attribs;
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
  contents() {
    return this.node.html();
  }
  _node(_el) {
    return new ConvoEl(this.cdoc, _el, this.cdoc(_el));
  }
  children() {
    return this.node.children().get().map((el)=>{
      return this._node(el);
    });
  }
  parent() {
    return this._node(this.el.parent);
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

/**
 * A set of static methods that help Violet prep the Conversation Flow for the
 * ConversationEngine
 *
 * @class
 */
class FlowScriptCompiler {

  ////////////////////
  // Utility Methods
  ////////////////////
  static spc(len) {
    return '  '.repeat(len);
  }

  // handles generators, promises, and non promise values
  static toPromise(result) {
    if (result && result.next)
      result = co(result); // generator return - run the rest of generator [co fortunately allow the genObj as a paramer and not just genFunc]
    else
      result = Promise.resolve(result) // primarily to convert non-promises to promises
    return result;
  }

  ////////////////////
  // Initialize
  ////////////////////
  static load(_script) {
    return new ConvoDoc( cheerio.load(_script, {xml: {withDomLvl1: false}}) );
  }

  //////////////////////////
  // Compilation / Hook up
  //////////////////////////
  static walkTree(flowScriptDoc, node, visitParam, visitorCB) {
    node.children().forEach((childNode, ndx)=>{
      if (!childNode.el.type) {
        console.error('ERROR - element has no type'); return;
      }
      if (childNode.el.type != 'tag') {
        console.error('ERROR - element has unexpected type: ', tag); return;
      }
      // var childNode = flowScriptDoc.node(child);
      // if child.type == 'tag' (which seems to be all the time with .children() )
      //   child has props: type, name; ObjVals:attribs, prev, next, parent (and sometimes root); ArrVals: children
      // if type == text then child also has data

      // child.children has text children childNode.children().get() has only tag children

      var visitParamChild = visitorCB(childNode, ndx, node, visitParam, flowScriptDoc);
      if (!implNotNestable.includes(childNode.name())) {
        FlowScriptCompiler.walkTree(flowScriptDoc, childNode, visitParamChild, visitorCB);
      }
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

  static _choiceHooksToRespondTo(flowScriptDoc, convoEngine, decisionChildType, decisionChildId, parentGoalId) {
    var decisionChildIdSel = decisionChildId.replace(/([\.<>@])/g, '\\$1');
    var decisionChildNode = flowScriptDoc.selector(`#${decisionChildIdSel}`)[0];
    var intentDef = {
      name: decisionChildId
    };
    if (parentGoalId) intentDef.goal = parentGoalId;

    var expectings = decisionChildNode.find('> expecting');
    if (expectings.length > 0)
      intentDef.expecting = expectings.map(n=>n.text());
    if (convoEngine.expectings[decisionChildId]) {
      if (intentDef.expecting && !convoEngine.expectingsOverwrite)
        intentDef.expecting = intentDef.expecting.concat(convoEngine.expectings[decisionChildId]);
      else
        intentDef.expecting = convoEngine.expectings[decisionChildId];
    }
    if (!intentDef.expecting || intentDef.expecting.length == 0) warn(`<expecting> not found in ${decisionChildType}#${decisionChildId}`)

    // console.log(`tagging intentDef.resolve for ${decisionChildId} and ${decisionChildNode.name()}`);
    intentDef.resolve = (response) => {
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, decisionChildNode);
    };

    return intentDef;
  }

  static choiceHooksForRegistering(flowScriptDoc, convoEngine, parentGoalId, node, intentTags = intentWidgetTypes) {
    var respondArr = [];
    var intentTagSelector = intentTags.map(t=>`> ${t}`).join(', ');
    var intentTagNodes = node.find(intentTagSelector);
    intentTagNodes.forEach(child=>{
      var rTo = FlowScriptCompiler._choiceHooksToRespondTo(flowScriptDoc, convoEngine, child.name(), child.id(), parentGoalId);
      // console.log(`decisionNodeChild id: ${child.attribs.id} `, rTo)
      respondArr.push(rTo);
    });
    return respondArr;
  }

  static compile(flowScriptDoc, scriptModels, convoEngine, namespace='node') {
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
    const _numToA26 = (val)=>{
      if (val>25) return _numToA26(Math.floor(val/26)-1) + _numToA26(val%26)
      return String.fromCharCode(val+'a'.charCodeAt(0));
    };
    const idVisitor = (childNode, ndx, parent, /*visitParam*/ idPrefix, flowScriptDoc)=>{
      // Amazon's intent naming rule: must begin with an alphabetic character
      // and may only contain alphabets, periods, and underscores.
      if (idPrefix.length != 0) idPrefix += '_';
      const myId = idPrefix + _numToA26(ndx);
      if (!childNode.node.attr('id')) childNode.node.attr('id', myId);
      return childNode.node.attr('id');
    };
    FlowScriptCompiler.walkTree(flowScriptDoc, flowScriptDoc.root(), namespace, idVisitor);

    // prep-ii) compile input widgets (so that ASM widgets can use them)
    // not supported right now :-)

    // do) compile ASM widgets by converting to goals (really registering intents)
    debug(`Registered widgetHooks: `, Object.keys(widgetHooks));
    Object.keys(widgetHooks).forEach(widgetName=>{
      flowScriptDoc.selector(widgetName).forEach(node=>{
        debug(`Hooking <${widgetName}> id:${node.id()}`);
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

  //////////////////////////
  // Run-time Interpreter
  //////////////////////////
  static resolveElementForOutlet(response, flowScriptDoc, node) {
    if (widgetsImpl[node.name()]) {
      debug(`:: Executing: ${node.name()}#${node.id()}`);
      return widgetsImpl[node.name()](response, flowScriptDoc, node);
    } else {
      console.error(`ERROR - Dont know how to handle conversation nodes of type:${node.name()} id:${node.id()}`);
      response.say(`Dont know how to handle conversation nodes of type ${node.name()}`);
      // console.trace('Unexpected node name is undefined');
    }
  }

  static resolveElementChildrenForOutlet(response, flowScriptDoc, elNode, exceptions={}) {
    // el = elNode.el;
    // console.log('el: ', el.name)
    // console.log(`> resolveElementChildrenForOutlet: ${el.name} #${el.attribs.id} - ${elNode.text()}`)
    var elChildren = elNode.children();
    return Promise.mapSeries(elChildren, child=>{
      if (exceptions.hasOwnProperty(child.name())) return;
      return FlowScriptCompiler.resolveElementForOutlet(response, flowScriptDoc, child);
    });
  }

  //////////////////////////
  // Widget Registration API
  //////////////////////////
  static registerWidgetImpl(name, cb=nullCB) {
    widgetsImpl[name] = cb;
  }
  // we won't process these elements
  static registerNonNestableWidgetImpl(name, cb=nullCB) {
    widgetsImpl[name] = cb;
    implNotNestable.push(name);
  }
  static registerWidgetHook(name, cb) {
    widgetHooks[name] = cb;
  }
  static registerIntentWidgetType(name) {
    intentWidgetTypes.push(name)
  }

  /**
   * Registers a Conversational Element (Widget) to be used in a FlowScript.
   * This method is intended to be called by Widget Implementations when loaded.
   *
   * @param {Object} widgetDef - widget definition
   * @param {String} widgetDef.name - name of the widget
   * @param {String} widgetDef.init - implementation for the widget that runs on
   *   every element that uses it
   * @param {Object} widgetDef.impl - implementation for the widget after it
   *   gets triggered, for example with say, prompt, etc
   * @param {Boolean} widgetDef.fIntentType - used to flag the parent widgets
   *   that are to be triggered when a user says something by calling their impl
   *   method. For example, this is used by the choice and the dialog widgets.
   * @param {Boolean} widgetDef.fNonNestable - used to flag widgets that are not
   *   to be processed by the FlowScriptCompiler, and are needed for example
   *   when there are non CFL elements nested inside the given widget. The most
   *   obvious example of this is say element which can include SSML tags.
   */
  static registerWidget({name, init, impl, fIntentType, fNonNestable}) {
    if (init) widgetHooks[name] = init;
    if (impl)
      widgetsImpl[name] = impl;
    else
      widgetsImpl[name] = nullCB;
    if (fIntentType) FlowScriptCompiler.registerIntentWidgetType(name);
    if (fNonNestable) implNotNestable.push(name);
  }

}


module.exports = FlowScriptCompiler;
