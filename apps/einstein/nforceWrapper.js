var nforce = require('nforce');
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
});

var nforceWrapper = {
  query: (objName, whereClause)=>{
    var q = 'SELECT appointment_date_time__c ';
    q+= ' FROM ' + objName+'__c';

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
  }
}

module.exports = { 
  getDB : function() {
    return nforceWrapper;
  }
}