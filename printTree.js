let sourceFileName = process.argv[2];
const parser = require("./parser.js");
const fs = require("fs");
const util = require("util");

try {
  let source = fs.readFileSync(sourceFileName, 'utf8');
  let tree = parser(source);

  console.log("Printing Tree for " + sourceFileName + ":\n");
  console.log( util.inspect(tree, {depth:null}) );
} 
catch (e) {
  console.error(e);
}

