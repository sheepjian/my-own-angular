'use strict';

var _ = require('lodash');

function Lexer() {
  this.text = '';
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];
}

Lexer.ASSIGN = 0;
Lexer.COM = 1;
Lexer.EQ = 2;
Lexer.ADD = 3;
Lexer.MUL = 4;
Lexer.AND = 5;
Lexer.OR = 6;
Lexer.BIT = 7;
Lexer.Filter = 8;

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
  '=': {
    unary: false,
    binary: Lexer.ASSIGN
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
  },
  '&&': {
    unary: false,
    binary: Lexer.AND
  },
  '||': {
    unary: false,
    binary: Lexer.OR
  },
  '&': {
    unary: false,
    binary: Lexer.BIT
  },
  '|': {
    unary: false,
    binary: Lexer.Filter
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
      this.parseOperator();
    }
  }
  return this.tokens;
};

Lexer.prototype.parseOperator = function() {
  var len = 0;
  var str;
  var op;
  while (this.index + len < this.text.length) {
    str = this.text.substr(this.index, len + 1);
    if (Lexer.OPERATORS[str]) {
      op = str;
      len = len + 1;
    } else {
      break;
    }
  }
  if (op) {
    this.tokens.push({
      text: op,
      unary: Lexer.OPERATORS[op].unary,
      binary: Lexer.OPERATORS[op].binary
    });
    this.index = this.index + len;
  } else {
    throw "Unexpected next character: " + this.ch + ', ' + this.text + ': ' + this.index + ',' + len;
  }
};

Lexer.prototype.peek = function() {
  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) :
    false;
};

Lexer.prototype.isBuildingOperator = function(ch) {
  return ch.match(/[\[\],.\{\}\:()?;]/);
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
AST.EqualityExpression = 'EqualityExpression';
AST.RelationalExpression = 'RelationalExpression';
AST.LogicalExpression = 'LogicalandExpression';
AST.ConditionalExpression = 'ConditionalExpression';
AST.NGValueParameter = "NGValueParameter";


AST.prototype.ast = function(text) {
  this.tokens = this.lexer.lex(text);
  // AST building will be done here
  return this.program();
};

AST.prototype.program = function() {
  var body = [];
  while (true) {
    if (this.tokens.length) {
      body.push(this.filter());
    }
    if (!this.detect(';')) {
      return { type: AST.Program, body: body };
    }
  }
};

AST.prototype.filter = function() {
  var left = this.assignment();
  while (this.detect('|')) {
    var args = [left];
    left = {
      type: AST.CallExpression,
      callee: this.identifier(),
      arguments: args,
      filter: true
    };
    while (this.detect(':')) {
      args.push(this.assignment());
    }
  }
  return left;
};

AST.prototype.assignment = function() {
  var left = this.ternary();
  if (this.detect('=')) {
    var right = this.ternary();
    return {
      type: AST.AssignExpression,
      left: left,
      right: right
    };
  }
  return left;
};

AST.prototype.ternary = function() {
  var test = this.logicalOR();
  if (this.detect('?')) {
    var consequent = this.assignment();
    if (this.consume(':')) {
      var alternate = this.assignment();
      return {
        type: AST.ConditionalExpression,
        test: test,
        consequent: consequent,
        alternate: alternate
      };
    }
  }
  return test;
};

AST.prototype.logicalOR = function() {
  var left = this.logicalAND();
  var token;
  while ((token = this.peek()) &&
    token.binary === Lexer.OR) {
    var operator = this.consume().text;
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: operator,
      right: this.logicalAND()
    };
  }
  return left;
};

AST.prototype.logicalAND = function() {
  var left = this.equality();
  var token;
  while ((token = this.peek()) &&
    token.binary === Lexer.AND) {
    var operator = this.consume().text;
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: operator,
      right: this.equality()
    };
  }
  return left;
};

AST.prototype.equality = function() {
  var left = this.relational();
  var token;
  while ((token = this.peek()) &&
    token.binary === Lexer.EQ) {
    var operator = this.consume().text;
    left = {
      type: AST.EqualityExpression,
      left: left,
      operator: operator,
      right: this.relational()
    };
  }
  return left;
};

