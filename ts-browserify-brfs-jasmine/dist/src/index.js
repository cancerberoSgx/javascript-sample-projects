"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// we can start structuring our project using typescript ! :)
var Point_1 = require("./basic/Point");
var p = new Point_1.Point(1, 2);
console.log('point', p);
console.log(require('./templates/t1')());
var json = require("../test-files/schema1.json");
var parser = require("json-schema-parser");
var schema = parser.parse(json);
console.log('JSON.stringify(schema).length', JSON.stringify(schema).length);
//# sourceMappingURL=index.js.map