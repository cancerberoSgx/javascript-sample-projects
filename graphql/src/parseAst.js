var { Source, parse, parseValue } = require('graphql'); // CommonJS

const ast = parse(`
type Query {
  hello: String
}
`)
// console.log(JSON.stringify(ast, null, 2));

const valueAst = parseValue( '{ hello: "jjsj" }')

console.log(JSON.stringify(valueAst, null, 2));
