
module.exports = (violet) => {
  violet.respondTo([
        "Advance ((time)) {days|hours|minutes|seconds}"
      ], (response) => {
      response.out(["Done"]);
  });

  return {
    currentTime: () => {}
  };
};
