var yelpSvc = new require('./yelp.js');

/* locations */
// Sharon
// var lat =  42.123392;
// var lon = -71.175288;
// lat = 42.351384; lon = -71.055411; // south station, boston, ma
// lat = 42.365284; lon = -71.104366; // central square, cambridge, ma
// lat = 42.373570; lon = -71.118966; // harvard square, cambridge, ma

// San Fran
var lat =   37.786714;
var lon = -122.411129;


// from http://www.geodatasource.com/developers/javascript
// unit: default = miles
var distance = (lat1, lon1, lat2, lon2, unit) => {
	var radlat1 = Math.PI * lat1/180
	var radlat2 = Math.PI * lat2/180
	var theta = lon1-lon2
	var radtheta = Math.PI * theta/180
	var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
	dist = Math.acos(dist)
	dist = dist * 180/Math.PI
	dist = dist * 60 * 1.1515
	if (unit=="K") { dist = dist * 1.609344 }
	if (unit=="N") { dist = dist * 0.8684 }
	return dist
}

var catList = {};

var extractCategories = (businesses) => {
  // console.log(businesses[0].name);
  // console.log(businesses[0]);
  // console.log(businesses.length);
  businesses.forEach(b=>{
    console.log(b.name);
    // console.log(b.categories);
    b.categories.forEach(c=>{
      if (!catList[c.alias]) catList[c.alias]={name:c.title, cnt:0};
      catList[c.alias].cnt++;
    });
    // console.log(distance(lat, lon, b.coordinates.latitude, b.coordinates.longitude));
  })
}


yelpSvc.init(lat, lon).then(()=>{
  return yelpSvc.search(null, 'restaurants', extractCategories);
}).then(()=>{
  var sortList = Object
        .keys(catList)
        .map(k=>{return catList[k];})
        .sort((c1, c2) => {
          return c2.cnt - c1.cnt;
        })
  console.log('sortList:\n', sortList);
}).catch(e => {
  console.log(e);
});
