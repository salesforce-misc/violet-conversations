var quip = new require('./api.js');
var utils = new require('./utils.js');
var Promise = require('bluebird');



var client = new quip.Client({accessToken: process.env.QUIP_TOKEN});

module.exports.getThread = (tid, wdoc=true, ndx=0)=>{
  client.getThread(tid, function(err, thread) {
    if (!wdoc)
      delete thread.html;
    console.log(utils.prettyJSON(utils.spaces(2*ndx) + 't-child: ', thread));
  });
};

module.exports.getFolder = (fid, ndx=0)=>{
  client.getFolder(fid, function(err, folders) {
      console.log(utils.prettyJSON(utils.spaces(2*ndx) + 'child: ', folders));
      folders.children.forEach((child)=>{
        if (child['folder_id']) getFolder(child['folder_id'], ndx+1);
        if (child['thread_id']) getThread(child['thread_id'], /*wdoc*/false, ndx+1);
      });
  });
};

module.exports.addListItems = (tid, sid, items)=>{
  // really add to end
  var params = {
    threadId: tid,
    sectionId: sid,
    format: 'markdown',
    content: items.join('\n\n'),
    operation: quip.Operation.AFTER_SECTION
  };
  client.editDocument(params, function(err) {
      if (err) console.log(err);
  });
};

module.exports.appendItemsToList = (tid, items)=>{
  return quipSvc.getListItemP(tid).then((curItems)=>{
    var sid = null;
    if (curItems.length == 0) {
      sid = tid;
    } else {
      sid = curItems[curItems.length-1].id;
      // really add to end
      var params = {
        threadId: tid,
        sectionId: sid,
        format: 'markdown',
        content: items.join('\n\n'),
        operation: quip.Operation.AFTER_SECTION
      };
      client.editDocument(params, function(err) {
          if (err) console.log(err);
      });
    }
  });
};

module.exports.modifyListItem = (tid, sid, items)=>{
  // really add to end
  var params = {
    threadId: tid,
    sectionId: sid,
    format: 'markdown',
    content: items.join('\n\n'),
    operation: quip.Operation.REPLACE_SECTION
  };
  client.editDocument(params, function(err) {
      if (err) console.log(err);
  });
};


// returns all lists inside thread (document)
var getListItem = module.exports.getListItem = (tid, cb)=>{
  client.getThread(tid, function(err, thread) {
    if (err) cb(err, null);
    var cheerio = require('cheerio');
    var doc = cheerio.load(thread.html);

    // all list items
    var items = [];
    doc('div[data-section-style=7] li').each((ndx, el)=>{
      var cel = cheerio(el);
      items.push({
        id:   cel.attr('id'),
        done: cel.attr('class')==='checked',
        text: cel.text().trim(),
        html: cheerio(cel.children()[0]).html()
      });
    });
    cb(null, items);
  });
};

module.exports.getListItemP = Promise.promisify(getListItem);
