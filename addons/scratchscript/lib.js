function genID$1() {
  // https://github.com/scratchfoundation/scratch-blocks/blob/d77b39a43707ed0da2e3e9fd887addb9f023878e/core/utils.js#L615
  const soup = "!#$%()*+,-./:;=?@[]^_`{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var length = 20;
  var soupLength = soup.length;
  var id = [];
  for (var i = 0; i < length; i++) {
    id[i] = soup.charAt(Math.random() * soupLength);
  }
  return id.join("");
}

function isFloat(val) {
  var floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
  if (!floatRegex.test(val)) return false;
  val = parseFloat(val);
  if (isNaN(val)) return false;
  return true;
}

function escapeQuotationMarks(text) {
  return text.replace(/('|\"|\\)/g, "\\$&");
}

class Token {
  static TYPES = {
    VALUE: "value",
    CHAR: "char",
  };
  constructor(value, type, startChar, endChar) {
    this.value = value;
    this.type = type;
    this.startChar = startChar;
    this.endChar = endChar;
  }
}

class Lexer {
  static CONTEXT_TEMINATING_CHARS = ['"', "'", "#", "\n", "<", ">", "(", ")", "[", "]", " ", "\t", "{", "}"];

  constructor(text) {
    this.text = text;
    this.charIndex = -1;
    this.tokens = [];
    this.context = "";
    this.currentChar = "";
    this.slashDepth = 0;
  }

  next() {
    this.charIndex++;
    this.currentChar = this.text.charAt(this.charIndex);
    if (Lexer.CONTEXT_TEMINATING_CHARS.includes(this.currentChar) && this.slashDepth % 2 === 0) {
      this.addToken(this.context, Token.TYPES.VALUE);
      this.addToken(this.currentChar, Token.TYPES.CHAR);
      this.context = "";
    } else {
      this.context += this.currentChar;
    }
    if (this.currentChar === "\\") this.slashDepth++;
    if (this.charIndex + 1 === this.text.length) {
      this.addToken(this.context, Token.TYPES.VALUE);
      this.tokens.filter((t) => !t.value);
      return this.tokens;
    } else {
      return this.next();
    }
  }

  addToken(value, type) {
    this.tokens.push(new Token(value, type, this.charIndex - value.length, this.charIndex));
    this.context = "";
    this.contextType = null;
  }
}

class TreeNode {
  static TYPES = {
    LITERAL: "literal",
    STATEMENT: "statement",
    NAME: "name",
    FIELD: "field",
    COMMENT: "comment",
    ROUND_REPORTER: "round_reporter",
    BOOL_REPORTER: "bool_reporter",
    BLOCK: "block",
    NEWLINE: "newline",
    //TOP_LEVEL: 'top_level',
  };

  constructor(data, type, children = [], startChar, id = null, endChar, parentId = null, value = "") {
    this.startChar = startChar;
    this.endChar = endChar;
    this.data = data;
    this.value = value || data.value;
    this.type = type;
    this.children = children;
    this.id = id || genID$1();
    this.parentId = parentId;
    this.isTopLevel = false;
  }

  addChild(node) {
    node.parentId = this.id;
    this.children.push(node);
  }

  findNodeById(id) {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].id === id) return this.children[i];
      let childFind = this.children[i].findNodeById(id);
      if (childFind) {
        return childFind;
      }
    }
    return false;
  }
}

class Lexer2 {
  constructor(tokens) {
    this.tokens = tokens.filter((t) => t.value);
    this.tokenIndex = -1;
    this.currentToken = undefined;
    this.context = [];
    this.root = new TreeNode({}, TreeNode.TYPES.TOP_LEVEL);
  }

  inc() {
    this.tokenIndex++;
    this.getToken();
  }

  peek() {
    return this.tokens[this.tokenIndex + 1];
  }

  prev() {
    return this.tokens[this.tokenIndex - 1];
  }

  consumeType(tokenType) {
    if (this.currentToken?.type === tokenType) this.inc();
  }

  consumeAllTypes(tokenType) {
    while (this.currentToken?.type === tokenType) this.inc();
  }

  consumeValue(tokenValue) {
    if (this.currentToken?.value === tokenValue) this.inc();
  }

  consumeAllValues(tokenValue) {
    while (this.currentToken?.value === tokenValue) this.inc();
  }

  dec() {
    this.tokenIndex--;
    this.getToken();
  }

  getToken() {
    this.currentToken = this.tokens[this.tokenIndex] || undefined;
  }

  consumeWhitespace() {
    while (this.currentToken && [" ", "\t"].includes(this.currentToken.value)) this.inc();
  }

  expression() {
    while (this.tokenIndex < 0) {
      this.inc();
    }
    this.expressionStartIndex = this.currentToken.startChar;
    this.getToken();
    this.consumeWhitespace();
    if (!this.currentToken) return;
    // only use context terminating chars
    if (this.currentToken.value === "#") {
      let comment = this.comment();
      this.inc();
      return comment;
    } else if (this.currentToken.value === "(") {
      let reporter = this.reporter(")");
      this.consumeValue(")");
      return reporter;
    } else if (this.currentToken.value === "[") {
      let expr = this.field();
      this.consumeValue("]");
      return expr;
    } else if (this.currentToken.value === "{") {
      let expr = this.block();
      this.consumeValue("}");
      return expr;
    } else if (this.currentToken.value === "<") {
      let reporter = this.reporter(">");
      this.consumeValue(">");
      return reporter;
    } else if (this.currentToken.value === '"') {
      let str = this.string('"');
      this.consumeValue('"');
      return str;
    } else if (this.currentToken.value === "'") {
      let str = this.string("'");
      this.consumeValue("'");
      return str;
    }
    // this should catch the whole number as there are no context terminating chars in a number
    else if (isFloat(this.currentToken.value)) {
      let node = new TreeNode(
        {
          value: this.currentToken.value,
          numValue: parseFloat(this.currentToken.value),
        },
        TreeNode.TYPES.LITERAL,
        [],
        this.expressionStartIndex,
        this.currentToken.endChar
      );
      this.inc();
      return node;
    } else if (this.currentToken.value === "\n") {
      this.inc();
      return new TreeNode({}, TreeNode.TYPES.NEWLINE);
    } /*
        else if (this.currentToken.value === '\n') {
            var stat = this.statement();
            this.inc();
            return stat;
        }*/ else {
      var node = new TreeNode(
        {
          value: this.currentToken.value,
        },
        TreeNode.TYPES.NAME,
        [],
        this.expressionStartIndex,
        this.currentToken.endChar
      );
      this.inc();
      //console.log(node, this.currentToken)
      return node;
    }
  }

  field() {
    var value = this.string("]");
    value.type = TreeNode.TYPES.FIELD;
    return value;
  }

  string(strType) {
    var strValue = "";
    var slashDepth = 0;
    this.inc();
    while (
      this.currentToken?.value != strType &&
      this.tokenIndex < this.tokens.length /* && this.slashDepth % 2 != 1 */
    ) {
      if (this.currentToken.value === "\n") return Error("Unterminated String-like over new line.");
      if (this.currentToken.value.charAt(0) === "\\") {
        slashDepth++;
        this.currentToken = new Token(this.currentToken.value.slice(1), this.currentToken.type);
        continue;
      } else {
        strValue += "\\".repeat(Math.floor(slashDepth / 2));
        if (slashDepth % 2 === 1) {
          if (this.currentToken.value.charAt(0) === "n") {
            strValue += "\n" + this.currentToken.value.slice(1);
          } else if (this.currentToken.value.charAt(0) === "t") {
            strValue += "\t" + this.currentToken.value.slice(1);
          } else {
            console.warn("Unexpected '\\' before '" + this.currentToken.value.charAt(0) + "'");
            strValue += this.currentToken.value;
          }
        } else {
          strValue += this.currentToken.value;
        }
        slashDepth = 0;
        this.inc();
      }
    }
    this.inc();
    return new TreeNode(
      {
        value: strValue,
      },
      TreeNode.TYPES.LITERAL,
      [],
      this.expressionStartIndex,
      this.currentToken.endChar
    );
  }

