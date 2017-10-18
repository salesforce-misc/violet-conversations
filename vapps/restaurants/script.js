'use strict';

var violet = require('../../lib/violet').script();
var violetTime = require('../../lib/violetTime')(violet);

var yelpSvc = require('./yelp.js');

module.exports = violet;

var mainCats = ['korean', 'italian', 'french'];

violet.addInputTypes({
  'category': {
      // we eventually want a custom slot type for this
      type: 'AMAZON.LITERAL',
      sampleValues: mainCats
  }
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
  cache.search[categories].forEach(biz=>{
    biz.categories.forEach(c=>{
      if (!catNdx[c.alias]) catNdx[c.alias]={alias:c.alias, name:c.title, cnt:0};
      catNdx[c.alias].cnt++;
    });
  });
  // console.log('catNdx: ', catNdx);
  var cats = Object.keys(catNdx);
  cache.topCats[categories] = cats
        .map(k=>{return catNdx[k];})
        .sort((c1, c2) => {
          return c2.cnt - c1.cnt;
        })
        .slice(0, Math.min(cats.length, 10));
  // console.log('cache.topCats[categories]: ', cache.topCats[categories]);
}

var _searchAndAggregateFn = (cat) => {
    return ()=>{
      return _buildCacheFromSearchResults(cat)
        .then(()=>{
          _updateCacheAggregates(cat);
        });
    }
};
var buildCache = () => {
  var p = yelpSvc.init(lat, lon)
    .then(_searchAndAggregateFn('restaurants'));
  mainCats.forEach(c=>{
    p = p.then(_searchAndAggregateFn(c));
  });
    // .then(_searchAndAggregateFn('korean'))
  p.catch(e=>{
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
  if (!cache.topCats[category]) {
    response.say(`Sorry, I do not know anything about ${category}`)
    return;
  }
  var cats = cache.topCats[category].filter(c=>{return c.alias !== category;})
  response.say(`They are mostly ${cats[0].name}, ${cats[1].name}, and ${cats[2].name}`)
}

violet.respondTo(['what is your top {recommended|} restaurant'],
  (response) => {
    return sayTop(response, 'restaurants');
});

violet.respondTo(['what is your top {recommended|} [[category]] restaurant'],
  (response) => {
    var category = response.get('category')
    return sayTop(response, category);
});

violet.respondTo(['what restaurants would you recommend'],
  (response) => {
    response.say([
      'We have a number of restaurant that I like here.',
      'There are a number of great restaurant here.',
      'There are a number of popular restaurant here.',
    ]);
    saySummary(response, 'restaurants');
    // response.addGoal('categoryOrTop');
});

violet.respondTo(['what [[category]] restaurants would you recommend'],
  (response) => {
    response.say([
      'We have a number of restaurant that I like here.',
      'There are a number of great restaurant here.',
      'There are a number of popular restaurant here.',
    ]);
    var category = response.get('category')
    saySummary(response, category);
    // response.addGoal('categoryOrTop');
});

buildCache();
