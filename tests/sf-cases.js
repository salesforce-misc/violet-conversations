
var violet = require('../lib/violet.js')('einstein');
var violetTime = require('../lib/violetTime.js')(violet);

var violetSFStore = require('../lib/violetSFStore.js');

violet.setPersistentStore(violetSFStore.store);


// mock objects
var response = violet._getResponseForDebugging({
  getSession: ()=>{}
}, {});

// test prep
violetSFStore.store.propOfInterest = {
  'Case*': ['Id*', 'CaseNumber*', 'Contact*.Name*', /*'Contact*.Owner*.Name*',*/ 'Subject*', 'Status*', 'Priority*']
}

// test methods
var loadAllTest = () => {
  setTimeout(()=>{
    response.load('Case*')
      .then((records)=>{
        console.log('load results:', records);
        console.log('loaded ' + records.length + ' records');
      });
  }, 2*1000);
};

var loadUserCaseTest = () => {
  setTimeout(()=>{
    response.load('Case*', 'Contact*.Name*', 'Stella Pavlova', null, 'order by LastModifiedDate limit 1')
      .then((records)=>{
        console.log('load results:', records);
        console.log('loaded ' + records.length + ' records');
      });
  }, 2*1000);
};

var loadEmpCaseTest = () => {
  setTimeout(()=>{
    response.load('Case*', 'Owner*.Alias*', 'VSinh')
      .then((records)=>{
        console.log('load results:', records);
        console.log('loaded ' + records.length + ' records');
      });
  }, 2*1000);
};

var updateCaseStatusTest = () => {
  setTimeout(()=>{
    response.update('Case*', 'CaseNumber*', '00001021', {'Status*': 'New'});
  }, 2*1000);
};

var storeCaseCommentTest = () => {
  setTimeout(()=>{
    response.load('Case*', 'Contact*.Name*', 'Stella Pavlova', null, 'order by LastModifiedDate limit 1')
      .then((results)=>{
        console.log(results[0].Subject)
        console.log(results[0].Id)
        response.store('CaseComment*', {
          'CommentBody*': 'Text String',
          'ParentId*': results[0].Id
        });
      });
  }, 2*1000);
};

loadAllTest();
// loadUserCaseTest();
// loadEmpCaseTest();
// updateCaseStatusTest();
// storeCaseCommentTest();
