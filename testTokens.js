const tokenizer = require("./tokenizer.js");
const fs = require('fs');
String.prototype.tokens = tokenizer;

let sourceFileName = process.argv[2];
let source = fs.readFileSync(sourceFileName, 'UTF-8');
let tokens =  source.tokens('=<>!+-*&|/%^', '=<>&|');

console.log(source + "\n")
console.log("Testing tokenization for " + sourceFileName );
console.log(tokens);