  reporter(repType) {
    this.inc();
    let reporter = new TreeNode({}, repType === ">" ? TreeNode.TYPES.BOOL_REPORTER : TreeNode.TYPES.ROUND_REPORTER);
    while (this.currentToken?.value != repType && this.tokenIndex < this.tokens.length) {
      reporter.addChild(this.expression());
    }
    if (reporter.children.length === 1) reporter.value = reporter.children[0].value;
    reporter.startChar = this.expressionStartIndex;
    reporter.endChar = this.currentToken.endChar;
    return reporter;
  }

  comment() {
    this.inc();
    var commentValue = "";
    while (!["#"].includes(this.currentToken?.value) && this.tokenIndex < this.tokens.length) {
      commentValue += this.currentToken.value;
      this.inc();
    }
    return new TreeNode(
      {
        value: commentValue,
      },
      TreeNode.TYPES.COMMENT,
      [],
      this.expressionStartIndex,
      this.currentToken?.endChar
    );
  }

  statement() {
    //this.inc();
    if (this.currentToken?.value === "\n") this.inc();
    var startIndex = this.currentToken?.startChar;
    var statement = new TreeNode({}, TreeNode.TYPES.STATEMENT);
    while (this.currentToken?.value != "\n" && this.tokenIndex < this.tokens.length && !!this.currentToken) {
      //console.log(this.currentToken)
      let expr = this.expression();
      if (this.currentToken?.value === "\n" || !expr || expr?.value == "\n") break;
      //console.log(expr.value);
      //this.inc();
      statement.addChild(expr);
    }
    statement.startChar = startIndex;
    statement.endChar = this.currentToken?.endChar || this.prev()?.endChar;
    return statement;
  }

  block() {
    this.inc();
    var startIndex = this.currentToken?.startChar;
    var node = new TreeNode({}, TreeNode.TYPES.BLOCK);
    var expressions = [];
    while (this.currentToken?.value != "}" && this.tokenIndex < this.tokens.length) {
      //let stat = this.statement();
      //if (!stat || stat?.value == '}') break;
      expressions.push(this.expression());
    }
    var statementExpressions = [];
    for (let exprI = 0; exprI < expressions.length; exprI++) {
      let thisExpr = expressions[exprI];
      console.log(thisExpr);
      if (thisExpr.type != TreeNode.TYPES.NEWLINE) {
        if (statementExpressions.length === 0) statementExpressions.push([]);
        statementExpressions[statementExpressions.length - 1].push(thisExpr);
      } else {
        statementExpressions.push([]);
      }
    }
    node.children = statementExpressions.map((exprs) => new TreeNode({}, TreeNode.TYPES.STATEMENT, exprs));
    node.startChar = startIndex;
    node.endChar = this.currentToken?.endChar || this.prev()?.endChar;
    //console.log('children', node.children)
    node.children = node.children.filter((stat) => stat.children.length != 0);
    //console.log(node.children);
    return node;
  }

  parse() {
    this.expressionStartChar = 0;
    this.root = this.block();
    this.root.isTopLevel = true;
    return this.root;
  }
}

function lexText(text) {
  var L1 = new Lexer(text);
  var L2 = new Lexer2(L1.next());
  return L2.parse();
}

var lexer = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  Lexer: Lexer,
  Lexer2: Lexer2,
  Token: Token,
  TreeNode: TreeNode,
  lexText: lexText,
});

class ParseError extends Error {
  constructor(...args) {
    super(...args);
    this.name = "ParseError";
  }
}

class ErrorHandler extends EventTarget {
  constructor(text) {
    super();
    this.text = text;
    this.dead = false;
  }

  unmatchedBlock(blockSet, parentBlock, parentOpcode) {
    console.log(arguments);
    const correspondingText = this.text.slice(blockSet[0]?.startChar, blockSet[blockSet.length - 1]?.endChar);
    const error = new ParseError(
      `"${correspondingText}" did not find a match between ${blockSet[0]?.startChar} and ${
        blockSet[blockSet.length - 1]?.endChar
      }`
    );
    throw error;
  }
}

class BlockIOType {
  static STRING = "bio_string";
  static NUMBER = "bio_number";
  static ANGLE = "bio_angle";
  static BOOL = "bio_bool";
  static SUBSTACK = "bio_substack";
  // should only be used for statement matching in internal (ie non-scratch blocks)
  static STATEMENT = "bio_statement";
  static RAW_FIELD = "bio_raw_field";
  static FIELD = "bio_field";
  static REPORTER = "bio_reporter";
  static RAW_NUMBER = "bio_raw_number";
  static RAW_STRING = "bio_raw_string";
  static RAW_ANGLE = "bio_raw_string";
  static toTypes(type) {
    return (() => {
      switch (type) {
        case BlockIOType.STRING:
          return [TreeNode.TYPES.LITERAL, TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER];
        case BlockIOType.NUMBER:
          return [TreeNode.TYPES.LITERAL, TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER];
        case BlockIOType.ANGLE:
          return [TreeNode.TYPES.LITERAL, TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER];
        case BlockIOType.BOOL:
          return [TreeNode.TYPES.BOOL_REPORTER];
        case BlockIOType.SUBSTACK:
          return [TreeNode.TYPES.BLOCK];
        case BlockIOType.RAW_FIELD:
          return [TreeNode.TYPES.FIELD];
        case BlockIOType.REPORTER:
          return [TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER];
        case BlockIOType.FIELD:
          return [TreeNode.TYPES.FIELD, TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER];
        case BlockIOType.RAW_STRING:
          return [TreeNode.TYPES.LITERAL];
        case BlockIOType.RAW_NUMBER:
          return [TreeNode.TYPES.LITERAL];
        case BlockIOType.RAW_ANGLE:
          return [TreeNode.TYPES.LITERAL];
        case BlockIOType.STATEMENT:
          return [TreeNode.TYPES.STATEMENT];
        default:
          return [];
      }
    })().concat(type); // we add the type on the end which doesn't affect matching so that we are able to check back in future as to the original type
  }

  static toType(types) {
    return types.find((t) => t.slice(0, 3) === "bio");
  }

  static toRaw(type) {
    switch (type) {
      case BlockIOType.STRING:
        return BlockIOType.RAW_STRING;
      case BlockIOType.NUMBER:
        return BlockIOType.RAW_NUMBER;
      case BlockIOType.ANGLE:
        return BlockIOType.RAW_ANGLE;
      case BlockIOType.FIELD:
        return BlockIOType.RAW_FIELD;
      default:
        return type;
    }
  }
}

class RuleMatch {
  constructor(
    id = null,
    inputs = {},
    opcode = "none",
    comments = [],
    _tokens = [],
    parent = null,
    next = null,
    parentContext = null
  ) {
    this.id = id || genID$1();
    this.inputs = inputs;
    this.opcode = opcode;
    this.comments = comments;
    this._tokens = _tokens;
    this.parent = parent;
    this.next = next;
    this.parentContext = parentContext;
  }
}

class TokenMatch {
  constructor(values = [], types = [], inputName = false, topLevelOnly = false) {
    this.values = values;
    this.types = types;
    this.inputName = inputName;
    this.topLevelOnly = topLevelOnly;
  }

  value(...values) {
    this.values = this.values.concat(values);
    return this;
  }

  type(...types) {
    this.types = this.types.concat(types);
    return this;
  }

  check(token, ruleSet) {
    if (this.types.length != 0 && !this.types.includes(token?.type)) return false;
    // only check values for 'name' tokens
    if (token?.type === TreeNode.TYPES.NAME && this.values.length != 0 && !this.values.includes(token?.value))
      return false;
    if (
      token?.type === TreeNode.TYPES.FIELD &&
      typeof this.values === "string" &&
      !ruleSet.blockCategory.fieldByName(this.values).keys().includes(token?.value)
    )
      return false;
    //if (!(this.topLevelOnly || (token.topLevel && this.topLevelOnly))) return false;
    return true;
  }
}

class ParentContext {
  constructor(block, opcode, ioType) {
    this.block = block;
    this.opcode = opcode;
    this.ioType = ioType;
  }
}

class ParentContextRule {
  constructor(blockMatch = null, opcodes = [], ioTypes = []) {
    // I think we may not need blockMatch if we have ioType but I'm not certain (and I'm not yet willing to take the plunge)
    this.blockMatch = blockMatch || new TokenMatch();
    this.opcodes = opcodes;
    this.ioTypes = ioTypes;
  }

  type(...types) {
    this.blockMatch.type(...types);
    return this;
  }