AST.prototype.relational = function() {
  var left = this.additive();
  var token;
  while ((token = this.peek()) &&
    token.binary === Lexer.COM) {
    var operator = this.consume().text;
    left = {
      type: AST.RelationalExpression,
      left: left,
      operator: operator,
      right: this.additive()
    };
  }
  return left;
};

AST.prototype.additive = function() {
  var left = this.multiplicative();
  var token;
  while ((token = this.peek()) &&
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
  while ((token = this.peek()) &&
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
  if (this.detect('(')) {
    declaration = this.filter();
    this.consume(')');
  } else if (this.detect('[')) {
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

function ASTCompiler(astBuilder, $filter) {
  this.astBuilder = astBuilder;
  this.$filter = $filter;
}

ASTCompiler.scope = "scope";
ASTCompiler.local = "local";
ASTCompiler.value = 'value';
ASTCompiler.ensureSafeMemberName = 'ensureSafeMemberName';
ASTCompiler.ensureSafeObject = 'ensureSafeObject';
ASTCompiler.ensureSafeFunction = 'ensureSafeFunction';
ASTCompiler.ifDefined = 'ifDefined';
ASTCompiler.filter = 'filter';
ASTCompiler.inputStage = 'inputStage';
ASTCompiler.assignStage = 'assignStage';
ASTCompiler.mainStage = 'mainStage';


function getInputs(ast) {
  if (ast.length !== 1) {
    return;
  }
  var candidate = ast[0].toWatch;
  if (candidate.length !== 1 || candidate[0] !== ast[0]) {
    return candidate;
  }
}

function isAssignable(ast) {
  return ast.type === AST.Identifier || ast.type == AST.MemberExpression;
}

function assignableAST(ast) {
  if (ast.body.length == 1 && isAssignable(ast.body[0])) {
    return {
      type: AST.AssignExpression,
      left: ast.body[0],
      right: { type: AST.NGValueParameter }
    };
  }
}

ASTCompiler.prototype.compile = function(text) {
  var ast = this.astBuilder.ast(text);
  this.markConstantAndWatchExpressions(ast, this.$filter);
  // AST compilation will be done here
  this.state = {
    nextId: 0,
    vars: [],
    filters: {},
    fn: { body: [], vars: [] },
    inputs: [],
    assign: { body: [], vars: [] }
  };
  this.stage = ASTCompiler.inputStage;
  var that = this;
  _.forEach(getInputs(ast.body), function(input, idx) {
    var inputKey = 'fn' + idx;
    that.state[inputKey] = { body: [], vars: [] };
    that.state.computing = inputKey;
    that.state[inputKey].body.push(
      'return ' + that.recurse(input) + ';');
    that.state.inputs.push(inputKey);
  });
  this.stage = ASTCompiler.assignStage;
  var assignable = assignableAST(ast);
  var assignFn = '';
  if (assignable) {
    this.state.computing = 'assign';
    this.state.assign.body.push(this.recurse(assignable));
    assignFn = 'fn.assign = function(' +
      ASTCompiler.scope + ',' +
      ASTCompiler.value + ',' +
      ASTCompiler.local + '){' +
      (this.state.assign.vars.length ?
        'var ' + this.state.assign.vars.join(',') + ';' :
        ''
      ) +
      this.state.assign.body.join('') +
      '};';
  }

  this.stage = ASTCompiler.mainStage;
  this.state.computing = 'fn';
  this.recurse(ast);
  var fnString = this.filterPrefix() +
    'var fn=function(' +
    ASTCompiler.scope + ',' +
    ASTCompiler.local + '){' +
    (this.state.fn.vars.length ? 'var ' +
      this.state.fn.vars.join(',') + ';' : ''
    ) +
    this.state.fn.body.join('') + '};' +
    this.watchFns() +
    assignFn +
    'return fn;';
  /*console.log(this.state);
  console.log(fnString);
  console.log(this.state.fn.body);*/
  /* jshint -W054 */
  var fn = new Function(ASTCompiler.ensureSafeMemberName,
    ASTCompiler.ensureSafeObject,
    ASTCompiler.ensureSafeFunction,
    ASTCompiler.ifDefined,
    ASTCompiler.filter,
    fnString)(
    ensureSafeMemberName,
    ensureSafeObject,
    ensureSafeFunction,
    ifDefined,
    this.$filter);
  fn.literal = this.isLiteral(ast);
  fn.constant = ast.constant;
  return fn;
  /* jshint +W054 */
};


ASTCompiler.prototype.watchFns = function() {
  var result = [];
  var that = this;
  _.forEach(this.state.inputs, function(inputName) {
    result.push('var ', inputName, '=function(' +
      ASTCompiler.scope + ',' +
      ASTCompiler.local + ') {',
      (that.state[inputName].vars.length ?
        'var ' + that.state[inputName].vars.join(',') + ';' :
        ''
      ),
      that.state[inputName].body.join(''),
      '};');
  });
  if (result.length) {
    result.push('fn.inputs = [', this.state.inputs.join(','), '];');
  }

  return result.join('');
};

ASTCompiler.prototype.isLiteral = function(ast) {
  return ast.body.length === 0 ||
    ast.body.length === 1 && (
      ast.body[0].type === AST.Literal ||
      ast.body[0].type === AST.ArrayExpression ||
      ast.body[0].type === AST.ObjectExpression);
};

ASTCompiler.prototype.markConstantAndWatchExpressions = function(ast, $filter) {
  var allConstants;
  var argsToWatch;
  var that = this;
  switch (ast.type) {
    case AST.Program:
      allConstants = true;
      _.forEach(ast.body, function(expr) {
        that.markConstantAndWatchExpressions(expr, $filter);
        allConstants = allConstants && expr.constant;
      });
      ast.constant = allConstants;
      break;
    case AST.Literal:
      ast.constant = true;
      ast.toWatch = [];
      break;
    case AST.Identifier:
      ast.constant = false;
      ast.toWatch = [ast];
      break;
    case AST.ArrayExpression:
      allConstants = true;
      argsToWatch = [];
      _.forEach(ast.value, function(element) {
        that.markConstantAndWatchExpressions(element, $filter);
        allConstants = allConstants && element.constant;
        if (!element.constant) {
          argsToWatch = argsToWatch.concat(element.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;
    case AST.ObjectExpression:
      allConstants = true;
      argsToWatch = [];
      _.forEach(ast.value, function(property) {
        that.markConstantAndWatchExpressions(property.value, $filter);
        allConstants = allConstants && property.value.constant;
        if (!property.value.constant) {
          argsToWatch = argsToWatch.concat(property.value.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = argsToWatch;
      break;
    case AST.MemberExpression:
      this.markConstantAndWatchExpressions(ast.object, $filter);
      if (ast.computed) {
        this.markConstantAndWatchExpressions(ast.property, $filter);
      }
      ast.constant = ast.object.constant &&
        (!ast.computed || ast.property.constant);
      ast.toWatch = [ast];
      break;
    case AST.CallExpression:
      var stateless = ast.filter && !$filter(ast.callee.name).$stateful;
      allConstants = stateless ? true : false;
      argsToWatch = [];
      _.forEach(ast.arguments, function(arg) {
        that.markConstantAndWatchExpressions(arg, $filter);
        allConstants = allConstants && arg.constant;
        if (!arg.constant) {
          argsToWatch = argsToWatch.concat(arg.toWatch);
        }
      });
      ast.constant = allConstants;
      ast.toWatch = stateless ? argsToWatch : [ast];
      break;
    case AST.AssignExpression:
      this.markConstantAndWatchExpressions(ast.left, $filter);
      this.markConstantAndWatchExpressions(ast.right, $filter);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;
    case AST.UnaryExpression:
      this.markConstantAndWatchExpressions(ast.value, $filter);
      ast.constant = ast.value.constant;
      ast.toWatch = ast.value.toWatch;
      break;
    case AST.MultiplicativeExpression:
    case AST.AdditiveExpression:
    case AST.EqualityExpression:
    case AST.RelationalExpression:
      this.markConstantAndWatchExpressions(ast.left, $filter);
      this.markConstantAndWatchExpressions(ast.right, $filter);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = ast.left.toWatch.concat(ast.right.toWatch);
      break;
    case AST.LogicalExpression:
      this.markConstantAndWatchExpressions(ast.left, $filter);
      this.markConstantAndWatchExpressions(ast.right, $filter);
      ast.constant = ast.left.constant && ast.right.constant;
      ast.toWatch = [ast];
      break;
    case AST.ConditionalExpression:
      this.markConstantAndWatchExpressions(ast.test, $filter);
      this.markConstantAndWatchExpressions(ast.consequent, $filter);
      this.markConstantAndWatchExpressions(ast.alternate, $filter);
      ast.constant =
        ast.test.constant && ast.consequent.constant && ast.alternate.constant;
      ast.toWatch = [ast];
      break;
  }
};

ASTCompiler.prototype.addEnsureSafeFunction = function(expr) {
  this.state[this.state.computing].body.push('ensureSafeFunction(' + expr + ');');
};

ASTCompiler.prototype.addEnsureSafeMemberName = function(expr) {
  this.state[this.state.computing].body.push(this.ensureSafeMemberName(expr) + ';');
};

ASTCompiler.prototype.addEnsureSafeObject = function(expr) {
  this.state[this.state.computing].body.push(this.ensureSafeObject(expr) + ';');
};

ASTCompiler.prototype.filterPrefix = function() {
  if (_.isEmpty(this.state.filters)) {
    return '';
  } else {
    var that = this;
    var parts = _.map(this.state.filters, function(varName, filterName) {
      return varName + '=' +
        'filter(' + that.escape(filterName) + ')';
    });
    return 'var ' + parts.join(',') + ';';
  }
};

ASTCompiler.prototype.recurse = function(ast, context, create) {
  var that = this;
  var intoId;
  switch (ast.type) {
    case AST.Program:
      _.forEach(_.initial(ast.body), function(stmt) {
        that.state[that.state.computing].body.push(that.recurse(stmt), ';');
      });
      this.state[this.state.computing].body.push(
        'return ', this.recurse(_.last(ast.body)), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
    case AST.ArrayExpression:
      var elements = _.map(ast.value, function(element) {
        return that.recurse(element);
      });
      return '[' + elements.join(',') + ']';
    case AST.ObjectExpression:
      intoId = this.nextId();
      var properties = _.map(ast.value, function(property) {
        var key = property.key.type === AST.Identifier ? property.key.name : that.escape(property.key.value);
        var value = that.recurse(property.value);
        return key + ':' + value;
      });
      this.state[this.state.computing].body.push(
        this.assign(intoId,
          '{' + properties.join(',') + '}')
      );
      return intoId;
    case AST.Identifier:
      ensureSafeMemberName(ast.name);
      intoId = ASTCompiler.scope;
      var localMember;
      if (this.stage === ASTCompiler.inputStage) {
        localMember = 'false';
      } else {
        localMember = this.link(ASTCompiler.local, ast.name);
      }

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
      var callContext, callee, args;
      if (ast.filter) {
        callee = this.filter(ast.callee.name);
        args = _.map(ast.arguments, function(arg) {
          return that.recurse(arg);
        });
      } else {
        callContext = {};
        callee = this.recurse(ast.callee, callContext);
        args = _.map(ast.args, function(arg) {
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
      }
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
    case AST.RelationalExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) +
        ')' + ast.operator + '(' +
        this.ifDefined(this.recurse(ast.right), 0) + ')';
    case AST.EqualityExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) +
        ')' + ast.operator + '(' +
        this.ifDefined(this.recurse(ast.right), 0) + ')';
    case AST.LogicalExpression:
      return '(' + this.ifDefined(this.recurse(ast.left), 0) +
        ')' + ast.operator + '(' +
        this.ifDefined(this.recurse(ast.right), 0) + ')';
    case AST.ConditionalExpression:
      intoId = this.nextId();
      var testId = this.nextId();
      this.state[this.state.computing].body.push(this.assign(testId, this.recurse(ast.test)));
      this.if_(testId,
        this.assign(intoId, this.recurse(ast.consequent)));
      this.if_(this.not(testId),
        this.assign(intoId, this.recurse(ast.alternate)));
      return intoId;
    case AST.NGValueParameter:
      return ASTCompiler.value;
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

ASTCompiler.prototype.nextId = function(skip) {
  var id = 'v' + (this.state.nextId++);
  if (!skip) {
    this.state[this.state.computing].vars.push(id);
  }
  return id;
};

ASTCompiler.prototype.filter = function(name) {
  if (!this.state.filters.hasOwnProperty(name)) {
    this.state.filters[name] = this.nextId(true);
  }
  return this.state.filters[name];
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
  this.state[this.state.computing].body.push(
    'if (', test, '){', consequent, '}');
};

ASTCompiler.prototype.ifelseif_ = function(condition1, consequent, condition2, otherwise) {
  this.state[this.state.computing].body.push(
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

function Parser(lexer, $filter) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast, $filter);
}

Parser.prototype.parse = function(text) {
  return this.astCompiler.compile(text);
};

function constantWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var unwatch = scope.$watch(
    function() {
      return watchFn(scope);
    },
    function(newValue, oldValue, scope) {
      if (_.isFunction(listenerFn)) {
        listenerFn.apply(this, arguments);
      }
      unwatch();
    },
    valueEq);
  return unwatch;
}

function oneTimeWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var lastValue;
  var unwatch = scope.$watch(
    function() {
      return watchFn(scope);
    },
    function(newValue, oldValue, scope) {
      lastValue = newValue;
      if (_.isFunction(listenerFn)) {
        listenerFn.apply(this, arguments);
      }
      if (!_.isUndefined(newValue)) {
        scope.$$postDigest(function() {
          if (!_.isUndefined(lastValue)) {
            unwatch();
          }
        });
      }
    }, valueEq
  );
  return unwatch;
}

function oneTimeLiteralWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  function isAllDefined(val) {
    return !_.some(val, _.isUndefined);
  }
  var unwatch = scope.$watch(function() {
    return watchFn(scope);
  }, function(newValue, oldValue, scope) {
    if (_.isFunction(listenerFn)) {
      listenerFn.apply(this, arguments);
    }
    if (isAllDefined(newValue)) {
      scope.$$postDigest(function() {
        if (isAllDefined(newValue)) {
          unwatch();
        }
      });
    }
  }, valueEq);
  return unwatch;
}

function expressionInputDirtyCheck(newValue, oldValue) {
  return newValue === oldValue ||
    (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
}

function inputsWatchDelegate(scope, listenerFn, valueEq, watchFn) {
  var inputExpressions = watchFn.inputs;
  var oldValues = _.times(inputExpressions.length, _.constant(function() {}));
  var lastResult;
  return scope.$watch(function() {
    var changed = false;
    _.forEach(inputExpressions, function(inputExpr, i) {
      var newValue = inputExpr(scope);
      if (changed || !expressionInputDirtyCheck(newValue, oldValues[i])) {
        changed = true;
        oldValues[i] = newValue;
      }
    });
    if (changed) {
      lastResult = watchFn(scope);
    }
    return lastResult;
  }, listenerFn, valueEq);
}

function parse(expr) {
  if (_.isFunction(expr)) {
    return expr;
  } else if (typeof expr === 'string') {
    var lexer = new Lexer();
    var parser = new Parser(lexer);
    var oneTime = false;
    if (expr.charAt(0) === ':' && expr.charAt(1) === ':') {
      oneTime = true;
      expr = expr.substring(2);
    }

    var parseFn = parser.parse(expr);
    if (parseFn.constant) {
      parseFn.$$watchDelegate = constantWatchDelegate;
    } else if (oneTime) {
      parseFn.$$watchDelegate = parseFn.literal ? oneTimeLiteralWatchDelegate : oneTimeWatchDelegate;
    } else if (parseFn.inputs) {
      parseFn.$$watchDelegate = inputsWatchDelegate;
    }
    return parseFn;
  } else {
    return _.noop;
  }
}

function $ParseProvider() {
  this.$get = ['$filter', function($filter) {
    return function(expr) {
      switch (typeof expr) {
        case 'string':
          var lexer = new Lexer();
          var parser = new Parser(lexer, $filter);
          var oneTime = false;
          if (expr.charAt(0) === ':' && expr.charAt(1) === ':' ) {
            oneTime = true;
            expr = expr.substring(2);
          }
          var parseFn = parser.parse(expr);
          if (parseFn.constant) {
            parseFn.$$watchDelegate = constantWatchDelegate;
          } else if (oneTime) {
            parseFn.$$watchDelegate = parseFn.literal ? oneTimeLiteralWatchDelegate: oneTimeWatchDelegate;
          } else if (parseFn.inputs) {
            parseFn.$$watchDelegate = inputsWatchDelegate;
          }
          return parseFn;
        case 'function':
          return expr;
        default:
          return _.noop;
      }
    };
  }];
}

module.exports = $ParseProvider;
