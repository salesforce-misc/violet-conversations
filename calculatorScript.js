/*
 * Calculator Test Script - targeting testing of Platforms
 */

var violet = require('./lib/violet').script(null, require('./lib/googlePlatform.js'));
// var violet = require('./lib/violet').script(null, require('./lib/alexaPlatform.js'));

violet.addInputTypes({
  "NumOne": "NUMBER",
  "NumTwo": "NUMBER",
});

violet.respondTo('What can you do', (response) => {
  response.say('I can add, subtract, multiply, or divide two numbers');
});

violet.respondTo('I want to add', (response) => {
  response.say('Sure'); response.addGoal('add')
});
violet.respondTo('I want to subtract', (response) => {
  response.say('Sure'); response.addGoal('subtract')
});
violet.respondTo('I want to multiply', (response) => {
  response.say('Sure'); response.addGoal('multiply')
});
violet.respondTo('I want to divide', (response) => {
  response.say('Sure'); response.addGoal('divide')
});

violet.defineGoal({
  goal: 'add',
  prompt: 'What two numbers would you like me to add',
  respondTo: [{
    expecting: '[[NumOne]] and [[NumTwo]]',
    resolve: (response) => {
      response.say(`The sum of ${response.get('NumOne')} and ${response.get('NumTwo')} is ${parseInt(response.get('NumOne'))+parseInt(response.get('NumTwo'))}`);
  }},{
    expecting: 'cancel',
    resolve: (response) => {
      response.say('Canceling Addition');
  }}]
});
violet.defineGoal({
  goal: 'subtract',
  prompt: 'What two numbers would you like me to subtract',
  respondTo: [{
    expecting: '[[NumOne]] and [[NumTwo]]',
    resolve: (response) => {
      response.say(`Subtracting ${response.get('NumTwo')} from ${response.get('NumOne')} gives ${parseInt(response.get('NumOne'))-parseInt(response.get('NumTwo'))}`);
  }},{
    expecting: 'cancel',
    resolve: (response) => {
      response.say('Canceling Subtraction');
  }}]
});
violet.defineGoal({
  goal: 'multiply',
  prompt: 'What two numbers would you like me to multiply',
  respondTo: [{
    expecting: '[[NumOne]] and [[NumTwo]]',
    resolve: (response) => {
      response.say(`Multiplying ${response.get('NumOne')} and ${response.get('NumTwo')} gives ${parseInt(response.get('NumOne'))*parseInt(response.get('NumTwo'))}`);
  }},{
    expecting: 'cancel',
    resolve: (response) => {
      response.say('Canceling Multiplication');
  }}]
});
violet.defineGoal({
  goal: 'divide',
  prompt: 'What two numbers would you like me to divide',
  respondTo: [{
    expecting: '[[NumOne]] and [[NumTwo]]',
    resolve: (response) => {
      response.say(`Dividing ${response.get('NumOne')} by ${response.get('NumTwo')} gives ${parseInt(response.get('NumOne'))/parseInt(response.get('NumTwo'))}`);
  }},{
    expecting: 'cancel',
    resolve: (response) => {
      response.say('Canceling Division');
  }}]
});