  opcode(...opcodes) {
    this.opcodes = this.opcodes.concat(opcodes);
    return this;
  }

  io(...type) {
    this.ioTypes = this.ioTypes.concat(type);
    return this;
  }

  topLevelOnly() {
    this.blockMatch.isTopLevelOnly = true;
  }

  check(parentContext, ruleSet) {
    //console.log(this, parentContext)
    if (this.blockMatch && parentContext.block) {
      //console.log(this.blockMatch, parentContext.block)
      if (!this.blockMatch.check(parentContext.block, ruleSet)) return false;
    }
    if (this.opcodes.length > 0 && parentContext.opcode) {
      //console.log(this.opcodes, parentContext.opcode)
      if (!this.opcodes.includes(parentContext.opcode)) return false;
    }
    if (this.ioTypes.length > 0 && parentContext.ioType) {
      //console.log(this.ioTypes, parentContext.ioType)
      if (!this.ioTypes.includes(parentContext.ioType)) return false;
    }
    //console.log(true)
    return true;
  }
}

class Rule {
  constructor(opcode = "none") {
    this.tokenMatches = [];
    this.aliases = [];
    this.opcode = opcode;
    this.parentContextRule = new ParentContextRule();
    //this.parentOpcode = parentOpcode;
    //this.parentTokenRule = new TokenMatch();
  }

  input(type, name, values = []) {
    this.tokenMatches.push(new TokenMatch(values, BlockIOType.toTypes(type), name));
    return this;
  }

  type(...types) {
    this.tokenMatches.push(new TokenMatch([], types));
    return this;
  }

  value(...values) {
    this.tokenMatches.push(new TokenMatch(values, []));
    return this;
  }

  _checkTokenList(blockSet, ruleSet, tokenList = []) {
    console.log("checking list", tokenList, "against", blockSet);
    let commentCount = 0;
    for (let tokenI = 0; tokenI < blockSet.length; tokenI++) {
      //console.log('checking next token', tokenI + commentCount, blockSet.length, this.tokenMatches.length, this.tokenMatches[tokenI], blockSet[tokenI + commentCount])
      if (tokenI >= tokenList.length && blockSet[tokenI + commentCount]?.type != TreeNode.TYPES.COMMENT) {
        if (blockSet[tokenI + commentCount]) return false;
        break;
      }
      //console.log('check rule', this, blockSet[tokenI + commentCount], this.tokenMatches[tokenI]);
      if (tokenList[tokenI]?.check(blockSet[tokenI + commentCount], ruleSet)) {
        continue;
      } else if (blockSet[tokenI + commentCount]?.type === TreeNode.TYPES.COMMENT) {
        commentCount++;
        tokenI--;
        continue;
      } else {
        console.log(
          tokenList[tokenI],
          blockSet[tokenI + commentCount],
          tokenList[tokenI].check(blockSet[tokenI + commentCount], ruleSet)
        );
        console.log("check failed");
        return false;
      }
    }
    return true;
  }

  getAlias(blockSet, parentContext, ruleSet) {
    console.log("ruleSet", ruleSet);
    //console.log("parent", parentContext, this.parentContextRule, this.parentContextRule && !this.parentContextRule.check(parentContext, ruleSet))
    if (this.parentContextRule && !this.parentContextRule.check(parentContext, ruleSet)) return false;
    console.log(blockSet, parentContext);
    if (this._checkTokenList(blockSet, ruleSet, this.tokenMatches)) {
      return this.tokenMatches;
    }
    for (let aliasI = 0; aliasI < this.aliases.length; aliasI++) {
      console.log("alias", aliasI, this.aliases[aliasI], this._checkTokenList(blockSet, ruleSet, this.aliases[aliasI]));
      if (this._checkTokenList(blockSet, ruleSet, this.aliases[aliasI])) {
        return this.aliases[aliasI];
      }
    }
    return false;
  }

  parseInput(token, ruleSet, id, inputRule) {
    //console.log(arguments)
    var input;
    // here, for raw inputs where reporters are expected
    // we add a 'ghost' sub-reporter node so that shadow blocks
    // can still slot in
    //console.log(inputRule.types, BlockIOType.toType(inputRule.types))
    if (token?.type === TreeNode.TYPES.FIELD && inputRule.types.includes(BlockIOType.FIELD)) {
      var ghost = new TreeNode({ value: token.value }, TreeNode.TYPES.FIELD);
      var ghostReporter = new TreeNode({}, TreeNode.TYPES.ROUND_REPORTER);
      ghostReporter.children = [ghost];
      input = ruleSet.matchNode(
        ghostReporter,
        new ParentContext(token, this.opcode, BlockIOType.toType(inputRule.types))
      );
      input.parent = id;
    } else if (
      token?.type === TreeNode.TYPES.LITERAL &&
      [BlockIOType.STRING, BlockIOType.NUMBER, BlockIOType.ANGLE].some((t) => inputRule?.types.includes(t))
    ) {
      var ghost = new TreeNode({ value: token.value }, TreeNode.TYPES.LITERAL);
      var ghostReporter = new TreeNode({}, TreeNode.TYPES.ROUND_REPORTER);
      ghostReporter.children = [ghost];
      //console.log("ghost", ghost, ghostReporter)
      input = ruleSet.matchNode(
        ghostReporter,
        new ParentContext(token, this.opcode, BlockIOType.toType(inputRule.types))
      );
      input.parent = id;
    } else if (token.type === TreeNode.TYPES.BLOCK) {
      input = ruleSet.matchBlock(token, this.opcode);
      input = input.map((i, index) => {
        i.parent = input[index - 1]?.id || id;
        i.next = input[index + 1]?.id;
        return i;
      });
    } else if ([TreeNode.TYPES.BOOL_REPORTER, TreeNode.TYPES.ROUND_REPORTER].includes(token.type)) {
      input = ruleSet.matchNode(token, new ParentContext(token, this.opcode, BlockIOType.toType(inputRule.types)));
      if (token.type === TreeNode.TYPES.BLOCK && input)
        input = input.map((i, index) => {
          i.parent = input[index - 1]?.id || id;
          i.next = input[index + 1]?.id;
          return i;
        });
      else if (input) input.parent = id;
    } else {
      input = /*ruleSet.match([token], parentBlock, parentOpcode) || */ token.value;
      if (input.id /* ie it is an instance of RuleMatch and not a string value */) input.parent = id;
    }
    return input;
  }

  match(blockSet, ruleSet, parentContext) {
    var alias = this.getAlias(blockSet, parentContext, ruleSet);
    if (!alias) return false;
    var inputs = {};
    var comments = [];
    var id = genID$1();
    for (
      let tokenI = 0;
      tokenI < alias.length || blockSet[tokenI + comments.length]?.type === TreeNode.TYPES.COMMENT;
      tokenI++
    ) {
      if (blockSet[tokenI + comments.length]?.type === TreeNode.TYPES.COMMENT) {
        comments.push(blockSet[tokenI + comments.length]);
        tokenI--;
        continue;
      }
      console.log(alias[tokenI]);
      if (!!alias[tokenI].inputName) {
        inputs[alias[tokenI].inputName] = this.parseInput(
          blockSet[tokenI + comments.length],
          ruleSet,
          id,
          alias[tokenI]
        );
      }
    }
    return new RuleMatch(
      id,
      inputs,
      this.opcode,
      comments,
      blockSet.slice(0, comments.length + this.tokenMatches.length),
      null,
      null,
      parentContext
    );
  }
}

class RuleSet {
  constructor(rules = [], blockCategory = null, error = null) {
    this.rules = rules;
    this.error = error || new ErrorHandler("");
    this.blockCategory = blockCategory;
  }

