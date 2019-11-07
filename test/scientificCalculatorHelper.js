/*
 * Calculator Test Script Helper
 */

module.exports = (violet) => {
  violet.addInputTypes({
    "NumOne": "number",
    "NumTwo": "number",
  });

  var app = {
    add: (a, b)=>{return parseInt(a)+parseInt(b); },
    subtract: (a, b)=>{return parseInt(a)-parseInt(b); },
    multiply: (a, b)=>{return parseInt(a)*parseInt(b); },
    divide: (a, b)=>{return parseInt(a)/parseInt(b); },
    exponent: (response, a, b)=>{
      var val = Math.pow(parseInt(a), parseInt(b));
      response.say(`The value of ${a} to the power of ${b} is ${val}`);
    },
    greetingForAdd: (response)=>{
      var dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var today = new Date().getDay();
      response.say('Great');
      response.say(`${dayOfWeek[today]} is my favorite day to add.`);
    }
  }
  violet.addFlowScript(`
  <app>
    <choice id="launch">
      <expecting>What can you do</expecting>
      <say>I can add, subtract, multiply, or divide two numbers</say>
    </choice>
    <choice id="stop">
      <say>Goodbye</say>
    </choice>
    <choice id="cancel">
      <say>Cancelling</say>
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
        <choice inheritExpectings="cancel">
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
        <choice inheritExpectings="cancel">
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
        <choice inheritExpectings="cancel">
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
        <choice inheritExpectings="cancel">
          <say>Canceling Division</say>
        </choice>
      </decision>
    </choice>
    <dialog elicit="dialog.nextReqdParam()">
      <expecting>I want to calculate the exponent</expecting>
      <item name="NumOne" required>
        <ask>What is the base number?</ask>
        <expecting>The base number is [[NumOne]]</expecting>
      </item>
      <item name="NumTwo" required>
        <ask>What is the exponent?</ask>
        <expecting>The exponent is [[NumTwo]]</expecting>
      </item>
      <resolve value="app.exponent(response, NumOne, NumTwo)"/>
    </dialog>
  </app>`, {app});
};
