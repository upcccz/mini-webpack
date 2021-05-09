var exports = {};

(function (exports, code) {
  eval(code)
})(exports, 'exports.default = function (a, b) { return a + b }')

console.log(exports.default(1, 2));

