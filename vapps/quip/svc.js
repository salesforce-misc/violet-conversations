var quip = new require('./api.js');
var utils = new require('./utils.js');
var Promise = require('bluebird');
var cheerio = require('cheerio');


var client = new quip.Client({accessToken: process.env.QUIP_TOKEN});

module.exports.getAuthenticatedUser = function(cb) {
  client.getAuthenticatedUser(cb);
};

var getThread = module.exports.getThread = (tid, wdoc=true, ndx=0)=>{
  client.getThread(tid, function(err, thread) {
    if (err) {
      console.log(err);
      return;
    }
    if (!thread) {
      console.log(`${tid} has null thread`)
      return;
    }
    if (!wdoc)
      if (thread.html) delete thread.html;
    console.log(utils.prettyJSON(utils.spaces(2*ndx) + 't-child: ', thread));
  });
};

var getFolder = module.exports.getFolder = (fid, ndx=0)=>{
  client.getFolder(fid, function(err, folders) {
      if (!folders) {
        console.log(`${fid} has null folders`)
        return;
      }
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
  return getItemsP(tid, /*asList*/true).then((curItems)=>{
    var sid = null;
    if (curItems.children.length == 0) {
      sid = tid;
    } else {
      console.log(curItems);
      sid = curItems.children[curItems.children.length-1].id;
      console.log(sid);
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

var delParentRecursively = nestedObj => {
  delete nestedObj.parent;
  if (nestedObj.children)
    nestedObj.children.forEach(c=>{delParentRecursively(c);})
}
var isLower = (t1, t2) => {
  if (t2 == t1) return false; // nothing is lower than itself
  switch (t2) {
  case undefined: return true; // everything is lower than the root/top
  case 'h1': return true; // already returned for h1
  case 'h2':
    if (t1 == 'h1')
      return false;
    else // t1 == 'h3'
      return true;
  case 'h3': return false;
  };
}


// returns all lists inside thread (document)
var getItems = module.exports.getItems = (tid, asList, cb)=>{
  client.getThread(tid, function(err, thread) {
    if (err) cb(err, null);
    var doc = cheerio.load(thread.html);

    // all list items
    var items = {
      itemCnt: 0,
      children: []
    };
    var itemParent = items;
    doc('h1, h2, h3, div[data-section-style=7] li').each((ndx, el)=>{
      var cel = cheerio(el);
      var xtract = {
        tag:  cel.get(0).tagName, // temproary
        id:   cel.attr('id'),
        done: cel.attr('class')==='checked',
        text: cel.text().trim(),
      };
      if (xtract.tag === 'li') {
        xtract.html = cheerio(cel.children()[0]).html();
        itemParent.children.push(xtract);
        var ip = itemParent;
        while (ip != null) {
          ip.itemCnt++;
          ip = ip.parent;
        }
      } else { // h1, h2, h3
        if (asList) return; // we don't do anything with headings
        xtract.html = cel.html();
        xtract.children = [];
        xtract.itemCnt = 0;
        while (!isLower(xtract.tag, itemParent.tag)) {
          itemParent = itemParent.parent;
        }
        xtract.parent = itemParent;
        itemParent.children.push(xtract);
        itemParent = xtract;
      }
    });
    delParentRecursively(items);
    cb(null, items);
  });
};


var getItemsP = module.exports.getItemsP = Promise.promisify(getItems);
