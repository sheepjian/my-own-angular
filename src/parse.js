'use strict';

var _ = require('lodash');

function Lexer() {
  this.text = '';
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];
}

Lexer.COM = 1;
Lexer.EQ = 2;
Lexer.ADD = 3;
Lexer.MUL = 4;

Lexer.OPERATORS = {
  '+': {
    unary: true,
    binary: Lexer.ADD
  },
  '!': {
    unary: true,
    binary: false
  },
  '-': {
    unary: true,
    binary: Lexer.ADD
  },
  '*': {
    unary: false,
    binary: Lexer.MUL
  },
  '/': {
    unary: false,
    binary: Lexer.MUL
  },
  '%': {
    unary: false,
    binary: Lexer.MUL
  },
  '<': {
    unary: false,
    binary: Lexer.COM
  },
  '>': {
    unary: false,
    binary: Lexer.COM
  },
  '>=': {
    unary: false,
    binary: Lexer.COM
  },
  '<=': {
    unary: false,
    binary: Lexer.COM
  },
  '==': {
    unary: false,
    binary: Lexer.EQ
  },
  '===': {
    unary: false,
    binary: Lexer.EQ
  },
  '!=': {
    unary: false,
    binary: Lexer.EQ
  },
  '!==': {
    unary: false,
    binary: Lexer.EQ
  }
};

Lexer.prototype.lex = function(text) {
  // Tokenization will be done here
  this.text = text;
  while (this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);
    if (this.isNumber(this.ch) || (this.ch === '.' &&
        this.isNumber(this.peek()))) {
      this.readNumber();
    } else if (this.ch === '\'' || this.ch === '"') {
      this.readString();
    } else if (this.isBuildingOperator(this.ch)) {
      this.tokens.push({
        text: this.ch
      });
      this.index++;
    } else if (this.isIdentifer(this.ch)) {
      this.readIdentifier();
    } else if (this.isSpace(this.ch)) {
      this.index++;
    } else {
      var op = Lexer.OPERATORS[this.ch];
      if (op) {
        this.tokens.push({ 
          text: this.ch, 
          unary: op.unary,
          binary: op.binary 
        });
        this.index++;
      } else {
        throw "Unexpected next character: " + this.ch;
      }
    }
  }
  return this.tokens;
};

Lexer.prototype.peek = function() {
  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) :
    false;
};

Lexer.prototype.isBuildingOperator = function(ch) {
  return ch.match(/[\[\],.\{\}\:()=]/);
};