  merge(other) {
    this.rules = this.rules.concat(other.rules);
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  checkRule(blockSet, rule, parentContext) {
    if (blockSet.length < rule.tokenMatches.length) {
      return false;
    } else {
      return rule.check(blockSet, parentContext, this);
    }
  }

  matchToRule(blockSet, rule, parentContext) {
    return rule.match(blockSet, this, parentContext);
  }

  findMatch(blockSet, parentContext) {
    for (let ruleI = 0; ruleI < this.rules.length; ruleI++) {
      console.log(this.rules[ruleI].opcode, blockSet);
      let match = this.matchToRule(blockSet, this.rules[ruleI], parentContext);
      if (match) {
        return match;
      }
    }
    //console.log('unmatched', blockSet)
    this.error.unmatchedBlock(blockSet, parentContext);
    return false;
  }

  matchBlock(blockNode, parentOpcode = null, parentInput = null) {
    // var parentContext = new ParentContext(blockNode, parentOpcode, parentInput || BlockIOType.STATEMENT);
    return blockNode.children.map((b) =>
      this.matchNode(b, new ParentContext(b, parentOpcode, parentInput || BlockIOType.STATEMENT))
    );
  }

  matchNode(node, parentContext, _blockCategory) {
    return this.findMatch(node.children, parentContext || new ParentContext(node), _blockCategory);
  }

  parse(text) {
    this.error.text = text;
    var L1 = new Lexer(text);
    var L2 = new Lexer2(L1.next());
    var parsedNodes = L2.parse();
    console.log(JSON.stringify(parsedNodes));
    //return this.match(parsedNodes.children, new ParentContext(parsedNodes))
    return this.matchBlock(parsedNodes);
  }
}

var parser = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  BlockIOType: BlockIOType,
  ParentContext: ParentContext,
  Rule: Rule,
  RuleMatch: RuleMatch,
  RuleSet: RuleSet,
  TokenMatch: TokenMatch,
});

var parsing = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  lexer: lexer,
  parser: parser,
});

class Variable {
  // from scratch-vm src/engine/variable.js
  static get SCALAR_TYPE() {
    return "";
  }
  static get LIST_TYPE() {
    return "list";
  }
  static get BROADCAST_MESSAGE_TYPE() {
    return "broadcast_msg";
  }
  constructor(name, type, isCloud = false) {
    this.name = name;
    this.type = type;
    this.id = genID();
    this.isCloud = isCloud;
  }
  attach(target) {
    target.createVariable(this.id, this.name, this.type, this.isCloud);
  }
}

class Block extends Rule {
  constructor(opcode) {
    super(opcode);
    this._shadow = false;
    this._hat = false;
    this.extraInputData = {};
  }

  shadow() {
    this._shadow = true;
    return this;
  }

  hat() {
    this._hat = true;
    return this;
  }

  _computeShadow(input, ruleMatch, _blockCategory) {
    var match;
    try {
      var node = new TreeNode({}, TreeNode.TYPES.ROUND_REPORTER, [
        new TreeNode(
          { value: this.extraInputData[input.inputName].defaultValue },
          this.extraInputData[input.inputName].fieldType ? TreeNode.TYPES.FIELD : TreeNode.TYPES.LITERAL
        ),
      ]);

      match = _blockCategory.ruleSet.matchNode(
        node,
        new ParentContext(node, ruleMatch.opcode, BlockIOType.toType(input.types))
        /*new TreeNode({}, TreeNode.TYPES.ROUND_REPORTER),
                ruleMatch.opcode,*/
      );
    } finally {
      if (match) {
        match.parent = ruleMatch.id;
        return match;
      } else {
        console.warn("couldn't find shadow for " + input.inputName + " of " + ruleMatch.opcode);
        return null;
      }
    }
  }

  compile(scope, ruleMatch, _blockCategory, is_shadow = false) {
    console.log("compiling", ruleMatch);
    var blockData = {
      id: ruleMatch.id,
      next: ruleMatch.next,
      parent: ruleMatch.parent,
      shadow: is_shadow, // allows odd blocks to not be shadow. do we want this? //this._shadow,
      topLevel: !ruleMatch.parent,
      opcode: ruleMatch.opcode,
      fields: {},
      inputs: {},
      x: 0,
      y: 0,
    };
    var rawInputs = this.tokenMatches.filter((t) => t.inputName);
    for (let i = 0; i < rawInputs.length; i++) {
      let input = rawInputs[i];
      let inputMatch = ruleMatch.inputs[input.inputName];
      if (Array.isArray(inputMatch)) {
        console.log("using array", inputMatch);
        for (let statementI = 0; statementI < inputMatch.length; statementI++) {
          console.log("compiling", inputMatch[statementI]);
          _blockCategory.compile(scope, inputMatch[statementI]);
        }
        if (this._hat) {
          // the parent should already work
          blockData.next = inputMatch[0].id || null;
        } else {
          blockData.inputs[input.inputName] = {
            name: input.inputName,
            block: inputMatch[0].id || null,
            shadow: null,
          };
        }
      } else if (typeof inputMatch === "string") {
        if (input.types.includes(BlockIOType.RAW_FIELD)) {
          console.log(
            this.extraInputData[input.inputName],
            _blockCategory.fieldByName(this.extraInputData[input.inputName].fieldType)
          );
          blockData.fields[input.inputName] = Object.assign(
            { name: input.inputName },
            _blockCategory.fieldByName(this.extraInputData[input.inputName].fieldType).toObjectFromName(inputMatch)
          );
        } else {
          blockData.fields[input.inputName] = {
            name: input.inputName,
            value: inputMatch,
          };
        }
      } else {
        var shadowBlock = inputMatch;
        if (!_blockCategory.blockByOp(inputMatch.opcode)._shadow) {
          shadowBlock = this._computeShadow(input, ruleMatch, _blockCategory);
          _blockCategory.compile(scope, shadowBlock, true);
          _blockCategory.compile(scope, inputMatch);
        } else {
          _blockCategory.compile(scope, inputMatch, true);
        }
        console.log("shadow", shadowBlock, inputMatch);
        blockData.inputs[input.inputName] = {
          name: input.inputName,
          block: inputMatch.id,
          shadow: shadowBlock.id,
        };
      }
    }
    scope.createBlock(blockData);
    return blockData;
  }

  decompile(id, data, _blockCategory) {
    var thisData = data[id];
    var decompileString = "";
    for (let tokenI = 0; tokenI < this.tokenMatches.length; tokenI++) {
      let token = this.tokenMatches[tokenI];
      if (token.types.includes(TreeNode.TYPES.NAME)) {
        // we take the first of the available values. I don't see a better way
        decompileString += token.values[0] + " ";
        continue;
      }
      let type = BlockIOType.toType(token.types);
      let isInput = thisData.inputs.hasOwnProperty(token.inputName);
      if (!isInput && !thisData.fields.hasOwnProperty(token.inputName))
        throw Error("Block of type " + thisData.opcode + " missing expected input '" + token.inputName + "'");
      let inputData = isInput ? thisData.inputs[token.inputName] : thisData.fields[token.inputName];
      //let usesShadow = isInput && inputData.block === inputData.shadow;
      if (!isInput) {
        switch (type) {
          // fields (ie not inputs) will only use RAW inputs
          case BlockIOType.RAW_STRING:
            decompileString += `'${escapeQuotationMarks(inputData.value)}'`;
            break;
          case BlockIOType.RAW_FIELD:
            decompileString += `[${escapeQuotationMarks(
              this.extraInputData[token.inputName].fieldType.geByValue(inputData.value)
            )}]`;
            break;
          case BlockIOType.RAW_NUMBER:
          case BlockIOType.RAW_ANGLE:
            decompileString += `${inputData.value}`;
            break;
          default:
            console.error("Expected field type " + type + " on " + token.inputName);
        }
      } else {
        decompileString += _blockCategory.decompile(inputData.block, data);
      }
      decompileString += " ";
    }
    decompileString = decompileString.slice(0, -1);
    if (this.parentContextRule.blockMatch.types.includes(TreeNode.TYPES.BOOL_REPORTER)) {
      decompileString = "<" + decompileString + ">";
    } else if (this.parentContextRule.blockMatch.types.includes(TreeNode.TYPES.ROUND_REPORTER)) {
      decompileString = "(" + decompileString + ")";
    } else if (this.parentContextRule.blockMatch.types.includes(TreeNode.TYPES.STATEMENT)) {
      decompileString = decompileString + "\n";
    }
    if (thisData.next) {
      decompileString += _blockCategory.decompile(thisData.next, data);
      if (!thisData.parent || data[thisData.parent].next != id) {
        decompileString = "{\n\t" + decompileString.replace("\n", "\n\t") + "}";
      }
    }
    return decompileString;
  }
}

class FieldType {
  constructor(map, name = null) {
    this.name = name;
    this.map = map && map.length > 0 ? map : [["", ""]];
  }

