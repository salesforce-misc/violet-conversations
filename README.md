[![Build Status](https://travis-ci.org/salesforce/violet-conversations.svg?branch=master)](https://travis-ci.org/salesforce/violet-conversations)

For easily deployable sample code see the [violet-samples](https://github.com/salesforce/violet-samples) project.

# violet-conversations

Violet provides support for building sophisticated conversational apps/bots on
Amazon's Alexa and Google Home. Conversations are built via scripts,
and Violet provides a conversation engine that runs as an Alexa Skill.

Support for sophisticated voice apps is supported by allowing:
* for easily building basic logic supported conversation-flows i.e.
classically referred to as the view layer in web, mobile, and desktop apps;
* low-level primitives for automated state-management; and
* plugins for moving out significant parts of complexity that support the
voice scripts.


## Table Of Contents

* [Conversation Flows](#conversation-flows)
  * [Basics](#basics)
  * [User Inputs](#user-inputs)
  * [Separating Controller & Flow Logic](#separating-controller--flow-logic)
* [Low-level](#low-level)
  * [Basic API](#basic-api)
  * [Conversational Goals](#goals)
* [Plugins](#plugins)
  * [Persistence](#persistence)
* [Advanced Topics](#advanced-topics)
  * [Custom types](#custom-types)
* [Debugging Conversations](#debugging-conversations)
* [Contribution/Supporting](#contributionsupporting)



## Conversation Flows

This project contains the Violet Conversation Engine that can be used as the basis of your Voice Application.

Every voice script should start will typically start with declaring `violet` for use
throughout:
```javascript
var violet = require('violet').script();
```

### Basics

A simple way to respond to a user request (choice):
```javascript
violet.addFlow(`<app>
  <choice>
    <expecting>Can you help me</expecting>
    <expecting>What can I do</expecting>
    <say>
      I can help you with your current account balance, with
      financial planning, budgeting, investing, or taking out
      a loan
    </say>
  </choice>
</app>`)
 ```

### User Inputs

If you want to accept data from a user, you will need to declare it with its
type and then tell the script engine where to expect it:
```javascript
violet.addInputTypes({
  'name': 'firstName',
});

violet.addFlow(`<app>
  <choice>
    <expecting>My name is [[name]]</expecting>
    <say>I like the name [[name]]</say>
  </choice>
</app>`)
```

To have your script accept multiple inputs from the user, you can combine the `<choice>` elements like:
```javascript
// ...

violet.addFlow(`<app>
  <choice>
    <expecting>Can you help me</expecting>
    <expecting>What can I do</expecting>
    <say>
      I can help you with your current account balance, with
      financial planning, budgeting, investing, or taking out
      a loan
    </say>
  </choice>

  <choice>
    <expecting>My name is [[name]]</expecting>
    <say>I like the name [[name]]</say>
  </choice>
</app>`)
```

### Separating Controller & Flow Logic

Most Voice Apps will want Conversation Flows to  be loaded from external files by doing:
```javascript
violet.loadFlowScript('script.cfl', {app: appController});
```

The second parameter to `loadFlowScript` and `addFlow` allows for injecting in a pointer to a controller and other services. This paramater is a list of objects that can be referenced from within a flow script, using either `<resolve>` tags or within a `<say>` tag using `[[expression]]`.

## Low-level

Violet also has a lower level api that voice apps can use. These API's allow you to hook into an automated state management engine (using Goals) so that you don't need to account for states throughout your app.

The Conversational Flow support builds on this low-level API.

### Basic API

Feel free to see [`tutorials/introduction.js`](https://github.com/salesforce/violet-samples/blob/master/tutorials/introduction.js) for an example on how to build a skill.

A simple way to respond to a user request:
```javascript
violet.respondTo(['Can you help me', 'What can I do'],
 (response) => {
   response.say(`I can help you with your current account balance, with
                  financial planning, budgeting, investing, or taking out a
                  loan`);
 });
 ```

If you want to accept data from a user, you will need to declare it with its
type and then tell the script engine where to expect it:
```javascript
violet.addInputTypes({
  'name': 'firstName',
});

violet.respondTo(['My name is [[name]]'],
 (response) => {
   response.say('I like the name [[name]]')
 });
```

You can use phrase equivalents to tell the engine that two phrases are identical
in all situations:
```javascript
violet.addPhraseEquivalents([
  ['My name is', 'I call myself'],
]);
```

### Conversational Goals

Sophisticated conversations are supported by Violet using goals. When a user
indicates a need for a discussion on a particular topic, a script can just add
the topic as a goal to be met. Goals could theoretically also be set by a script
to proactively check-in with a user or to raise an item related to another goal.

The below simply adds a goal to be met by the system when the user asks for
flight arrival information.
```javascript
violet.respondTo('What time does the [[airline]] flight arrive', 'from [[city]]',
  (response) => {
    response.addGoal('flightArrivalTime');
});

violet.respondTo('What time does the flight arrive from [[city]]',
  (response) => {
    response.addGoal('flightArrivalTime');
});
```

The conversation engine tries to meet goals based on goal definitions provided
in the script. Goals are one of two types. The first type of goal is when
additional information is needed
```javascript
violet.defineGoal({
  goal: 'flightArrivalTime',
  resolve: (response) => {
    if (!response.ensureGoalFilled('airline')
        || !response.ensureGoalFilled('city')
        || !response.ensureGoalFilled('flightDay') ) {
          return false; // dependent goals not met
        }
    var airline = response.get('airline');
    var city = response.get('city');
    var flightDay = response.get('flightDay');
    flightArrivalTimeSvc.query(airline, city, flightDay, (arrivalTime)=>{
      response.say('Flight ' + airline + ' from ' + city + ' is expected to arrive ' + flightDay + ' at ' + arrivalTime);
    });
    return true;
  }
});
```

```javascript
violet.defineGoal({
  goal: 'city',
  prompt: ['What city do you want the flight to be arriving from'],
  respondTo: [{
    expecting: '[[city]]',
    resolve: (response) => {
      response.set('city', response.get('city') );
  }}]
});
```

## Plugins
There are a number of plugins that allow you to further extend the capabilities
of Violet Skills

### Persistence
These plugins will allow you to easily store and load data from a data store.

There are two persistence plugins currently provided - these include the Salesforce integration plugin
`violetStoreSF` and the Postgres integration plugin
`violetStorePG`.

If you are using the Postgres plugin then you will need to set up the `DATABASE_URL` environment variable.

If you are using the Salesforce plugin then you will need to set up the following environment variables (locally and on
any deployed platform): `V_SFDC_CLIENT_ID`, `V_SFDC_CLIENT_SECRET`,
`V_SFDC_USERNAME` and `V_SFDC_PASSWORD`.

To include the plugin in your code you would need to add this after the violet
script:
```javascript
var violetStoreSF = require('violet/lib/violetStoreSF.js')(violet);
```

Once included you can store data in the database by using the `store` method:

```javascript
violet.respondTo('I received a bill from [[company]] today for [[amount]]',
  (response) => {
    response.store('bills',
        'user': response.get('userId'),
        'from': response.get('company'),
        'amount': response.get('amount')
      });
    response.say('xxxx');
});
```

To retrieve data from the database you need to use the load method. **Caution**
Load returns a promise to the DB results  - if you need to use the
values retrieved from it, you need to (a) either use a `.then` after it OR
(b) you need to make your `resolve` method a generator and place a `yield` before
the call to the `load` method.

```javascript
// example a:
violet.respondTo(
  expecting: 'Who did I receive my bill from most recently?',
  resolve: (response) => {
    return response.load('bills', 'bills.user', response.get('userId') )
      .then((results)=>{
        response.say(`You received a bill from ${results[0].from} for ${results[0].amount}`);
      });
});
// example b: (note the 'function *' and the 'yield' below)
violet.respondTo(
  expecting: 'Who did I receive my bill from most recently?',
  resolve: function *(response) {
    var results = yield response.load('bills', 'bills.user', response.get('userId') )
    response.say(`You received a bill from ${results[0].from} for ${results[0].amount}`);
});
```



## Advanced Topics

### Custom types

The voice engine can recognize better what the user is saying when it knows to
expect one of a limited set of inputs. One helpful way to do this is to use
create custom type and have it as an input parameter in your script.

In the below example - from violetTime.js - a custom type called `timeUnit` is
declared.

```javascript
violet.addInputTypes({
  "time": "NUMBER",
  "timeUnit": {
    "type": "timeUnitType",
    "values": ["days", "hours", "minutes"]
  },
});
```

After declaring a custom type, the values and the type name need to be provided
to Amazon's Skill Configuration Site as a custom slot type.

## Debugging Conversations

When developing conversational scripts - it helps to debug/test it in three phrases:
1. Make sure the code compiles/runs by typing `npm start`. Fix any errors and keep re-starting the service until misplaced punctuations and declarations have been fixed.
2. Test the script in the included tester view, by running the script and opening it in a browser, for example: http://localhost:8080/alexa/einstein You will likely want to submit IntentRequest's based on the Utterance's at the bottom of the page. Once you submit a request, verify that the response output SSML is per your needs. Additionally, it is helpful to walk through the script a few times to ensure that the application supports the different user scenarios.
3. Once the script works locally, deploy it to the cloud and configure Alexa to talk to the underlying skill using Amazon's Skill Configuration site. At this stage you will likely benefit from testing by iterating rapidly with: invoking the voice-client, examining the conversational-app's logs, and tweaking the utterances in Amazon's Configuration. Testing a voice client is likely best done through a web testing tool like [Echosim.io](https://echosim.io).

## Contribution/Supporting

Guidelines on contributing to Violet are available [here](http://helloviolet.ai/docs/contributing).