Lexer.prototype.isNumber = function(ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.isIdentifer = function(ch) {
  return ch.match(/[a-zA-Z_$]/);
};

Lexer.prototype.isSpace = function(ch) {
  return ch.match(/\s/);
};

Lexer.prototype.readNumber = function() {
  var number = '';
  var re = /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/;
  var substr = this.text.substring(this.index);
  number = re.exec(substr)[0];
  this.index += number.length;
  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

var ESCAPES = {
  'n': '\n',
  'f': '\f',
  'r': '\r',
  't': '\t',
  'v': '\v',
  '\'': '\'',
  '"': '"'
};

Lexer.prototype.readString = function() {
  var quote = this.ch;
  this.index++;
  var string = '';
  var escape = false;
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (escape) {
      if (ch === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5);
        if (!hex.match(/[\da-f]{4}/i)) {
          throw 'Invalid unicode escape';
        }
        this.index += 4;
        string += String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }
      escape = false;
    } else if (ch === quote) {
      this.index++;
      this.tokens.push({
        text: string,
        value: string
      });
      return;
    } else if (ch === '\\') {
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }
  throw 'Unmatched quote';
};

Lexer.prototype.readIdentifier = function() {
  var id = '';
  var re = /[a-zA-Z_$][0-9a-zA-Z_$]*/;
  var substr = this.text.substring(this.index);
  id = re.exec(substr)[0];
  this.index += id.length;
  var result = this.evalIdentifier(id);
  result.text = id;
  this.tokens.push(result);
};

Lexer.prototype.evalIdentifier = function(text) {
  if (text === 'true') {
    return {
      value: true,
      isIdentifer: false
    };
  } else if (text === 'false') {
    return {
      value: false,
      isIdentifer: false
    };
  } else if (text === 'null') {
    return {
      value: null,
      isIdentifer: false
    };
  } else {
    return {
      value: text,
      isIdentifer: true
    };
  }
};

function AST(lexer) {
  this.lexer = lexer;
}

AST.Program = "Program";
AST.Literal = "Literal";
AST.ArrayExpression = "ArrayExpression";
AST.ObjectExpression = "ObjectExpression";
AST.Property = "Property";
AST.Identifier = "Identifier";
AST.MemberExpression = "MemberExpression";
AST.CallExpression = "CallExpression";
AST.AssignExpression = "AssignExpression";
AST.UnaryExpression = 'UnaryExpression';
AST.MultiplicativeExpression = 'MultiplicativeExpression';
AST.AdditiveExpression = 'AdditiveExpression';


// build the tree node: {value:'', type:''}
AST.prototype.ast = function(text) {
  this.tokens = this.lexer.lex(text);
  // AST building will be done here
  return this.program();
};

AST.prototype.program = function() {
  return { type: AST.Program, body: this.assignment() };
};

AST.prototype.assignment = function() {
  var left = this.additive();
  if (this.detect('=')) {
    var right = this.additive();
    return {
      type: AST.AssignExpression,
      left: left,
      right: right
    };
  }
  return left;
};

AST.prototype.additive = function() {
  var left = this.multiplicative();
  var token;
  while((token= this.peek()) && 
    token.binary === Lexer.ADD) {
    var operator = this.consume().text;
    left = {
      type: AST.AdditiveExpression,
      left: left,
      operator: operator,
      right: this.multiplicative()
    };
  }
  return left;
};

AST.prototype.multiplicative = function() {
  var left = this.unary();
  var token;
  while((token= this.peek()) && 
    token.binary === Lexer.MUL) {
    var operator = this.consume().text;
    left = {
      type: AST.MultiplicativeExpression,
      left: left,
      operator: operator,
      right: this.unary()
    };
  }
  return left;
};

AST.prototype.unary = function() {
  if (this.peek().unary) {
    var operator = this.consume().text;
    return {
      type: AST.UnaryExpression,
      operator: operator,
      value: this.unary()
    };
  } else {
    return this.parse();
  }
};


AST.prototype.parse = function() {
  var declaration;
  if (this.detect('[')) {
    declaration = this.arrayDeclaration();
  } else if (this.detect('{')) {
    declaration = this.objectDeclaration();
  } else {
    declaration = this.constant();
  }
  var next;
  while ((next = this.detect('.')) ||
    (next = this.detect('[')) ||
    (next = this.detect('('))) {
    if (next.text === '(') {
      declaration = {
        type: AST.CallExpression,
        callee: declaration,
        args: this.parseArguments()
      };
      this.consume(')');
    } else {
      declaration = {
        type: AST.MemberExpression,
        object: declaration,
        computed: false
      };
      if (next.text === '[') {
        declaration.property = this.parse();
        declaration.computed = true;
        this.consume(']');
      } else {
        declaration.property = this.identifier();
      }
    }
  }
  return declaration;
};

AST.prototype.parseArguments = function() {
  var args = [];
  if (!this.peek(')')) {
    do {
      args.push(this.assignment());
    } while (this.detect(','));
  }
  return args;
};

AST.prototype.constant = function() {
  if (this.peek().isIdentifer) {
    return this.identifier();
  } else {
    return { type: AST.Literal, value: this.consume().value };
  }
};

AST.prototype.detect = function(e) {
  if (this.tokens.length > 0) {
    if (this.tokens[0].text === e || !e) {
      return this.tokens.shift();
    }
  }
};

AST.prototype.consume = function(e) {
  var token = this.detect(e);
  if (!token) {
    throw 'Unexpected Token. Expecting: ' + e;
  }
  return token;
};

AST.prototype.arrayDeclaration = function() {
  var elements = [];
  if (!this.peek(']')) {
    do {
      if (this.peek(']')) {
        break;
      }
      elements.push(this.assignment());
    } while (this.detect(','));
  }
  this.consume(']');
  return { type: AST.ArrayExpression, value: elements };
};

AST.prototype.peek = function(e) {
  if (this.tokens.length > 0) {
    var text = this.tokens[0].text;
    if (text === e || !e) {
      return this.tokens[0];
    }
  }
};

AST.prototype.identifier = function() {
  return {
    type: AST.Identifier,
    name: this.consume().text
  };
};

AST.prototype.objectDeclaration = function() {
  var properties = [];
  if (!this.peek('}')) {
    do {
      if (this.peek('}')) {
        break;
      }
      var property = { type: AST.Property };
      property.key = this.constant();
      this.consume(':');
      property.value = this.assignment();
      properties.push(property);
    } while (this.detect(','));
  }
  this.consume('}');
  return { type: AST.ObjectExpression, value: properties };
};

function ensureSafeMemberName(name) {
  if (name === 'constructor' || name === '__proto__' ||
    name === '__defineGetter__' || name === '__defineSetter__' ||
    name === '__lookupGetter__' || name === '__lookupSetter__') {
    throw 'Attempting to access a disallowed field in Angular expressions!';
  }
}

function ensureSafeObject(obj) {
  if (obj) {
    if (obj.window === obj) {
      throw 'Referencing window in Angular expressions is disallowed!';
    } else if (obj.nodeType === 1) {
      throw 'Referencing DOM nodes in Angular expressions is disallowed!';
    } else if (obj.constructor === obj) {
      throw 'Referencing Function in Angular expressions is disallowed!';
    } else if (obj === Object) {
      throw 'Referencing Object in Angular expressions is disallowed!';
    }
  }
  return obj;
}

function ifDefined(value, defaultValue) {
  return typeof value === 'undefined' ? defaultValue : value;
}

var CALL = Function.prototype.call;
var APPLY = Function.prototype.apply;
var BIND = Function.prototype.bind;

function ensureSafeFunction(obj) {
  if (obj) {
    if (obj.constructor === obj) {
      throw 'Referencing Function in Angular expressions is disallowed!';
    } else if (obj === CALL || obj === APPLY || obj === BIND) {
      throw 'Referencing call, apply, or bind in Angular expressions' + 'is disallowed!';
    }
  }
  return obj;
}

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

ASTCompiler.scope = "scope";
ASTCompiler.local = "local";

ASTCompiler.ensureSafeMemberName = 'ensureSafeMemberName';
ASTCompiler.ensureSafeObject = 'ensureSafeObject';
ASTCompiler.ensureSafeFunction = 'ensureSafeFunction';
ASTCompiler.ifDefined = 'ifDefined';

ASTCompiler.prototype.compile = function(text) {
  var ast = this.astBuilder.ast(text);
  // AST compilation will be done here
  this.state = { body: [], nextId: 0, vars: [] };
  this.recurse(ast);
  var fnString = 'var fn=function(' +
    ASTCompiler.scope + ',' +
    ASTCompiler.local + '){' +
    (this.state.vars.length ? 'var ' +
      this.state.vars.join(',') + ';' : ''
    ) +
    this.state.body.join('') + '}; return fn;';
  //console.log(this.state);
  /* jshint -W054 */
  return new Function(ASTCompiler.ensureSafeMemberName,
    ASTCompiler.ensureSafeObject,
    ASTCompiler.ensureSafeFunction,
    ASTCompiler.ifDefined,
    fnString)(
    ensureSafeMemberName,
    ensureSafeObject,
    ensureSafeFunction,
    ifDefined);
  /* jshint +W054 */
};

ASTCompiler.prototype.addEnsureSafeFunction = function(expr) {
  this.state.body.push('ensureSafeFunction(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeMemberName = function(expr) {
  this.state.body.push(this.ensureSafeMemberName(expr) + ';');
};

ASTCompiler.prototype.addEnsureSafeObject = function(expr) {
  this.state.body.push(this.ensureSafeObject(expr) + ';');
};

ASTCompiler.prototype.recurse = function(ast, context, create) {
  var that = this;
  var intoId;
  switch (ast.type) {
    case AST.Program:
      this.state.body.push('return  ',
        this.recurse(ast.body), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
    case AST.ArrayExpression:
      var elements = _.map(ast.value, function(element) {
        return that.recurse(element);
      });
      return '[' + elements.join(',') + ']';
    case AST.ObjectExpression:
      var properties = _.map(ast.value, function(property) {
        var key = property.key.type === AST.Identifier ? property.key.name : that.escape(property.key.value);
        var value = that.recurse(property.value);
        return key + ':' + value;
      });
      return '{' + properties.join(',') + '}';
    case AST.Identifier:
      ensureSafeMemberName(ast.name);
      intoId = ASTCompiler.scope;
      var localMember = this.link(ASTCompiler.local, ast.name);
      var scopeMember = this.link(ASTCompiler.scope, ast.name);
      var localTest = '(' + ASTCompiler.local +
        '&&' + localMember + ')';
      var scopeTest = '(' + ASTCompiler.scope +
        '&&' + scopeMember + ')';
      if (ast.name !== 'this') {
        if (create) {
          this.if_(
            this.not(localTest) + '&&' +
            this.not(scopeTest),
            this.assign(scopeMember, '{}')
          );
        }
        intoId = this.nextId();
        this.ifelseif_(localTest, this.assign(intoId,
            localMember), ASTCompiler.scope,
          this.assign(intoId, scopeMember));
      }
      if (context) {
        context.context = localTest + '?' +
          ASTCompiler.local + ':' + ASTCompiler.scope;
        context.name = ast.name;
        context.computed = false;
      }
      this.addEnsureSafeObject(intoId);
      return intoId;
    case AST.MemberExpression:
      intoId = this.nextId();
      var left = this.recurse(ast.object, undefined, create);
      if (context) {
        context.context = left;
      }
      if (ast.computed) {
        var right = this.recurse(ast.property);
        this.addEnsureSafeMemberName(right);
        if (create) {
          this.if_(this.not(this.index(left, right)),
            this.assign(this.index(left, right), '{}'));
        }
        this.if_(left, this.assign(intoId,
          this.ensureSafeObject(this.index(left, right))));
        if (context) {
          context.name = right;
          context.computed = true;
        }
      } else {
        ensureSafeMemberName(ast.property.name);
        if (create) {
          this.if_(this.not(this.link(left,
              ast.property.name)),
            this.assign(this.link(left,
              ast.property.name), '{}'));
        }
        this.if_(left, this.assign(intoId,
          this.ensureSafeObject(this.link(
            left, ast.property.name))));
        if (context) {
          context.name = ast.property.name;
          context.computed = false;
        }
      }
      return intoId;
    case AST.CallExpression:
      var callContext = {};
      var callee = this.recurse(ast.callee, callContext);
      var args = _.map(ast.args, function(arg) {
        return that.ensureSafeObject(that.recurse(arg));
      });
      if (callContext.name) {
        this.addEnsureSafeObject(callContext.context);
        if (callContext.computed) {
          callee = this.index(callContext.context,
            callContext.name);
        } else {
          callee = this.link(callContext.context,
            callContext.name);
        }
      }
      this.addEnsureSafeFunction(callee);
      return callee + '&&' +
        this.ensureSafeObject(
          callee + '(' + args.join(',') + ')');
    case AST.AssignExpression:
      var leftContext = {};
      this.recurse(ast.left, leftContext, true);
      var leftExpr;
      if (leftContext.computed) {
        leftExpr = this.index(leftContext.context,
          leftContext.name);
      } else {
        leftExpr = this.link(leftContext.context,
          leftContext.name);
      }
      return this.assign(leftExpr,
        this.ensureSafeObject(this.recurse(ast.right)));
    case AST.UnaryExpression:
      return ast.operator +
        '(' +
        this.ifDefined(this.recurse(ast.value), 0) +
        ')';
    case AST.MultiplicativeExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) +
        ')' + ast.operator + '(' + 
        this.ifDefined(this.recurse(ast.right), 0) + ')';
    case AST.AdditiveExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) +
        ')' + ast.operator + '(' + 
        this.ifDefined(this.recurse(ast.right), 0) + ')';
    default:
      throw "Unknown Token type: " + ast.type;
  }
};

ASTCompiler.prototype.ifDefined = function(value,
  defaultValue) {
  return ASTCompiler.ifDefined + '(' +
    value + ',' +
    this.escape(defaultValue) + ')';
};

ASTCompiler.prototype.nextId = function() {
  var id = 'v' + (this.state.nextId++);
  this.state.vars.push(id);
  return id;
};

ASTCompiler.prototype.ensureSafeMemberName = function(mem) {
  return ASTCompiler.ensureSafeMemberName + '(' + mem + ')';
};

ASTCompiler.prototype.ensureSafeObject = function(obj) {
  return ASTCompiler.ensureSafeObject + '(' + obj + ')';
};

ASTCompiler.prototype.not = function(property) {
  return '!' + property;
};

ASTCompiler.prototype.link = function(scope, key) {
  return scope + '.' + key;
};

ASTCompiler.prototype.index = function(scope, key) {
  return scope + '[' + key + ']';
};


ASTCompiler.prototype.assign = function(id, value) {
  return id + '=' + value + ';';
};

ASTCompiler.prototype.if_ = function(test, consequent) {
  this.state.body.push(
    'if (', test, '){', consequent, '}');
};

ASTCompiler.prototype.ifelseif_ = function(condition1, consequent, condition2, otherwise) {
  this.state.body.push(
    'if (', condition1, '){', consequent, '} else if (',
    condition2, '){', otherwise, '}');
};


ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;

ASTCompiler.prototype.stringEscapeFn = function(c) {
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};

ASTCompiler.prototype.escape = function(value) {
  if (_.isString(value)) {
    return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
  } else if (_.isNull(value)) {
    return 'null';
  } else {
    return value;
  }
};

function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function(text) {
  return this.astCompiler.compile(text);
};

function parse(expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}

module.exports = parse;
