
function require(file) {
  var exports = {};

  (function (exports, code) {
    eval(code)
  })(exports, 'exports.default = function (a, b) { return a + b }')

  return exports;
}


// 原src/indx.js代码
var add = require('./add.js').default;
console.log(add(1, 2));