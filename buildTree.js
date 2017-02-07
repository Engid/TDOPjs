let sourceFileName = process.argv[2];

const parser = require("./parser.js");

const fs = require("fs");

let source = fs.readFileSync(sourceFileName, 'utf8');

let tree = parser(source);

console.log(tree);


