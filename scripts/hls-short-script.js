'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);

violet.respondTo([
      "Hello"
    ], (response) => {
    response.say(['Hi!']);
});

violet.respondTo({
  name: 'MajorIntent',
  expecting: [
      "What are you doing"
    ],
  resolve: (response) => {
    response.say(`Major thing happened.`);
}});


module.exports = violet;
