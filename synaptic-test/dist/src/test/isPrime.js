"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var synaptic_1 = require("synaptic");
var baseConverter_1 = require("../baseConverter");
var inputUtil_1 = require("../inputUtil");
var misc_utils_of_mine_generic_1 = require("misc-utils-of-mine-generic");
// learn to detect numbers divisible by 3
function main() {
    var max = 105;
    var numberSize = baseConverter_1.dec2bin(max).length + 2;
    var network = new synaptic_1.Architect.Perceptron(numberSize, numberSize, 1);
    var trainer = new synaptic_1.Trainer(network);
    var trainingSet = misc_utils_of_mine_generic_1.array(max).map(function (i) { return ({
        input: __spreadArrays(inputUtil_1.buildNumber(i, numberSize)),
        output: [inputUtil_1.isPrime(i) ? 1 : 0]
    }); });
    trainer.train(trainingSet, {
        rate: .1,
        iterations: 20000,
        error: .005,
        shuffle: true,
        cost: synaptic_1.Trainer.cost.CROSS_ENTROPY
    });
    console.log(network.activate(inputUtil_1.buildNumber(101, numberSize)), inputUtil_1.isPrime(101));
    console.log(network.activate(inputUtil_1.buildNumber(102, numberSize)), inputUtil_1.isPrime(102));
    console.log(network.activate(inputUtil_1.buildNumber(7, numberSize)));
}
main();
//# sourceMappingURL=isPrime.js.map