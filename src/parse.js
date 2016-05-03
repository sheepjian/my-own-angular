'use strict';

var _ = require('lodash');

var TOKEN = {
    SPACE: 0,
    INTEGER: 1,
    DOUBLE: 2,
    UNKNOWN: 3
};

var REGEXP = [{
    pattern: /^\s+$/,
    token: TOKEN.SPACE
}, {
    pattern: /^-?\d+$/,
    token: TOKEN.INTEGER
}, {
    pattern: /^-?\d+\.\d*$/,
    token: TOKEN.FLOAT
}, {
    pattern: /^.*$/,
    token: TOKEN.UNKNOWN
}];

function Lexer() {}

Lexer.prototype.lex = function(text) {
    // Tokenization will be done here
    var tokens = [];
    var textArray = text.match(/\S+/g);
    _.forEach(textArray, function(t) {
        for (var i = 0; i < REGEXP.length; i++) {
            var reg = REGEXP[i];
            if (reg.pattern.test(t)) {
                tokens.push(reg.token);
                break;
            }
        }
    });
    return tokens;
};

function AST(lexer) {
    this.lexer = lexer;
}


// build the tree node: {value:'', type:''}
AST.prototype.ast = function(text) {
    this.tokens = this.lexer.lex(text);
    // AST building will be done here
    if (this.tokens.length == 1) {
        if (this.tokens[0] === TOKEN.INTEGER) {
            return function() {
                return parseInt(text);
            };
        } else if (this.tokens[0] === TOKEN.FLOAT) {
            return function() {
                return parseFloat(text);
            };
        }
    }

    return function() {
        return null;
    };
};

function ASTCompiler(astBuilder) {
    this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
    var ast = this.astBuilder.ast(text);
    // AST compilation will be done here
    return ast;
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
