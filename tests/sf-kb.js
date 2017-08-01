
var violet = require('../lib/violet.js').script();
var violetTime = require('../lib/violetTime.js')(violet);

var violetSFStore = require('../lib/violetSFStore.js');

violet.setPersistentStore(violetSFStore.store);


// mock objects
var response = violet._getResponseForDebugging({
  getSession: ()=>{}
}, {});

// test prep
violetSFStore.store.propOfInterest = {
  'KnowledgeArticleVersion*': ['Id*', 'Title*', 'Summary*', 'UrlName*', 'LastPublishedDate*']
}

// test methods
var loadAllAddressTest = () => {
  setTimeout(()=>{
    response._persistentStore().search('KnowledgeArticleVersion*', 'security')
      .then((records)=>{
        console.log('search results:', records);
        console.log('found ' + records.length + ' records');
      });
  }, 2*1000);
};



// storeTest();
loadAllAddressTest();
