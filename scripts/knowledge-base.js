'use strict';

var violet = require('../lib/violet.js')('einstein');
var violetUtils = require('../lib/violetUtils.js')(violet);

var violetSFStore = require('../lib/violetSFStore.js');
violet.setPersistentStore(violetSFStore.store);
violetSFStore.store.propOfInterest = {
  'KnowledgeArticleVersion*': ['Id*', 'Title*', 'Summary*', 'UrlName*', 'LastPublishedDate*']
}

violet.addKeyTypes({
  "articleNo": "NUMBER",
  "searchTerm": {
    "type": "LITERAL",
    "sampleValues": ["security", "data"]
  }
});


var getArticleResultText = (ndx, results)=>{
  var kbArtObj = results[ndx];
  return 'Article ' + (ndx+1) + ' is ' + kbArtObj.Title + '. ';
};

var respondWithKnowledgeSearchResults = (response, results)=>{
  if (results.length == 0) {
    response.say('Sorry. I did not find any information on [[searchTerm]].');
    return;
  }

  var out = 'I found ' + results.length + ' articles. '
  for(var ndx=0; ndx<3 && ndx<results.length; ndx++) {
    out += getArticleResultText(ndx, results);
  }
  response.say(out);

  if (results.length>3)
    response.addGoal('{{hearPastThreeCases}}')
  else
    response.addGoal('{{interactWithCases}}')
}
var respondWithMoreKnowledgeSearchResults = (response, results, start=0)=>{
  var out = '';
  for(var ndx=3+start; ndx<10+start && ndx<results.length; ndx++) {
    out += getArticleResultText(ndx, results);
  }
  response.say(out);

  if (results.length>10 && start==0) // we dont speak past 17 cases
    response.addGoal('{{hearPastTenCases}}')
  else
    response.addGoal('{{interactWithCases}}')
}

var getArticleFromResults = (response)=>{
  var articleNo = response.get('[[articleNo]]');
  const errMgrNotFoundArticles = 'Could not find articles';
  const errMgrNotFoundTgtArticle = 'Could not find article ' + articleNo;
  const errMgrInvalidArticleNo = 'Invalid Article Number';
  if (articleNo) {
    articleNo = parseInt(articleNo)-1;
  }
  if (articleNo == undefined || articleNo == null || articleNo<0 || articleNo>17)
    return response.say(errMgrInvalidArticleNo);

  var results = response.get('{{KnowledgeSearchResults}}');
  if (results == undefined || results == null || !Array.isArray(results))
    return resposne.say(errMgrNotFoundArticles);
  if (results.length<articleNo)
    return resposne.say(errMgrNotFoundArticles);

  return results[articleNo];
}

violet.defineGoal({
  goal: '{{hearPastThreeCases}}',
  prompt: ['Do you want to hear more cases?'],
  respondTo: [{
    expecting: ['Yes'],
    resolve: (response) => {
     response.say('Getting more cases.');
     var results = response.get('{{KnowledgeSearchResults}}');
     respondWithMoreKnowledgeSearchResults(response, results);
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.addGoal('{{interactWithCases}}');
  }}]
});

violet.defineGoal({
  goal: '{{hearPastTenCases}}',
  prompt: ['Do you want to hear more cases?'],
  respondTo: [{
    expecting: ['Yes'],
    resolve: (response) => {
     response.say('Getting more cases.');
     var results = response.get('{{KnowledgeSearchResults}}');
     respondWithMoreKnowledgeSearchResults(response, results, 10);
  }}, {
    expecting: ['No'],
    resolve: (response) => {
      response.addGoal('{{interactWithCases}}');
  }}]
});


violet.defineGoal({
  goal: '{{interactWithCases}}',
  prompt: ['Would you like to hear more from an article or have an article sent to you.'],
  respondTo: [{
    expecting: ['{hear|} more about article [[articleNo]]'],
    resolve: (response) => {
      var kbArtObj = getArticleFromResults(response);
      response.say('Article ' + kbArtObj.Title + ' has summary ' + kbArtObj.Summary);
  }}, {
    expecting: ['send me article [[articleNo]]'],
    resolve: function *(response) {
      var kbArtObj = getArticleFromResults(response);
      // article sending not implemented
      response.say('Article ' + kbArtObj.Title + ' has been sent');
  }}]
});


violet.respondTo({
  expecting: ['I am looking for {information on|} [[searchTerm]]'],
  resolve: function *(response) {
    var results = yield response._persistentStore().search('KnowledgeArticleVersion*', response.get('[[searchTerm]]'));
    response.set('{{KnowledgeSearchResults}}', results);
    respondWithKnowledgeSearchResults(response, results);
}});


violet.registerIntents();

module.exports = violet;
