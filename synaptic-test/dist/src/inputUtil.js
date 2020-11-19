"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var baseConverter_1 = require("./baseConverter");
var misc_utils_of_mine_generic_1 = require("misc-utils-of-mine-generic");
function buildNumber(a, length) {
    var bin = baseConverter_1.dec2bin(a);
    if (bin.length > length) {
        throw new Error('Number greater than length');
    }
    return __spreadArrays(misc_utils_of_mine_generic_1.array(length - bin.length).map(function (i) { return 0; }), bin);
}
exports.buildNumber = buildNumber;
function isPrime(num) {
    for (var i = 2, s = Math.sqrt(num); i <= s; i++)
        if (num % i === 0)
            return false;
    return num !== 1;
}
exports.isPrime = isPrime;
var digitLength = baseConverter_1.dec2bin(9).length;
function number2InputDigitByDigit(a) {
    return ("" + a).split('').map(function (i) { return parseInt(i, 10); }).map(function (i) { return buildNumber(i, digitLength); }).flat();
}
exports.number2InputDigitByDigit = number2InputDigitByDigit;
function input2NumberDigitByDigit(input) {
    var digits = [];
    var acc = [];
    input.map(function (n, i) {
        acc.push(i);
        if (i % digitLength - 1 === 0) {
        }
    });
}
exports.input2NumberDigitByDigit = input2NumberDigitByDigit;
//# sourceMappingURL=inputUtil.js.map