/**
Version 0.0.1
*/


/*
  This parser is based on the work of Douglas 
  Crockford, as described on his web page [1]. 
  I intend to modify and extend it for funzies. 
  
  Note: All comments are written by Nick Gideo
  in less otherwise attributed (ie: -DC is from
  Douglas Crockford). 
  
  Top Down Operator Precedence (TDOP) is a type of
  parser that is based on a Recursive descent model,
  but it differs by treating the tokens as something
  simmilar to objects. Recursive descent associates
  'semantic actions' with grammer rules, while TDOP
  has the actions associated with the tokens [2]. 

  This feature allows for TDOP to be implemented
  very well by a dynamic functional-object-oriented 
  language like JavaScript. Generic objects are first 
  created by a factory function, and methods can then 
  be dynamically assigned to allow for the token to 
  handle its own parsing logic. 


   References:
  [1]  http://javascript.crockford.com/tdop/tdop.html

  [2]  eli.thegreenplace.net/2010/01/02/top-down-operator-precedence-parsing/
*/

/*
  "Transform a token object into an exception object and throw it." -DC

  Crockford uses this error method throughout the his original parser code,
  and within his tokenizer function. -Nick
*/
Object.prototype.error = function (message, t) {
    t = t || this;
    t.name = "SyntaxError";
    t.message = message;
    throw t;
};


const tokenizer = require("./tokenizer.js");
/* 
  Crockford originally added the tokenizer to the String 
  prototype, so I've imported the function and added it here. 
*/
String.prototype.tokens = tokenizer;