  getByKey(name) {
    for (let valueI = 0; valueI < this.map.length; valueI++) {
      if (this.map[valueI][0] === name) {
        return this.map[valueI];
      }
    }
  }

  getByValue(value) {
    for (let valueI = 0; valueI < this.map.length; valueI++) {
      if (this.map[valueI][1] === value) {
        return this.map[valueI];
      }
    }
  }

  removeValue(value) {
    return new FieldType(this.map.filter((m) => m[1] != value));
  }

  values() {
    return this.map.map((item) => item[1]);
  }

  ids() {
    return this.map.map((item) => item[2] || null);
  }

  // for vars only

  types() {
    return this.map.map((item) => item[3] || Variable.SCALAR_TYPE);
  }

  keys() {
    return this.map.map((item) => item[0]);
  }

  toObjectFromName(key) {
    var entry = this.getByKey(key);
    var isVar = entry.length === 4;
    if (isVar) {
      return {
        value: entry[1],
        id: entry[2] || null,
        variableType: entry[3],
      };
    } else {
      return {
        id: null,
        value: entry[1],
      };
    }
  }

  merge(other) {
    return new FieldType(this.map.concat(other.map));
  }
}

class BlockCategory {
  constructor(blocks = [], fields = []) {
    this.blocks = blocks;
    this.fields = fields;
    this._ruleSet = null;
    this.blockCache = [];
    this.ruleSetCache = null;
  }

  block(...b) {
    this.blocks = this.blocks.concat(b);
    return this;
  }

  field(...field) {
    this.fields = this.fields.concat(field);
  }

  merge(other) {
    return new BlockCategory(this.blocks.concat(other.blocks), this.fields.concat(other.fields));
  }

  blockByOp(opcode) {
    return this.blocks.find((b) => b.opcode === opcode);
  }

  fieldByName(name) {
    return this.fields.find((f) => f.name === name);
  }

  compile(scope, matchRule, is_shadow = false) {
    this.blockByOp(matchRule.opcode).compile(scope, matchRule, this, is_shadow);
  }

  decompile(id, data) {
    return this.blockByOp(data[id].opcode).decompile(id, data, this);
  }

  get ruleSet() {
    var blockCache = this.blocks.map((b) => b.opcode).sort();
    if (this._ruleSet && blockCache === this.blockCache) return this._ruleSet;
    this.computeRuleSet();

    return this._ruleSet;
  }

  computeRuleSet() {
    this.blockCache = this.blocks.map((b) => b.opcode).sort();
    this._ruleSet = new RuleSet(this.blocks);
  }
}

class BlockCategorySet {
  constructor(categories = []) {
    this.categories = categories;
  }

  addCategory(category) {
    this.categories.push(category);
  }

  get ruleSet() {
    var ruleSet = new RuleSet([], this);
    for (let catI = 0; catI < this.categories.length; catI++) {
      ruleSet.merge(this.categories[catI].ruleSet);
    }
    return ruleSet;
  }

  blockByOp(op) {
    return this.categories.map((c) => c.blockByOp(op)).find((b) => !!b);
  }

  fieldByName(name) {
    return this.categories.map((c) => c.fieldByName(name)).find((f) => !!f);
  }

  compile(scope, matchRule, is_shadow = false) {
    this.blockByOp(matchRule.opcode).compile(scope, matchRule, this, is_shadow);
  }

  decompile(id, data) {
    return this.blockByOp(data[id].opcode).decompile(id, data, this);
  }
}

var blocks = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  Block: Block,
  BlockCategory: BlockCategory,
  BlockCategorySet: BlockCategorySet,
  FieldType: FieldType,
  Variable: Variable,
});

class BlockShorthand extends Block {
  /*reporter () {
        this.parentContextRule.blockMatch = new TokenMatch([], [TreeNode.TYPES.ROUND_REPORTER]);
    }*/

  parentOpcode(...opcode) {
    this.parentContextRule.opcode(...opcode);
    return this;
  }

  // we should only care about output types for shadow
  // blocks, for the rest, scratch allows anything (except booleans like if statements)

  parentIO(...types) {
    this.parentContextRule.io(...types);
    return this;
  }

  output_string() {
    this.parentIO(BlockIOType.STRING);
    return this;
  }

  output_number() {
    this.parentIO(BlockIOType.NUMBER);
    return this;
  }

  output_angle() {
    this.parentIO(BlockIOType.ANGLE);
    return this;
  }

  output_bool() {
    this.parentIO(BlockIOType.BOOL);
    return this;
  }

  output_field() {
    this.parentIO(BlockIOType.FIELD);
    return this;
  }

  output_statement() {
    this.parentIO(BlockIOType.STATEMENT);
    return this;
  }

  output_block() {
    this.parentIO(BlockIOType.SUBSTACK);
    return this;
  }

  parentBlockType(...types) {
    this.parentContext.type(...types);
    return this;
  }

  name(name) {
    this.tokenMatches.push(new TokenMatch([name], TreeNode.TYPES.NAME));
    return this;
  }

  input(type, name, values = []) {
    this.tokenMatches.push(new TokenMatch(values, BlockIOType.toTypes(type), name));
    return this;
  }

  string(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.STRING, name);
  }

  number(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.NUMBER, name);
  }

  angle(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.ANGLE, name);
  }

  raw_string(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.RAW_STRING, name);
  }

  raw_number(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.RAW_NUMBER, name);
  }

  raw_angle(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.RAW_ANGLE, name);
  }

  bool(name, defaultValue) {
    this.extraInputData[name] = { defaultValue };
    return this.input(BlockIOType.BOOL, name);
  }

  substack(name) {
    return this.input(BlockIOType.SUBSTACK, name);
  }

  raw_field(name, fieldType) {
    console.log("adding field", name, fieldType, this.opcode);
    this.extraInputData[name] = { fieldType: fieldType.name };
    return this.input(BlockIOType.RAW_FIELD, name, fieldType.name);
  }

  field(name, fieldType, defaultValue) {
    console.log("adding field", name, fieldType, this.opcode);
    this.extraInputData[name] = { fieldType: fieldType.name, defaultValue };
    return this.input(BlockIOType.FIELD, name, fieldType.name);
  }

  statement() {
    this.parentContextRule.type(TreeNode.TYPES.STATEMENT);
    this.output_statement();
    return this;
  }

  reporter() {
    this.parentContextRule.type(TreeNode.TYPES.ROUND_REPORTER);
    return this;
  }

  bool_reporter() {
    this.parentContextRule.type(TreeNode.TYPES.ROUND_REPORTER, TreeNode.TYPES.BOOL_REPORTER);
    this.output_bool();
    return this;
  }

  hat() {
    this.parentContextRule.topLevelOnly();
    this._hat = true;
    this.substack("_SUBSTACK");
    return this;
  }

  alias() {
    this.aliases.push(this.tokenMatches);
    this.tokenMatches = [];
    return this;
  }
}

var shorthand = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  BlockShorthand: BlockShorthand,
});

class CoreCategory extends BlockCategory {
  constructor(scope) {
    super();
    this.scope = scope;
    this.init();
    //console.log(this);
  }

  init() {
    this.comment = new BlockShorthand("comment");
    this.comment.tokenMatches.push(new TokenMatch([], [TreeNode.TYPES.COMMENT]));
    this.comment.compile = function (scope, _ruleMatch, _blockCategory) {};
    this.block(this.comment);

    // shadows
    this.math_number = new BlockShorthand("math_number");
    this.math_number.shadow().output_number().raw_number("NUM");
    this.block(this.math_number);

    this.math_angle = new BlockShorthand("math_angle");
    this.math_angle.shadow().output_angle().raw_angle("NUM");
    this.block(this.math_angle);

    this.text = new BlockShorthand("text");
    this.text.shadow().output_string().raw_string("TEXT");
    this.block(this.text);
  }
}

class MotionCategory extends BlockCategory {
  constructor(scope, parentCategory) {
    super();
    this.scope = scope;
    this.parentCategory = parentCategory;
    this.init();
  }

