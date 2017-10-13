
var yelp = require('yelp-fusion');

var clientId = process.env.YELP_CLIENT_ID;
var clientSecret = process.env.YELP_CLIENT_SECRET;

var processBusinesses = (businesses) => {
  // console.log(businesses[0].name);
  // console.log(businesses[0]);
  // console.log(businesses.length);
  businesses.forEach(b=>{
    console.log(b.categories);
  })

}



var p = yelp.accessToken(clientId, clientSecret).then(resp => {
  var token = resp.jsonBody.access_token;
  return yelp.client(token);
});

// p = p.then(client => {
//   return client.search({
//     term: 'Indian',
//     // location: 'san francisco, ca'
//     location: '02067'
//   }).then(response => {
//     processBusinesses(response.jsonBody.businesses);
//   });
// });

p = p.then(client => {
  return client.reviews('coriander-indian-bistro-sharon').then(response => {
    console.log(response.jsonBody.reviews);
  });
});

p.catch(e => {
  console.log(e);
});
