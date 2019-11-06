/*
 * Echo Test Script - targeting testing of Platforms and non-prefixed parameters
 */

var violet = require('../lib/violet').script();

violet.addInputTypes({
  "age": "number",          // adding basic complexity for test (having two number inputs)
  "repeatCount": "number",
  "stringToRepeat": "phrase",
});

violet.setCloseRequests(['Close Session']);

var app = {
  oldEnough: (response)=>{
    var age = response.get('age');
    if (age) {
      age = parseInt(age);
      if (age>=18) return "ageValid";
      if (age==17) return "nextYear";
    }
    return "notOldEnough";
  },
  echoNow: (response)=>{
    if (app.oldEnough(response) !== 'ageValid') {
      response.say('Sorry, age is not valid - I cannot do that');
      return;
    }
    var repeatCount = response.get('repeatCount');
    var stringToRepeat = response.get('stringToRepeat');
    stringToRepeat += ' ';
    response.say(`Repeating ${stringToRepeat} ${repeatCount} times ${stringToRepeat.repeat(repeatCount)}.`);
  },
}
violet.addFlowScript(`
<app>
  <choice id="launch">
    <say keepConversationRunning>Please provide your age for verification</say>
    <decision>
      <choice>
        <expecting>I am [[age]] {years old|}</expecting>
        <expecting>[[age]]</expecting>
        <check value="app.oldEnough(response)">
          <case value="ageValid">
            <say>Awesome. You are ready to rock-on!</say>
          </case>
          <case value="nextYear">
            <say>You will be in next year</say>
          </case>
          <default>
            <say>You need to be older</say>
          </default>
        </check>
      </choice>
      <choice>
        <expecting>Sorry, I can't do that</expecting>
        <expecting>No</expecting>
        <sayOne>
          <say>Ok, sure</say>
          <say>Not a problem</say>
        </sayOne>
      </choice>
    </decision>
  </choice>
  <dialog id="timeToEcho" elicit="dialog.nextReqdParam()">
    <expecting>Echo [[repeatCount]] times</expecting>
    <expecting>Echo [[stringToRepeat]]</expecting>
    <!-- <expecting>Echo [[stringToRepeat]] [[repeatCount]] times</expecting> -->

    <item name="stringToRepeat" required>
      <ask>What do you want to repeat</ask>
      <expecting>repeat [[stringToRepeat]]</expecting>
      <expecting>[[stringToRepeat]]</expecting>
    </item>
    <item name="repeatCount" required>
      <ask>How many times</ask>
      <expecting>[[repeatCount]]</expecting>
    </item>
    <resolve value="app.echoNow(response)">
    </resolve>
  </dialog>
</app>`, {app});