  // this is separate so that tey can be regenerated from any scope changes without the blocks
  initFields() {
    this.target_field = new FieldType(
      [
        ["mouse-pointer", "_mouse_"],
        ["random position", "_random_"],
      ],
      "target_field"
    ).merge(this.scope.spriteField);
    this.field(this.target_field);
    this.point_field = this.target_field.removeValue("_random_");
    this.point_field.name = "point_field";
    this.field(this.point_field);
    this.setrotationstyle_field = new FieldType(
      [
        ["left-right", "left-right"],
        ["don't rotate", "don't rotate"],
        ["all around", "all around"],
      ],
      "rotationstyle_field"
    );
    this.field(this.setrotationstyle_field);
  }

  init() {
    if (this.scope.target.isStage) return;
    this.initFields();
    this.movesteps = new BlockShorthand("motion_movesteps");
    this.movesteps.statement().name("move").number("STEPS", "10").name("steps");
    this.block(this.movesteps);
    this.turnright = new BlockShorthand("motion_turnright");
    this.turnright.statement().name("turn").name("right").number("DEGREES", "15").name("degrees");
    this.block(this.turnright);
    this.turnleft = new BlockShorthand("motion_turnleft");
    this.turnleft.statement().name("turn").name("left").number("DEGREES", "15").name("degrees");
    this.block(this.turnleft);
    this.pointindirection = new BlockShorthand("motion_pointindirection");
    this.pointindirection.statement().name("point").name("in").name("direction").angle("DIRECTION", "90");
    this.block(this.pointindirection);
    this.pointtowards_menu = new BlockShorthand("motion_pointtowards_menu");
    this.pointtowards_menu
      .shadow()
      .parentOpcode("motion_pointtowards")
      .raw_field("TOWARDS", this.point_field)
      .output_field();
    this.block(this.pointtowards_menu);
    this.pointtowards = new BlockShorthand("motion_pointtowards");
    this.pointtowards.name("point").name("towards").field("TOWARDS", this.point_field, "mouse-pointer");
    this.block(this.pointtowards);
    this.gotoxy = new BlockShorthand("motion_gotoxy");
    this.gotoxy.statement().name("go").name("to").name("x:").number("X", "0").name("y:").number("Y", "0");
    this.block(this.gotoxy);
    this.goto_menu = new BlockShorthand("motion_goto_menu");
    this.goto_menu.shadow().parentOpcode("motion_goto").raw_field("TO", this.target_field).output_field();
    this.block(this.goto_menu);
    this.goto = new BlockShorthand("motion_goto");
    this.goto.statement().name("go").name("to").field("TO", this.target_field, "mouse-pointer");
    this.block(this.goto);
    this.glidesecstoxy = new BlockShorthand("motion_glidesecstoxy");
    this.glidesecstoxy
      .statement()
      .name("glide")
      .number("SECS", "1")
      .name("secs")
      .name("to")
      .name("x:")
      .number("X", "0")
      .name("y:")
      .number("Y", "0");
    this.block(this.glidesecstoxy);
    this.glideto_menu = new BlockShorthand("motion_glideto_menu");
    this.glideto_menu
      .shadow()
      .parentOpcode("motion_glideto")
      .raw_field("TO", this.target_field, "random position")
      .output_field();
    this.block(this.glideto_menu);
    this.glideto = new BlockShorthand("motion_glideto");
    this.glideto
      .statement()
      .name("glide")
      .number("SECS", "1")
      .name("to")
      .field("TO", this.target_field, "random position");
    this.block(this.glideto);
    this.changexby = new BlockShorthand("motion_changexby");
    this.changexby.statement().name("change").name("x").name("by").number("DX", "10");
    this.block(this.changexby);
    this.setx = new BlockShorthand("motion_setx");
    this.setx.statement().name("set").name("x").name("to").number("X", "0");
    this.block(this.setx);
    this.changeyby = new BlockShorthand("motion_changeyby");
    this.changeyby.statement().name("change").name("y").name("by").number("DY", "10");
    this.block(this.changeyby);
    this.sety = new BlockShorthand("motion_sety");
    this.sety.statement().name("set").name("y").name("to").number("Y", "0");
    this.block(this.sety);
    this.setrotationstyle = new BlockShorthand("motion_setrotationstyle");
    this.setrotationstyle
      .statement()
      .name("set")
      .name("rotation")
      .name("style")
      .raw_field("STYLE", this.setrotationstyle_field, "all around");
    this.xposition = new BlockShorthand("motion_xposition");
    this.xposition.name("x").name("position").reporter();
    this.block(this.xposition);
    this.yposition = new BlockShorthand("motion_yposition");
    this.yposition.name("y").name("position").reporter();
    this.block(this.yposition);
    this.direction = new BlockShorthand("motion_direction");
    this.direction.name("direction").reporter();
    this.block(this.direction);
    // hacked blocks? - we'll have them as a separate plugin I think
  }
}

class LooksCategory extends BlockCategory {
  constructor(scope, parentCategory) {
    super();
    this.scope = scope;
    this.parentCategory = parentCategory;
    this.init();
  }

  initFields() {
    this.coloreffect_field = new FieldType(
      [
        ["color", "COLOR"],
        ["fisheye", "FISHEYE"],
        ["whirl", "WHIRL"],
        ["pixelate", "PIXELATE"],
        ["mosaic", "MOSAIC"],
        ["brightness", "BRIGHTNESS"],
        ["ghost", "GHOST"],
      ],
      "coloreffect_field"
    );
    this.field(this.coloreffect_field);

    this.costumenumbername_field = new FieldType(
      [
        ["number", "number"],
        ["name", "name"],
      ],
      "costumenumbername_field"
    );
    this.field(this.costumenumbername_field);

    this.backdrop_field = this.scope.backdropField;
    this.backdrop_field.name = "backdrop_field";
    this.field(this.backdrop_field);

    this.frontback_field = new FieldType(
      [
        ["front", "front"],
        ["back", "back"],
      ],
      "frontback_field"
    );
    this.field(this.frontback_field);

    this.backdropnumbername_field = new FieldType(
      [
        ["number", "number"],
        ["name", "name"],
      ],
      "backdropnumbername_field"
    );
    this.field(this.backdropnumbername_field);

    this.costume_field = this.scope.costumeField;
    this.costume_field.name = "costume_field";
    this.field(this.costume_field);

    this.forwardbackward_field = new FieldType(
      [
        ["forward", "forward"],
        ["backward", "backward"],
      ],
      "forwardbackward_field"
    );
    this.field(this.forwardbackward_field);
  }

