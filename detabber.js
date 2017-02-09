let fileName = process.argv[2];
const fs = require("fs");

let source = fs.readFileSync(fileName, 'utf8');

let deTabbed = source.replace(/\t/g, '  ');

fs.writeFileSync("parser-detabbed.js", deTabbed);

//console.log(deTabbed);
