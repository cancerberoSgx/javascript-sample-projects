/// <reference path="node-globals.ts" />

// we can start structuring our project using typescript ! :)
import {Point} from "./basic/Point"
let p = new Point(1,2)
console.log('point', p)
// p.err()

// however sometimes we need to deal with libraries
// we can require node_modules or files with brfs - for ts compiler not to fail we need to declare require()

console.log(require('./templates/t1')())

var json = require("../test-files/schema1.json")
var parser = require("json-schema-parser")
var schema = parser.parse(json)
console.log('JSON.stringify(schema).length', JSON.stringify(schema).length);  