  init() {
    this.initFields();
    this.sayforsecs = new BlockShorthand("looks_sayforsecs");
    this.sayforsecs.statement().name("say").string("MESSAGE", "Hello!").name("for").number("SECS", "1").name("secs");
    this.block(this.sayforsecs);

    this.say = new BlockShorthand("looks_say");
    this.say.statement().name("say").string("MESSAGE", "Hello!");
    this.block(this.say);

    this.thinkforsecs = new BlockShorthand("looks_thinkforsecs");
    this.thinkforsecs
      .statement()
      .name("think")
      .string("MESSAGE", "Hello!")
      .name("for")
      .number("SECS", "1")
      .name("secs");
    this.block(this.thinkforsecs);

    this.think = new BlockShorthand("looks_think");
    this.think.statement().name("think").string("MESSAGE", "Hello!");
    this.block(this.think);

    this.show = new BlockShorthand("looks_show");
    this.show.statement().name("show");
    this.block(this.show);

    this.hide = new BlockShorthand("looks_hide");
    this.hide.statement().name("hide");
    this.block(this.hide);

    this.changeeffectby = new BlockShorthand("looks_changeeffectby");
    this.changeeffectby
      .statement()
      .name("change")
      .raw_field("EFFECT", this.coloreffect_field)
      .name("effect")
      .name("by")
      .number("CHANGE", "25");
    this.block(this.changeeffectby);
    this.seteffectto = new BlockShorthand("looks_seteffectto");
    this.seteffectto
      .statement()
      .name("set")
      .raw_field("EFFECT", this.coloreffect_field)
      .name("effect")
      .name("to")
      .number("VALUE", "0");
    this.block(this.seteffectto);

    this.cleargraphiceffects = new BlockShorthand("looks_cleargraphiceffects");
    this.cleargraphiceffects.name("clear").name("graphic").name("effects");
    this.block(this.cleargraphiceffects);

    this.changesizeby = new BlockShorthand("looks_changesizeby");
    this.changesizeby.name("change").name("size").name("by").number("CHANGE", "10");
    this.block(this.changesizeby);

    this.setsizeto = new BlockShorthand("looks_setsizeto");
    this.setsizeto.name("set").name("to").name("by").number("VALUE", "100");
    this.block(this.setsizeto);

    this.size = new BlockShorthand("looks_size");
    this.size.name("size").reporter();
    this.block(this.size);

    this.costume = new BlockShorthand("looks_costume");
    this.costume.raw_field("COSTUME", this.costume_field).reporter().output_field().shadow();
    this.block(this.costume);

    this.switchcostumeto = new BlockShorthand("looks_switchcostumeto");
    this.switchcostumeto.name("switch").name("costume").name("to").field("COSTUME", this.costume_field, "costume1");
    this.block(this.switchcostumeto);

    this.nextcostume = new BlockShorthand("looks_nextcostume");
    this.nextcostume.name("next").name("costume");
    this.block(this.nextcostume);

    this.costumenumbername = new BlockShorthand("looks_costumenumbername");
    this.costumenumbername.name("costume").raw_field("NUMBER_NAME", this.costumenumbername_field).reporter();
    this.block(this.costumenumbername);

    this.backdrop = new BlockShorthand("looks_backdrop");
    this.backdrop.raw_field("BACKDROP", this.backdrop_field).output_field().reporter().shadow();
    this.block(this.backdrop);

    this.switchbackdropto = new BlockShorthand("looks_switchbackdropto");
    this.switchbackdropto
      .name("switch")
      .name("backdrop")
      .name("to")
      .field("BACKDROP", this.backdrop_field, "backdrop1");
    this.block(this.switchbackdropto);

    this.switchbackdroptoandwait = new BlockShorthand("looks_switchbackdroptoandwait");
    this.switchbackdroptoandwait
      .name("switch")
      .name("backdrop")
      .name("to")
      .field("BACKDROP", this.backdrop_field, "backdrop1")
      .name("and")
      .name("wait");
    this.block(this.switchbackdroptoandwait);

    this.nextbackdrop = new BlockShorthand("looks_nextbackdrop");
    this.nextbackdrop.name("next").name("backdrop");
    this.block(this.nextbackdrop);
    this.backdropnumbername = new BlockShorthand("looks_backdropnumbername");
    this.backdropnumbername.name("backdrop").raw_field("NUMBER_NAME", this.backdropnumbername_field).reporter();
    this.block(this.backdropnumbername);

    this.gotofrontback = new BlockShorthand("looks_gotofrontback");
    this.gotofrontback.name("go").name("to").raw_field("FRONT_BACK", this.frontback_field).name("layer");
    this.block(this.gotofrontback);

    this.goforwardbackwardlayers = new BlockShorthand("looks_goforwardbackwardlayers");
    this.goforwardbackwardlayers
      .name("go")
      .raw_field("FORWARD_BACKWARD", this.forwardbackward_field)
      .number("NUM", "1")
      .name("layers");
    this.block(this.goforwardbackwardlayers);
  }
}

class SoundCategory extends BlockCategory {
  constructor(scope, parentCategory) {
    super();
    this.scope = scope;
    this.parentCategory = parentCategory;
    this.init();
    //console.log(this);
  }

  initFields() {
    // technically the sounds menu should have a record... option
    // but there is no point here as it acts not as a value but as a button
    // which is useless here
    this.sounds_menu_field = this.scope.soundField;
    this.sounds_menu_field.name = "sounds_menu_field";
    this.field(this.sounds_menu_field);

    this.soundeffect_field = new FieldType(
      [
        ["pitch", "pitch"],
        ["pan", "pan"],
      ],
      "soundeffect_field"
    );
    this.field(this.soundeffect_field);
  }

  init() {
    this.initFields();
    this.sounds_menu = new BlockShorthand("sound_sounds_menu");
    this.sounds_menu.raw_field("SOUND_MENU", this.sounds_menu_field).output_field().reporter().shadow();
    this.block(this.sounds_menu);

    this.play = new BlockShorthand("sound_play");
    this.play.name("start").name("sound").field("SOUND_MENU", this.sounds_menu_field, "");
    this.block(this.play);

    this.playuntildone = new BlockShorthand("sound_playuntildone");
    this.playuntildone
      .name("play")
      .name("sound")
      .field("SOUND_MENU", this.sounds_menu_field, "")
      .name("until")
      .name("done");
    this.block(this.playuntildone);

    this.stopallsounds = new BlockShorthand("sound_stopallsounds");
    this.stopallsounds.name("stop").name("all").name("sounds");
    this.block(this.stopallsounds);

    this.seteffectto = new BlockShorthand("sound_seteffectto");
    this.seteffectto.name("set").raw_field("EFFECT", this.soundeffect_field).name("to").number("VALUE", "100");
    this.block(this.seteffectto);

    this.changeeffectby = new BlockShorthand("sound_changeeffectby");
    this.changeeffectby.name("change").raw_field("EFFECT", this.soundeffect_field).name("by").number("VALUE", "10");
    this.block(this.changeeffectby);

    this.cleareffects = new BlockShorthand("sound_cleareffects");
    this.cleareffects.name("clear").name("sound").name("effects");
    this.block(this.cleareffects);

    this.changevolumeby = new BlockShorthand("sound_changevolumeby");
    this.changevolumeby.name("change").name("volume").name("by").number("VOLUME", "-10");
    this.block(this.changevolumeby);

    this.setvolumeto = new BlockShorthand("sound_setvolumeto");
    this.setvolumeto.name("set").name("volume").name("to").number("VOLUME", "100").name("%");
    this.block(this.setvolumeto);

    this.volume = new BlockShorthand("sound_volume");
    this.volume.name("volume").reporter();
    this.block(this.volume);
  }
}

class EventCategory extends BlockCategory {
  constructor(scope, parentCategory) {
    super();
    this.scope = scope;
    this.parentCategory = parentCategory;
    this.init();
    //console.log(this);
  }

  initFields() {
    this.broadcast_field = this.scope.messageField;
    console.log("broadcast", this.broadcast_field);
    this.broadcast_field.name = "broadcast_field";
    this.field(this.broadcast_field);
    this.backdropname_field = this.scope.backdropNamesField;
    console.log("backdropname", this.backdropname_field);
    this.backdropname_field.name = "backdropname_field";
    this.field(this.backdropname_field);
  }

  init() {
    this.initFields();
    this.whenflagclicked = new BlockShorthand("event_whenflagclicked");
    this.whenflagclicked
      .name("when")
      .name("green")
      .name("flag")
      .name("clicked")
      .hat()
      .alias()
      .name("when")
      .name("flag")
      .name("clicked")
      .hat()
      .alias()
      .name("when")
      .name("gf")
      .name("clicked")
      .hat();
    this.block(this.whenflagclicked);

    this.whenthisspriteclicked = new BlockShorthand("event_whenthisspriteclicked");
    this.whenthisspriteclicked.name("when").name("this").name("sprite").name("clicked").hat();
    this.block(this.whenthisspriteclicked);

    this.whenstageclicked = new BlockShorthand("event_whenstageclicked");
    this.whenstageclicked.name("when").name("stage").name("clicked").hat();
    this.block(this.whenstageclicked);

    this.whenbroadcastrecieved = new BlockShorthand("event_whenbroadcastrecieved");
    this.whenbroadcastrecieved
      .name("when")
      .name("I")
      .name("recieve")
      .raw_field("BROADCAST_OPTION", this.broadcast_field)
      .hat();
    this.block(this.whenbroadcastrecieved);

    this.whenbackdropswitchesto = new BlockShorthand("event_whenbackdropswitchesto");
    this.whenbackdropswitchesto
      .name("when")
      .name("backdrop")
      .name("switches")
      .name("to")
      .raw_field("BACKDROP", this.backdropname_field)
      .hat();
    this.block(this.whenbackdropswitchesto);

    //this.whengreaterthan = new BlockShorthand("event_whengreaterthan");
    //this.whengreaterthan.name("when").raw_field().name("gt");
  }
}

class TargetBlockCategory extends BlockCategorySet {
  constructor(scope) {
    super();
    this.scope = scope;
    this.core = new CoreCategory(scope);
    this.motion = new MotionCategory(scope);
    this.looks = new LooksCategory(scope);
    this.sound = new SoundCategory(scope);
    this.event = new EventCategory(scope);

    this.addCategory(this.core);
    this.addCategory(this.motion);
    this.addCategory(this.looks);
    this.addCategory(this.sound);
    this.addCategory(this.event);
    //console.log(this)
  }
}