/*
  Create the NodeJs module by using an
  immediately-invoked function closure. 
  In other words, the parser is accessed
  by a function which the parser function
  itself returns. Very meta, like whoa! 
*/
module.exports = (function() {

  /* Global Variables */

  /* 
    token holds the current token.
    It is assigned by advance(). 
  */
  let token; 

  /*
    tokens holds an array of token objects
    It is assigned by the tokenizer. 
  */  
  let tokens;

  /*
    token_nr is the index of the current token in tokens.
    It is incremented within advance()
  */
  let token_nr;

  /*
    scope holds the current scope. 
  */  
  let scope;

  /*
    All Symbols are kept in the symbol table
  */
  let symbol_table = {};

  //END OF GLOBALS

  /*
    Token Prototype.
    Each symbol will have a unique token object
    that will handle parsing operations. The methods
    for parsing will be defined using the factory
    functions defined bellow, over-riding the
    stubs listed here. 

    Members:

    nud(): Stands for Null Denotation. The nud
    method is used by prefix operators and values
    (ie variables and literals). 

    led(): Stands for Left Denotation. The led
    method is used by infix and suffix operators.
  */
  let original_symbol = {
    nud: function() {
      this.error("Undefined.");
    },
    led: function() {
      this.error("Missing operator.");
    }
  };

  /**
    The symbol creating factory function. 
    
    It checks to see if the symbol object
    already exists in the symbol_table, and
    if so it potentially updates the binding 
    power. If the symbol doesn't exist, it creates
    one and puts it in the symbol_table object. 
    
    @param {string} id - symbol. ie: "("
    @param {number} bp - binding power
    
    @return {object} s - new symbol
  */
  let symbol = function(id, bp){
    let s = symbol_table[id];
    bp = bp || 0;
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      } 
    } else {
      s = Object.create(original_symbol);
      s.id = s.value = id;
      s.lbp = bp;
      symbol_table[id] = s;  
    }
    return s;
  };

  /*
    The original_scope object
  */
  let original_scope = {
    define: function(n) {
      let t = this.def[n.value];
      if (typeof t === "object") {
        n.error(t.reserved ?
          "Already reserved." :
          "Already defined.");
      }

      this.def[n.value] = n;
      n.reserved        = false;
      n.nud             = itself;
      n.led             = null;
      n.std             = null;
      n.lbp             = 0;
      n.scope           = scope;
      return n;
    },

    find: function(n) {
      let e = this;
      while (true) {
        var o = e.def[n];
        if (o) {
          return o;
        }
        e = e.parent;
        if (!e) {
          return symbol_table[
            symbol_table.hasOwnProperty(n) ?
            n : "(name)"];
        }
      }
    },

    pop: function() {
      scope = this.parent;
    },

    reserve: function(n) {
      if (n.arity !== "name" || n.reserved) {
        return;
      }
      let t = this.def[n.value];
      if (t) {
        if (t.reserved) {
          return;
        }
        if (t.arity === "name") {
          n.error("Already defined.");
        }
      }
      this.def[n.value] = n;
      n.reserved = true;
    }
  };

  let new_scope = function(){
    let s = scope;
    scope = Object.create(original_scope);
    scope.def = {};
    scope.parent = s;
    return scope;
  }

  let advance = function(id) {
    let a, o, t, v;
    let l, c; /* adding line and column info -NZG */

    if (id && token.id !== id) {
      token.error("Expected '" + id + "'.");
    }

    if (token_nr >= tokens.length) {
      token = symbol_table["(end)"];
      return;
    }

    t = tokens[token_nr];
    token_nr += 1;
    v = t.value;
    a = t.type;
    l = t.line; // line number from source 
    c = t.from; // column number from source -NZG
                 
    if (a === "name") {
      o = scope.find(v);
    } else if (a === "operator") {
      o = symbol_table[v];
      if (!o) {
        t.error("Unknown operator. See line "+l+":"+c+".");
      }
    } else if (a === "string" || a === "number") {
      a = "literal";
      o = symbol_table["(literal)"];
    } else {
      t.error("Unexpected token. See line "+l+":"+c+".");
    }
    token = Object.create(o);
    token.value = v;
    token.arity = a;

    token.source = {};            //Tracking info from source code -NZG
    token.source.line = t.line;
    token.source.column = t.column;
    
    return token;

  };


  let expression = function(rbp) {
    let left;
    let t = token;
    advance();
    left = t.nud();
    while (rbp < token.lbp) {
      t = token;
      advance();
      left = t.led(left);
    }
    return left;
  };


  /*  
    Identity function
  */
  let itself = function() {
    return this;
  };


  let infix = function(id, bp, led) {
    let s = symbol(id, bp);
    s.led = led || function(left) {
      this.first = left;
      this.second = expression(bp);
      this.arity = "binary";
      return this;
    };
    return s;
  };

  let infixr = function(id, bp, led) {
    let s = symbol(id, bp);
    s.led = led || function(left) {
      this.first = left;
      this.second = expression(bp -1);
      this.arity = "binary";
      return this;
    };
    return s;
  };

  let prefix = function(id, nud){
    let s = symbol(id);
    s.nud = nud || function() {
      scope.reserve(this);
      this.first = expression(80);
      this.arity = "unary";
      return this;
    };
    return s;
  };

  let assignment = function(id) {
    return infixr(id, 10, function(left) {
      if (left.id !== "." && left.id !== "[" && 
          left.arity !== "name") {
        left.error("Bad lvalue.");
      }
      this.first = left;
      this.second = expression(9);
      this.assignment = true;
      this.arity = "binary";
      return this;
    });
  };

  let constant = function(s,v) {
    let x = symbol(s);
    x.nud = function(){
      scope.reserve(this);
      this.value = symbol_table[this.id].value;
      this.arity = "literal";
      return this;
    };
    x.value = v;
    return x;
  };

  let statement = function() {
    let n = token, v;
    if (n.std) {
      advance();
      scope.reserve(n);
      return n.std();
    }
    v = expression(0);
    if (!v.assignment && v.id !== "(") {
      v.error("Bad expression statement.");
    }
    advance(";");
    return v;
  };

  let statements = function() {
    let a = [], s;
    while (true){
      if (token.id === "}" || token.id === "(end)") {
        break;
      }
      s = statement();
      if (s) {
        a.push(s);
      }
    }
    return a.length === 0 ? null : a.length === 1 ? a[0] : a;
  };

  let stmt = function(s, f) {
    let x = symbol(s);
    x.std = f;
    return x;
  };

  let block = function() {
    let t = token;
    advance("{");
    return t.std();
  };

  /* Symbol Initialization */

  symbol(':');
  symbol(';');
  symbol(',');
  symbol(')');
  symbol(']');
  symbol('}');
  symbol('else');
  symbol('(end)');
  symbol('(name)');
  symbol('(literal)').nud = itself;

  symbol('this').nud = function() {
    scope.reserve(this);
    this.arity = 'this';
    return this;
  };


  /* Infix operators */

  infix("+", 60);
  infix("-", 60);
  infix("*", 70);
  infix("/", 70);
  infix("===", 50);
  infix("!==", 50);
  infix("<", 50);
  infix("<=", 50);
  infix(">", 50);
  infix(">=", 50);

  /* Ternary operator */
  infix("?", 20, function(left) {
    this.first = left;
    this.second = expression(0);
    advance(":");
    this.third = expression(0);
    this.arity = "ternary";
    return this;
  });


  infix(".", 90, function(left) {
    this.first = left;
    if (token.arity !== "name") {
      token.error("Expected a property name.");
    }
    token.arity = "literal";
    this.second = token;
    this.arity = "binary";
    advance();
    return this;
  });


  infix("[", 90, function(left) {
    this.first = left;
    this.second = expression(0);
    this.arity = "binary";
    advance("]");
    return this;
  });


  infixr("&&", 40);
  infixr("||", 40);


  /* Prefix operators */

  prefix("-");
  prefix("!");
  prefix("typeof");

  /* 
    "The '(' token does not become part of the parse tree because
    the nud returns the expression." -DC

    By calling expression() with 0 as the right binding-power,
    it effectively allows all of the expressions with 
    the parens to be gathered into a sub-tree. After this is completed, 
    advance() is called with ")", which logically
    checks that the current token is the closing paren. 

  */
  prefix("(", function() {
    let e = expression(0);
    advance(")");
    return e;
  });


  /* Assignment operators */

  assignment("=");
  assignment("+=");
  assignment("-=");




  /* Constants */

  constant("true", true);
  constant("false", false);
  constant("null", null);
  constant("pi", 3.141592653589793);


  /* Statements */

  stmt("{", function(){
    new_scope();
    let a = statements();
    advance("}");
    scope.pop();
    return a;
  });

  stmt("var", function(){
    let a = [], n, t;
    while (true) {
      n = token;
      if (n.arity !== "name"){
        n.error("Expected a new variable name.");
      }
      scope.define(n);
      advance();
      if (token.id === "=") {
        t = token;
        advance("=");
        t.first = n;
        t.second = expression(0);
        t.arity = "binary";
        a.push(t);
      }
      if (token.id !== ",") {
        break;
      }
      advance(",");
    }
    advance(";");
    return a.length === 0 ? null : a.length === 1 ? a[0] : a;
  });

  stmt("while", function() {
    advance("(");
    this.first = expression(0);
    advance(")");
    this.second = block();
    this.arity = "statement";
    return this;
  });

  stmt("if", function () {
    advance("(");
    this.first = expression(0);
    advance(")");
    this.second = block();
    if (token.id === "else") {
      scope.reserve(token);
      advance("else");
      this.third = token.id === "if" ? 
        statement() :
        block();
    }
    this.arity = "statement";
    return this;
  });


  stmt("break", function() {
    advance(";");
    if (token.id !== "}") {
      token.error("Unreachable statement.");
    }
    this.arity = "statement";
    return this;
  });

  stmt("return", function(){
    if (token.id !== ";") {
      this.first = expression(0);
    }
    advance(";");
    if (token.id !== "}") {
      token.error("Unreachable statement.");
    }
    this.arity = "statement";
    return this;
  });



  /* Functions */

  prefix("function", function() {
    let a = [];
    scope = new_scope();
    if (token.arity === "name") {
      scope.define(token);
      this.name = token.value;
      advance();
    }
    advance("(");
    if (token.id !== ")") {
      while(true) {
        if (token.arity !== "name") {
          token.error("Expected a parameter name.");
        }
        scope.define(token);
        a.push(token);
        advance();
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    this.first = a;
    advance(")");
    advance("{");
    this.second = statements();
    advance("}");
    this.arity = "function";
    scope.pop();
    return this;
  });


  /* Function Invocation */
  infix("(", 90, function(left) {
    let a = [];
    this.first = left;
    this.second = a;
    this.arity = "binary";
    if (  (left.arity !== "unary" ||
        left.id !== "function") &&
      left.arity !== "name" &&
      (left.arity !== "binary" ||
        (left.id !== "." &&
        left.id !== "(" &&
        left.id !== "["))  ) {
      left.error("Expected a variable name.");
    }
    if (token.id !== ")") {
      while(true) {
        a.push(expression(0));
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance(")");
    return this;;
  });

  prefix("[", function() {
    let a = [];
    if (token.id !== "]") {
      while(true) {
        a.push(expression(0));
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance("]");
    this.first = a;
    this.arity = "unary";
    return this;
  });


  prefix("{", function() {
    let a = [];
    if (token.id !== "}") {
      while(true){
        var n = token;
        if (n.arity !== "name" && narity !== "literal") {
          token.error("Bad key.");
        }
        advance();
        advance(":");
        var v = expression(0);
        v.key = n.value;
        a.push(v);
        if (token.id !== ",") {
          break;
        }
        advance(",");
      }
    }
    advance("}");
    this.first = a;
    this.arity = "unary";
    return this;
  });


  /* 
    Here we return a function that executes 
    the parser on source code once it is used. 
    Using a closure to protect the parsing logic
    seems like a safe bet, but I'm not sure it is
    entirely necessary. Either way, this is how
    the parser is currently configured. 
  */
  return function(source) {
    console.log("Scanning..");
    tokens = source.tokens('=<>!+-*&|/%^', '=<>&|');
    token_nr = 0;

    console.log("Parsing..");
    new_scope();
    advance();
    let s = statements();
    advance("(end)");
    scope.pop();
    return s;
  };
})();//END OF EXPORTED MODULE








