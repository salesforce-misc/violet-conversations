'use strict';

var violet = require('../../lib/violet').script();
var violetTime = require('../../lib/violetTime')(violet);

var yelpSvc = require('./yelp.js');

module.exports = violet;

violet.addInputTypes({
});

// San Fran
var lat =   37.786714;
var lon = -122.411129;


var cache = {
  search: {},
  topCats: {},
};

var _buildCacheFromSearchResults = (categories)=>{
  return yelpSvc.search(null, categories).then((results)=>{
    // console.log('search results: ', JSON.stringify(results, null, 2));
    cache.search[categories] = results;
  });
}
var _updateCacheAggregates = (categories)=>{
  var catNdx = {};
  // console.log('cache: ', cache);
  cache.search[categories].forEach(biz=>{
    // console.log('biz: ', biz);
    biz.categories.forEach(c=>{
      if (!catNdx[c.alias]) catNdx[c.alias]={name:c.title, cnt:0};
      catNdx[c.alias].cnt++;
    });
  });
  cache.topCats[categories] = Object
        .keys(catNdx)
        .map(k=>{return catNdx[k];})
        .sort((c1, c2) => {
          return c2.cnt - c1.cnt;
        })
        .slice(0, Math.min(catNdx.length, 10));
}

var buildCache = () => {
  yelpSvc.init(lat, lon)
    .then(()=>{
      return _buildCacheFromSearchResults('restaurants')
    }).then(()=>{
      _updateCacheAggregates('restaurants');
    }).catch(e=>{
      console.log(e);
    });
};

violet.respondTo(['display cache'],
  (response) => {
    console.log(JSON.stringify(cache, null, 2));
    response.say('done');
});


var sayTop = (response, category) => {
  if (!cache.search[category]) {
    response.say(`Sorry, I do not know anything about ${category}`)
    return;
  }
  response.say(`My favorite restaurant is ${cache.search[category][0].name}`)
}
var saySummary = (response, category) => {

}

violet.respondTo(['what is your top recommended restaurant'],
  (response) => {
    return sayTop(response, 'restaurants');
});

violet.respondTo(['what restaurants would you recommend'],
  (response) => {
    response.say(`We have a number of good restaurants close by.`);
    saySummary(response, 'restaurants');
    response.addGoal('createLead');
});

buildCache();
