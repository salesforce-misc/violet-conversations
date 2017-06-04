
module.exports = (violet) => {
  violet.respondTo([
        "Advance ((time)) {days|hours|minutes|seconds}"
      ], (response) => {
      response.out(["Done"]);
  });

  return {
    currentTime: () => {
      console.log('*** violetUtils.currentTime - NOT IMPLEMENTED YET!!');
    },
    repeat: () => {
      console.log('*** violetUtils.repeat - NOT IMPLEMENTED YET!!');
    }
  };
};
