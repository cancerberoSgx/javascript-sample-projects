
import {Point} from "./basic/Point"
let p = new Point(1,2)
console.log('point', p)

// we can use require() ! the following template is compiled with brfs/browserify
console.log(require('./templates/t1')())

//require() a third party non-typescript library
var json = require("../test-files/schema1.json")
var parser = require("json-schema-parser")
var schema = parser.parse(json)
console.log('JSON.stringify(schema).length', JSON.stringify(schema).length);
