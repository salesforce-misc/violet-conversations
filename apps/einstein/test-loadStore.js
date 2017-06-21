
// module.exports = require('./demo1-script.js');
// module.exports = require('./fins-script.js');
// module.exports = require('./sample-tutorial-script.js');
// module.exports = require('./hls-diabetes-script.js');


var alexa = require('alexa-app');
var app = new alexa.app('einstein');
var violet = require('../../lib/violet.js')(app);
var violetUtils = require('../../lib/violetUtils.js')(violet);
var violetSFStore = require('../../lib/violetSFStore.js');
var nforceWrapper = require('./nforceWrapper.js');
var db = nforceWrapper.getDB();

var loadTest = () => {
  setTimeout(()=>{
    db.query('appointment', '');
  }, 3*1000);
};


loadTest();