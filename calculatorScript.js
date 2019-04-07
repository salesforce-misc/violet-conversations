/*
 * Calculator Test Script - targeting testing of Platforms
 */

var violet = require('./lib/violet').script({invocationName:'calculator'});

violet.addInputTypes({
  "NumOne": "number",
  "NumTwo": "number",
});

var app = {
  add: (a, b)=>{return parseInt(a)+parseInt(b); },
  subtract: (a, b)=>{return parseInt(a)-parseInt(b); },
  multiply: (a, b)=>{return parseInt(a)*parseInt(b); },
  divide: (a, b)=>{return parseInt(a)/parseInt(b); },
  greetingForAdd: (response)=>{
    var dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var today = new Date().getDay();
    response.say('Great');
    response.say(`${dayOfWeek[today]} is my favorite day to add.`);
  }
}
violet.addFlowScript(`
<app>
  <choice>
    <expecting>What can you do</expecting>
    <say>I can add, subtract, multiply, or divide two numbers</say>
  </choice>
  <choice id="add">
    <expecting>I want to add</expecting>
    <resolve value="app.greetingForAdd(response)"/>
    <decision>
      <prompt>What two numbers would you like me to add</prompt>
      <prompt>What would you like me to add</prompt>
      <choice>
        <expecting>[[NumOne]] and [[NumTwo]]</expecting>
        <say>The sum of [[NumOne]] and [[NumTwo]] is [[app.add(NumOne, NumTwo)]]</say>
      </choice>
      <choice>
        <expecting>Cancel</expecting>
        <say>Canceling Addition</say>
      </choice>
    </decision>
  </choice>
  <choice>
    <expecting>I want to subtract</expecting>
    <say>Sure</say>
    <decision>
      <prompt>What two numbers would you like me to subtract</prompt>
      <choice>
        <expecting>[[NumOne]] and [[NumTwo]]</expecting>
        <say>Subtracting [[NumTwo]] from [[NumOne]] gives [[app.subtract(NumOne, NumTwo)]]</say>
      </choice>
      <choice>
        <expecting>Cancel</expecting>
        <say>Canceling Subtraction</say>
      </choice>
    </decision>
  </choice>
  <choice>
    <expecting>I want to multiply</expecting>
    <say>Sure</say>
    <decision>
      <prompt>What two numbers would you like me to multiply</prompt>
      <choice>
        <expecting>[[NumOne]] and [[NumTwo]]</expecting>
        <say>Multiplying [[NumOne]] and [[NumTwo]] gives [[app.multiply(NumOne, NumTwo)]]</say>
      </choice>
      <choice>
        <expecting>Cancel</expecting>
        <say>Canceling Multiplication</say>
      </choice>
    </decision>
  </choice>
  <choice>
    <expecting>I want to divide</expecting>
    <say>Sure</say>
    <decision>
      <prompt>What two numbers would you like me to divide</prompt>
      <choice>
        <expecting>[[NumOne]] and [[NumTwo]]</expecting>
        <say>Dividing [[NumOne]] by [[NumTwo]] gives [[app.divide(NumOne, NumTwo)]]</say>
      </choice>
      <choice>
        <expecting>Cancel</expecting>
        <say>Canceling Division</say>
      </choice>
    </decision>
  </choice>
</app>`, {app});
