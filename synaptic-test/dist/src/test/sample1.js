"use strict";
exports.__esModule = true;
var synaptic_1 = require("synaptic");
var baseConverter_1 = require("../baseConverter");
function main() {
    var network = new synaptic_1.Architect.Perceptron(2, 2, 1);
    var trainer = new synaptic_1.Trainer(network);
    var trainingSet = [
        {
            input: [0, 0],
            output: [0]
        },
        {
            input: [0, 1],
            output: [1]
        },
        {
            input: [1, 0],
            output: [1]
        },
        {
            input: [1, 1],
            output: [0]
        },
    ];
    trainer.train(trainingSet, {
        rate: .1,
        iterations: 20000,
        error: .005,
        shuffle: true,
        // log: 1000,
        cost: synaptic_1.Trainer.cost.CROSS_ENTROPY
    });
    // network.propagate([0,0])
    var result = network.activate([0, 0]);
    console.log(network.activate([0, 0]), network.activate([0, 1]), network.activate([1, 0]), network.activate([1, 1]));
    console.log(baseConverter_1.dec2bin(13), baseConverter_1.bin2dec([1, 1, 0, 1]));
}
main();
//# sourceMappingURL=sample1.js.map