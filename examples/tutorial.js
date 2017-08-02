'use strict';

var violet = require('../lib/violet.js').script();
module.exports = violet;

////////////////
// 101 - basics
////////////////
violet.addKeyTypes({
  'name': 'AMAZON.US_FIRST_NAME',
});

violet.respondTo(['My name is [[name]]'],
 (response) => {
   response.say('I like the name [[name]]')
 });

 ////////////////
 // 102 - making it more real
 ////////////////

violet.addPhraseEquivalents([
  ['My name is', 'I call myself'],
]);

////////////////
// 103 - a few bells and whistles: allowing complexity, optional input commands, setting and using conversational variables
////////////////
violet.addKeyTypes({
  'city': 'AMAZON.US_CITY',
  'age': 'NUMBER',
});

violet.respondTo({
  expecting: ['I live in [[city]]', 'My house is in [[city]]', 'We are renting in [[city]]'],
  resolve: (response) => {
   response.say('I like the city [[city]]')
}});

violet.respondTo({
  expecting: 'My age is [[age]]',
  optionalPostfix: 'years old',
  resolve: (response) => {
   response.say('I will remember the you are [[age]]')
   response.set('[[age]]', response.get('[[age]]') );
}});

violet.respondTo('How old am I?',
  (response) => {
    if (response.get('[[age]]'))
      response.say('You are [[age]] years old');
    else
      response.say('I do not know how old you are');
});

////////////////
// 104 - persistence
////////////////

violet.respondTo('I recieved a bill from [[company]] today for [[amount]]',
  (response) => {
    response.store('bills',
        'user': response.get('[[userId]]'),
        'from': response.get('[[company]]'),
        'amount': response.get('[[amount]]')
      });
    response.say('xxxx');
});

// caution: load returns a promise to the db results  - if you need to use the
// values retrieved from it, you need to (a) either use a .then after it OR
// (b) you need to make you resolve method a generator and place a yield before
// the call to the load method
// example a:
violet.respondTo(
  expecting: 'Who did I receive my bill from most recently?',
  resolve: (response) => {
    return response.load('bills', 'bills.user', response.get('[[userId]]') )
      .then(()=>{
        response.say('You received a bill from <<bills.from>> for <<bills.amount>>');
      });
});
// example b: (note the 'function *' and the 'yield' below)
violet.respondTo(
  expecting: 'Who did I receive my bill from most recently?',
  resolve: function *(response) {
    yield response.load('bills', 'bills.user', response.get('[[userId]]') )
    response.say('You received a bill from <<bills.from>> for <<bills.amount>>');
});


////////////////
// 201 - conversational primitives
////////////////

/*
- does context need to be seperate from variables
- do goals need to be seperate
- ask vs say
*/
violet.addKeyTypes({
  'airline': 'LITERAL',
  'city': 'AMAZON.US_CITY',
  'flightDay': 'LITERAL',
});

violet.respondTo('What time does the [[airline]] flight arrive', 'from [[city]]',
  (response) => {
    response.addGoal('[[flightArrivalTime]]');
});

violet.respondTo('What time does the flight arrive from [[city]]',
  (response) => {
    response.addGoal('[[flightArrivalTime]]');
});

violet.defineGoal({
  goal: '[[flightArrivalTime]]',
  resolve: (response) => {
    if (!response.goalFilled('airline')
        || !response.goalFilled('city')
        || !response.goalFilled('flightDay') ) {
          return false; // dependent goals not met
        }
    var airline = response.get('[[airline]]');
    var city = response.get('[[city]]');
    var flightDay = response.get('[[flightDay]]');
    flightArrivalTimeSvc.query(airline, city, flightDay, (arrivalTime)=>{
      response.say('Flight ' + airline + ' from ' + city + ' is expected to arrive ' + flightDay + ' at ' + arrivalTime);
    });
    return true;
  }
});

violet.defineGoal({
  goal: '[[airline]]',
  /*(resolve: func) OR (prompt and [L;respondTo)*/
  prompt: ['What airline', 'What airlines are you looking for the arrival time?'],
  respondTo: [{
    expecting: '[[airline]]',
    resolve: (response) => {
      response.set('[[airline]]', response.get('[[airline]]') );
  }}]
});

violet.defineGoal({
  goal: '[[city]]',
  prompt: ['What city do you want the flight to be arriving from'],
  respondTo: [{
    expecting: '[[city]]',
    resolve: (response) => {
      response.set('[[city]]', response.get('[[city]]') );
  }}]
});

violet.defineGoal({
  goal: '[[flightDay]]',
  prompt: 'Are you looking for flights today, tomorrow, or the day after?',
  respondTo: [{
    expecting: '[[flightDay]]',
    resolve: (response) => {
      response.set('[[flightDay]]', response.get('[[flightDay]]') );
  }}]
});


// violet.defineGoal({
//   goal: '[[foo]]',
//   describe: '????'
//   ask: ['x', 'y', 'z'],
//   response: [],
//   process: (response) => {
//     response.addGoal('[[xxxx]]');
//     response.say('???')
//     response.ask('ssss')
//   }
// });
