'use strict';

var _ = require('lodash');

function Lexer() {
    this.text = '';
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];
}

Lexer.prototype.lex = function(text) {
    // Tokenization will be done here
    this.text = text;
    while (this.index < this.text.length) {
        this.ch = this.text.charAt(this.index);
        if (this.isNumber(this.ch) || (this.ch === '.' && this.isNumber(this.peek()))) {
            this.readNumber();
        } else if (this.ch === '\'' || this.ch === '"') {
            this.readString();
        } else if (this.isIdentifer(this.ch)) {
            this.readIdentifier();
        } else if (this.isSpace(this.ch)) {
            this.index++;
        } else {
            throw "Unexpected next character: " + this.ch;
        }
    }
    return this.tokens;
};

Lexer.prototype.peek = function() {
    return this.index < this.text.length - 1 ?
        this.text.charAt(this.index + 1) :
        false;
};

Lexer.prototype.isNumber = function(ch) {
    return '0' <= ch && ch <= '9';
};

Lexer.prototype.isIdentifer = function(ch) {
    return ch.match(/[a-zA-Z_$]/);
};

Lexer.prototype.isSpace = function(ch) {
    return ch.match(/\s/);
}

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

var ESCAPES = { 'n': '\n', 'f': '\f', 'r': '\r', 't': '\t', 'v': '\v', '\'': '\'', '"': '"' };

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
    this.tokens.push({
        text: id,
        value: this.evalIdentifier(id)
    });
};

Lexer.prototype.evalIdentifier = function(text) {
    if (text === 'true') {
        return true;
    } else if (text === 'false') {
        return false;
    } else if (text === 'null') {
        return null;
    } else {
        return undefined;
    }
};

function AST(lexer) {
    this.lexer = lexer;
}

AST.Program = "Program";
AST.Literal = "Literal";

AST.prototype.program = function() {
    return { type: AST.Program, body: this.constant() };
};

AST.prototype.constant = function() {
    return { type: AST.Literal, value: this.tokens[0].value };
};

// build the tree node: {value:'', type:''}
AST.prototype.ast = function(text) {
    this.tokens = this.lexer.lex(text);
    // AST building will be done here
    return this.program();
};

function ASTCompiler(astBuilder) {
    this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
    var ast = this.astBuilder.ast(text);
    // AST compilation will be done here
    this.state = { body: [] };
    this.recurse(ast);
    /* jshint -W054 */
    return new Function(this.state.body.join(''));
    /* jshint +W054 */
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

ASTCompiler.prototype.recurse = function(ast) {
    switch (ast.type) {
        case AST.Program:
            this.state.body.push('return  ',
                this.recurse(ast.body), ';');
            break;
        case AST.Literal:
            return this.escape(ast.value);
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
