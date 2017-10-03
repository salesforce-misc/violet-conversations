var quipSvc = new require('./svc.js');
var utils = new require('./utils.js');


// dig into starred folders
// client.getAuthenticatedUser(function(err, user) {
//   console.log(utils.prettyJSON('user: ', user));
//   quipSvc.getFolder(user['starred_folder_id']);
// });

var mainDoc = 'TddAAATIqbb';

// dig into particular document with checklist (thread-id: badAAAkqM49)
// quipSvc.getThread(mainDoc);

// add items to thread after section
// quipSvc.appendItemsToList(mainDoc, ['BBB - 10', 'BBB - 20']);

// edit items
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['the future is now']);
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['<del>The test item</del>']);

// mark a checkbox as completed
// ***need to get this working***
// quipSvc.modifyListItem(mainDoc, 'TddACAurP6C', ['<del>The test item</del>']);

// list items
// quipSvc.getListItem(mainDoc, (err, items)=>{
//   console.log(items)
// });
