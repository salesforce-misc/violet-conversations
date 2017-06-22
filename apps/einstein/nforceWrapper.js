var nforce = require('nforce');
var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var readyForQuery = false;

function days_between(date1, date2) {

    // The number of milliseconds in one day
    var ONE_DAY = 1000 * 60 * 60 * 24

    // Convert both dates to milliseconds
    var date1_ms = date1.getTime()
    var date2_ms = date2.getTime()

    // Calculate the difference in milliseconds
    var difference_ms = Math.abs(date1_ms - date2_ms)

    // Convert back to days and return
    return Math.round(difference_ms/ONE_DAY)

}

var org = nforce.createConnection({
  clientId: '3MVG9CEn_O3jvv0xvI7vP9xy6IOxenZhffeVUMDB4em7lwBscmoOiEppz0vvG1aPnxkfNutT33UT0kIS2lkpP',
  clientSecret: '5942961125728216688',

  redirectUri: 'http://localhost:3000/oauth/_callback',
  // apiVersion: 'v27.0',  // optional, defaults to current salesforce API version
  // environment: 'production',  // optional, salesforce 'sandbox' or 'production', production default
  mode: 'single' // optional, 'single' or 'multi' user mode, multi default
});

org.authenticate({ username: 'hls-test@salesforce.com', password: 's@lesforce1'}, function(err, resp){
  // the oauth object was stored in the connection object
  if(err) {
    console.log('err: ', err);
    return;
  }
  console.log('Cached Token: ' + org.oauth.access_token);

  readyForQuery = true;
});

var nforceWrapper = {

  queryAppt: (doctorName)=>{
    var apptDate = new Date();

    var q = 'SELECT appointment_date_time__c FROM appointment__c WHERE doctor_name__c = \'' + doctorName +'\' ORDER BY appointment_date_time__c ASC NULLS FIRST LIMIT 1' ;
    
    org.query({ query: q }, function(err, resp){
        if (err) {
          console.log('err', err);
          return;
        }
        if (!resp.records) {
          console.log('no results');
          return;
        }

        //console.log(resp);

        if (resp.records && resp.records.length) {
          resp.records.forEach(function(rec) {
            console.log(rec.get('appointment_date_time__c'));
            apptDate = new Date(rec.get('appointment_date_time__c'));
          });
        }

      });

    return apptDate;
  },

  query: (objName, whereClause)=>{
    var q = 'SELECT appointment_date_time__c FROM appointment__c WHERE doctor_name__c = \'fred\' ORDER BY appointment_date_time__c ASC NULLS FIRST LIMIT 1' ;

    org.query({ query: q }, function(err, resp){
        console.log('query' + q);

        if (err) {
          console.log('err', err);
          return;
        }
        if (!resp.records) {
          console.log('no results');
          return;
        }

        console.log(resp);
      });
  },

  create: (objName, reminderText)=> {
    console.log('calling create');
    var reminder = nforce.createSObject(objName);
    reminder.set('text__c', reminderText);

    org.insert({ sobject: reminder}, function(err, resp){
      if(!err) 
        console.log('It worked!');
      if (err) {
        console.log('it failed');
        console.log(err);
      }

    });

  }
}

module.exports = { 
  getDB : function() {
    return nforceWrapper;
  }
};

module.exports.isReady = function() {
    return readyForQuery;
};