var categories = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  CoreCategory: CoreCategory,
  EventCategory: EventCategory,
  LooksCategory: LooksCategory,
  MotionCategory: MotionCategory,
  SoundCategory: SoundCategory,
  TargetBlockCategory: TargetBlockCategory,
});

class ProjectScope {
  constructor(vm) {
    this.vm = vm;
  }
}

/* This (along with the block match) is what is passed to the compiler upon which actions can be performed.
    This represents one sprite (or the stage).
*/
class BlockScope {
  constructor(target, project) {
    this.project = project;
    this.blocks = {};
    this.scripts = [];
    this.target = target;
    console.log(this.target, this.target.variables);
    this.init();
  }
  init() {
    this.variables = Object.assign(
      Object.values(this.target.runtime.getTargetForStage().variables),
      Object.values(this.target.variables)
    );
    this.newVariables = [];
    this.genFields();
  }

  soundsMenu() {
    let menu = [["", ""]];
    if (this.target && this.target.sprite.sounds.length > 0) {
      menu = this.target.sprite.sounds.map((sound) => [sound.name, sound.name]);
    }
    /*menu.push([
      ScratchBlocks.ScratchMsgs.translate("SOUND_RECORD", "record..."),
      ScratchBlocks.recordSoundCallback,
    ]);*/
    return menu;
  }

  costumesMenu() {
    if (this.target && this.target.getCostumes().length > 0) {
      return this.target.getCostumes().map((costume) => [costume.name, costume.name]);
    }
    return [["", ""]];
  }

  backdropsMenu() {
    if (this.project.vm.runtime.targets[0] && this.project.vm.runtime.targets[0].getCostumes().length > 0) {
      return this.project.vm.runtime.targets[0]
        .getCostumes()
        .map((costume) => [costume.name, costume.name])
        .concat([
          ["next backdrop", "next backdrop"],
          ["previous backdrop", "previous backdrop"],
          ["random backdrop", "random backdrop"],
        ]);
    }
    return [["", ""]];
  }

  backdropNamesMenu() {
    const stage = this.project.vm.runtime.getTargetForStage();
    if (stage && stage.getCostumes().length > 0) {
      return stage.getCostumes().map((costume) => [costume.name, costume.name]);
    }
    return [["", ""]];
  }

  spriteMenu() {
    const sprites = [];
    for (const targetId in this.project.vm.runtime.targets) {
      if (!Object.prototype.hasOwnProperty.call(this.project.vm.runtime.targets, targetId)) continue;
      if (this.project.vm.runtime.targets[targetId].isOriginal) {
        if (!this.project.vm.runtime.targets[targetId].isStage) {
          if (this.project.vm.runtime.targets[targetId] === this.project.vm.editingTarget) {
            continue;
          }
          sprites.push([
            this.project.vm.runtime.targets[targetId].sprite.name,
            this.project.vm.runtime.targets[targetId].sprite.name,
          ]);
        }
      }
    }
    return sprites;
  }

  sensing_of(ofTarget) {
    // we're going to have to have a custom Rule check function in the parser
    // which'll do the first normal pass and then check back to see if the left field
    // is of the right type
    const stageOptions = [
      ["backdrop #", "backdrop #"],
      ["backdrop name", "backdrop name"],
      ["volume", "volume"],
    ];
    const spriteOptions = [
      ["x position", "x position"],
      ["y position", "y position"],
      ["direction", "direction"],
      ["costume #", "costume #"],
      ["costume name", "costume name"],
      ["size", "size"],
      ["volume", "volume"],
    ];
    if (this.target) {
      // Get all the stage variables (no lists) so we can add them to menu when the stage is selected.
      const stageVariableOptions = this.project.vm.runtime.getTargetForStage().getAllVariableNamesInScopeByType("");
      const stageVariableMenuItems = stageVariableOptions.map((variable) => [variable, variable]);
      if (!ofTarget) {
        // normally, scratch would only allow for stage options in the dropdown
        // however, if there is a value left over, it keeps it so we will allow either sprite or stage options
        // and also with every possible variable name
        return stageOptions.concat(
          spriteOptions.concat(
            this.project.vm.runtime.targets
              .filter((t) => t.isOriginal)
              .map((t) => t.getAllVariableNamesInScopeByType("", true))
              .flat()
          )
        );
      }
      const selectedItem = ofTarget;
      if (selectedItem === "_stage_") {
        return stageOptions.concat(stageVariableMenuItems);
      }
      // Get all the local variables (no lists) and add them to the menu.
      const target = vm.runtime.getSpriteTargetByName(selectedItem);
      let spriteVariableOptions = [];
      // The target should exist, but there are ways for it not to (e.g. #4203).
      if (target) {
        spriteVariableOptions = target.getAllVariableNamesInScopeByType("", true);
      }
      const spriteVariableMenuItems = spriteVariableOptions.map((variable) => [variable, variable]);
      return spriteOptions.concat(spriteVariableMenuItems);
    }
    return [["", ""]];
  }

  cloneMenu() {
    if (this.target && this.target.isStage) {
      const menu = spriteMenu();
      if (menu.length === 0) {
        return [["", ""]]; // Empty menu matches Scratch 2 behavior
      }
      return menu;
    }
    return [["myself", "_myself_"]].concat(this.spriteMenu());
  }

  genDataFields() {
    this.messageField = this.constructFieldFromVarType("broadcast_msg");
    this.variablesField = this.constructFieldFromVarType("");
    this.listsField = this.constructFieldFromVarType("list");
  }

  genFields() {
    this.genDataFields();
    // https://github.com/scratchfoundation/scratch-gui/blob/d283c88de03864669f7047268e003ae567b98de3/src/lib/blocks.js
    this.soundField = new FieldType(this.soundsMenu());
    this.costumeField = new FieldType(this.costumesMenu());
    this.backdropField = new FieldType(this.backdropsMenu());
    this.backdropNamesField = new FieldType(this.backdropNamesMenu());
    this.spriteField = new FieldType(this.spriteMenu());
    this.cloneField = new FieldType(this.cloneMenu());
    console.log(this);
  }

  /// needs work to include global ones

  constructFieldFromVarType(varType) {
    return new FieldType(this.variables.filter((v) => v.type === varType).map((v) => [v.name, v.name, v.id, v.type]));
  }

  createVariable(variable) {
    // if a variable exists with this name, we reference that. Otherwise we add a new variable
    let lookup = this.target.lookupVariableByNameAndType(variable.name, variable.type, true);
    if (!lookup) {
      this.newVariables.push(variable);
    } else {
      variable.id = lookup.id;
    }
    this.variables.push(variable);
  }

  createBlock(block) {
    if (Object.prototype.hasOwnProperty.call(this.blocks, block.id)) return;
    this.blocks[block.id] = block;
    if (block.topLevel) this.scripts.push(block.id);
  }

  compile(text, constructive = false) {
    this.init();
    var blockSpace = new TargetBlockCategory(this);
    var parsed = blockSpace.ruleSet.parse(text);
    for (let matchI = 0; matchI < parsed.length; matchI++) {
      blockSpace.compile(this, parsed[matchI]);
    }
    this.addToTarget(constructive);
  }

  decompile() {
    this.init();
    var blockSpace = new TargetBlockCategory(this);
    return "\n".join(this.target.blocks._scripts.map((s) => blockSpace.decompile(s, this.target.blocks._blocks)));
  }

  addToTarget(constructive = false) {
    for (let varI; varI < this.newVariables.length; varI++) this.newVariables[varI].attach(this.target);
    this.target.blocks._blocks = constructive
      ? Object.fromEntries(Object.entries(this.target.blocks._blocks).concat(Object.entries(this.blocks)))
      : this.blocks;
    this.target.blocks._scripts = constructive ? this.target.blocks._scripts.concat(this.scripts) : this.scripts;
    this.target.blocks.resetCache();
    this.target.blocks.emitProjectChanged();
    this.project.vm.refreshWorkspace();
  }
}

var scope = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  BlockScope: BlockScope,
  ProjectScope: ProjectScope,
});

var compiling = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  blocks: blocks,
  scope: scope,
  shorthand: shorthand,
});

export { categories, compiling, parsing };
