var quipSvc = new require('./svc.js');
var utils = new require('./utils.js');


// dig into starred folders
// quipSvc.getAuthenticatedUser(function(err, user) {
//   console.log(utils.prettyJSON('user: ', user));
//   quipSvc.getFolder(user['starred_folder_id']);
// });

var mainDoc = process.env.QUIP_TGT_DOC_ID;

// dig into particular document with checklist
// quipSvc.getThread(mainDoc);

// add items to thread after section
// quipSvc.appendItems(mainDoc, ['BBB - 10', 'BBB - 20']);

// edit items
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['the future is now']);
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['<del>The test item</del>']);

// mark a checkbox as completed
// ***need to get this working***
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['<del>The test item</del>']);

// list items
quipSvc.getItems(mainDoc, /*asList*/false, (err, items)=>{
  console.log(JSON.stringify(items, null, 2));
});
