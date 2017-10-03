'use strict';

var violet = require('../lib/violet.js').script();
var violetClientTx = require('../lib/violetClientTx.js')(violet);
var violetTime = require('../lib/violetTime.js')(violet);
var violetKnowledgeResultsList = require('../lib/violetList.js')(violet, 'KnowledgeResults', 'article', 'articles', 'Title');

var violetSFStore = require('../lib/violetStoreSF.js')(violet);
violetSFStore.store.propOfInterest = {
  'KnowledgeArticleVersion*': ['Id*', 'Title*', 'Summary*', 'UrlName*', 'LastPublishedDate*']
}

violet.addInputTypes({
  "articleNo": "NUMBER",
  "searchTerm": {
    "type": "LITERAL",
    "sampleValues": ["security", "data"]
  }
});

violetKnowledgeResultsList.defineItemInteraction({
  prompt: [`Would you like to hear more from an article or have an article sent to you.`],
  respondTo: [{
    expecting: [`{hear|} more about article [[articleNo]]`],
    resolve: (response) => {
      var article = violetKnowledgeResultsList.getItemFromResults(response, response.get('articleNo'));
      response.say('Article ' + article.Title + ' has summary ' + article.Summary);
  }}, {
    expecting: [`send me article [[articleNo]]`],
    resolve: function *(response) {
      var itemObj = listWidget.getItemFromResults(response, response.get('articleNo'));
      // item sending not implemented
      response.say(humanName + ' ' + itemObj.Title + ' has been sent');
  }}]
});


violet.respondTo({
  expecting: ['I am looking for {information on|} [[searchTerm]]'],
  resolve: function *(response) {
    var results = yield response._persistentStoreReal().search('KnowledgeArticleVersion*', response.get('searchTerm'));
    response.set('KnowledgeResults', results);
    if (results.length == 0) {
      response.say('Sorry. I did not find any information on [[searchTerm]].');
      return;
    }
    violetKnowledgeResultsList.respondWithItems(response, results);
}});


module.exports = violet;
