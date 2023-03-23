/**
 * @file Contains all the logic for the parsing of queries by the {@link WorkspaceQuerier}.
 * I'm really sorry if somebody other than me ever has to debug this.
 * Wish you luck <3
 *
 * Once you *think* you understand the function of the major classes, read the docs on
 * {@link WorkspaceQuerier._createTokenGroups} for some more specifics on the algoithm works,
 * and to achieve maximum enlightenment.
 *
 * @author Tacodiva
 */

import { BlockInputType, BlockInstance, BlockShape, BlockTypeInfo } from "./BlockTypeInfo.js";

/**
 *
 * A token is a part of a query that is interpereted in a specific way.
 *
 * In the query 'say 1 = Hello World', the base tokens are 'say', '1', '=, and 'Hello World'.
 * Each token contains where in the query it is located and what {@link TokenType} it is.
 *
 * Sometimes the same section of a query has multiple tokens because there are differnt
 * interpetations of what type of token it is. For example, imagine you had a variable named
 * 'x'. The query 'set x to 10', is ambiguous because you could be referring to the motion block
 * `set x to ()` or the data block `set [x] to ()`. This ambiguity results in two different
 * tokens being creating for 'x', one is 'set x to' referring to the motion block, and the other
 * is just 'x', referring to the variable.
 *
 * Calling this a 'token' is somewhat misleading, often language interperters will have a 'parse tree'
 * with tokens and an 'abstract syntax tree' with higher level elements, but I have chosen to make these
 * two trees one in the same. Because of this, every token represents a logical part of a block.
 * Going back to the 'say 1 = Hello World' example, there are two 'parent' tokens, both are of type
 * {@link TokenTypeBlock}. The first is for the equals block, which contains three subtokens; '1',
 * '=' and 'Hello World'. The second is the say block, whos first child is 'say' and second child is
 * the token for the equals block (which itself has three children). For a query result to be valid,
 * it must have a token which encapsulates the entire query, in this case the say block token starts
 * at the first letter and ends at the last letter, so it's a valid interpetation. The token which
 * encapsulates the whole query is referred to as the root token.
 */
class Token {
  /**
   * @param {number} start
   * @param {number} end
   * @param {TokenType} type
   * @param {*} value
   * @param {number} score
   * @param {number} precedence
   * @param {boolean} isTruncated
   * @param {boolean} isLegal
   */
  constructor(start, end, type, value, score = 100, precedence = -1, isTruncated = false, isLegal = true) {
    /** @type {number} The index of the first letter of this token in the query */
    this.start = start;
    /** @type {number} The index of the last letter of this token in the query */
    this.end = end;
    /** @type {TokenType} The type of this token. */
    this.type = type;
    /** @type {*} Additional information about this token, controled and interperted by the token type. */
    this.value = value;
    /**
     * A number which represents how 'good' this interpertation of the query is. This value is used
     * to order the results once the query is finished from best to worst ('best' being the result we
     * think is most likley the interpertation the user intended).
     * The score of a parent block incorporates the scores of its children so results are ordered based
     * on the score of their root token.
     * @type {number}
     */
    this.score = score;
    /**
     * The precedence of this token, used to implement order of operations. Tokens with a higher
     * precedence should be evaluated *after* those with a lower precedence. Brackets have a
     * precedence of 0 so they are always evalulated first. A precedence of -1 means that precedence
     * is not specified and the parser makes no guarantees about the order of operations.
     * @type {number}
     */
    this.precedence = precedence;
    /**
     * Sometimes, tokens are trauncated. Imagine the query 'say Hello for 10 se', here the last
     * token should be 'seconds', but it's trauncated. For this token, the isTruncated value is set
     * to true. Additionally, the token for the whole block (which contains the tokens 'say', 'Hello',
     * 'for', '10' and 'se') also has it's isTrauncated value set to true, because it contains a
     * trunacted token.
     * @type {boolean}
     */
    this.isTruncated = isTruncated;
    /**
     * Used to generate autocomplete text, even if that autocomplete text doesn't make a valid query
     * by itself. For example in the query 'if my varia', we want to autocomplete to 'my variable',
     * but the query 'if my variable' is still not valid, because my variable is not a boolean. In
     * this case, the 'my variable' token would still be emitted as the second child of the 'if' token,
     * but it would be marked as illegal.
     */
    this.isLegal = isLegal;
  }

  /**
   * @see {TokenType.createBlockValue}
   * @param {QueryInfo} query
   * @returns
   */
  createBlockValue(query) {
    return this.type.createBlockValue(this, query);
  }
}

/**
 * The parent of any class that can enumerate tokens given a query and a location within that
 * query to search.
 *
 * As the same position in a query can have multiple interpertations (see {@link Token}), every
 * token provider's {@link parseTokens} method can return multiple tokens for the same index.
 *
 * Like tokens, there is a token provider tree. See {@link WorkspaceQuerier._createTokenGroups}
 * for more info on this tree.
 *
 * @abstract
 */
class TokenProvider {
  constructor(shouldCache) {
    if (this.constructor == TokenProvider) throw new Error("Abstract classes can't be instantiated.");
    /**
     * Can the results of this token provider be stored? True
     * if {@link parseTokens} will always return the same thing for the same inputs or if
     * this token provider already caches it's result, so caching it again is redundant.
     * @type {boolean}
     */
    this.shouldCache = shouldCache;
  }

  /**
   * Return the tokens found by this token provider in `query` at character `idx`.
   * @param {QueryInfo} query The query to search
   * @param {number} idx The index to start the search at
   * @yields {Token} All the tokens found
   * @abstract
   */
  *parseTokens(query, idx) {
    throw new Error("Sub-class must override abstract method.");
  }
}

/**
 * A token provider which wraps around another token provider, always returning a blank token in
 * addition to whatever the inner token provider returns.
 *
 * Used for tokens that can possibiliy be ommited, like numbers. For example, the '+' block always
 * needs three inputs, but the user could query '1 +'. In this case its subtokens are '1', '+' and
 * a {@link TokenTypeBlank}, provided by this provider.
 */
class TokenProviderOptional extends TokenProvider {
  /**
   * @param {TokenProvider} inner
   */
  constructor(inner) {
    super(inner.shouldCache);
    /** @type {TokenProvider} The inner token provider to return along with the blank token. */
    this.inner = inner;
  }

  *parseTokens(query, idx) {
    yield TokenTypeBlank.INSTANCE.createToken(idx);
    yield* this.inner.parseTokens(query, idx);
  }
}

/**
 * Caches the output of an inner token provider.
 * Used for tokens that are a part of multiple token provider groups.
 */
class TokenProviderSingleCache extends TokenProvider {
  /**
   * @param {TokenProvider} inner
   */
  constructor(inner) {
    super(false);
    /** @type {TokenProvider} */
    this.inner = inner;
    if (this.inner.shouldCache) {
      /** @type {Token[]?} */
      this.cache = [];
      /** @type {number?} */
      this.cacheQueryID = null;
    }
  }

  *parseTokens(query, idx) {
    if (!this.inner.shouldCache) {
      yield* this.inner.parseTokens();
      return;
    }
    if (this.cacheQueryID !== query.id) {
      this.cache = [];
      this.cacheQueryID = query.id;
    }
    let cacheEntry = this.cache[idx];
    if (cacheEntry) {
      yield* cacheEntry;
      return;
    }
    this.cacheEntry = [];
    for (const token of this.inner.parseTokens(query, idx)) {
      this.cacheEntry.push(token);
      yield token;
    }
  }
}

/**
 * Collects multiple inner token providers into one token provider group.
 * Additionally, caches the results of all the cacheable inner token providers.
 */
class TokenProviderGroup extends TokenProvider {
  constructor() {
    // No need to cache this as it already caches it's own output.
    super(false);
    /** @type {TokenProvider[]} The providers that make up this group */
    this.providers = [];
    /** @type {TokenProvider[]} Providers that are a part of the group, but tokens they produce are illegal */
    this.illegalProviders = [];
    /** @type {Object<number, CacheEntry>?} The cache */
    this.cache = null;
    /** @type {number?} The query ID of the query whos results are currently cached */
    this.cacheQueryID = null;
    /** @type {boolean} Are any of our inner tokens cacheable? */
    this.hasCachable = false;
  }

  /**
   * @typedef CacheEntry
   * @property {Token[][]} tokenCaches
   * @property {TokenProvider[][]} providerCaches
   */

  /**
   * Adds token providers to this token provider group.
   * @param {TokenProvider[]} providers
   * @param {boolean} legal Are the reuslts of this provider legal in the current context?
   */
  pushProviders(providers, legal = true) {
    if (!this.hasCachable)
      for (const provider of providers) {
        if (provider.shouldCache) {
          this.hasCachable = true;
          break;
        }
      }
    if (legal) this.providers.push(...providers);
    else this.illegalProviders.push(...providers);
  }

  *parseTokens(query, idx) {
    // If none of our providers are cacheable, just parse all the tokens again
    if (!this.hasCachable) {
      for (const provider of this.providers) yield* provider.parseTokens(query, idx, false);
      return;
    }

    // If the query ID has changed, the cache is no longer valid
    if (this.cacheQueryID !== query.id) {
      this.cache = [];
      this.cacheQueryID = query.id;
    } else {
      // Otherwise, search for a cache entry for idx
      const cacheEntry = this.cache[idx];
      if (cacheEntry) {
        // If we find one, yield all the cached results
        const tokenCaches = cacheEntry.tokenCaches;
        const providerCaches = cacheEntry.providerCaches;
        for (let i = 0; i < tokenCaches.length; i++) {
          const tokenCache = tokenCaches[i];
          const providerCache = providerCaches[i];
          for (const provider of providerCache) yield* provider.parseTokens(query, idx, false);
          yield* tokenCache;
        }
        return;
      }
    }

    // No applicable cache entry was found :(
    // Call all our child token providers and create a new cache entry

    let tokenCache = [];
    let providerCache = [];

    const tokenCaches = [tokenCache];
    const providerCaches = [providerCache];
    this.cache[idx] = { tokenCaches, providerCaches };

    for (const provider of this.providers) {
      if (provider.shouldCache) {
        for (const token of provider.parseTokens(query, idx, false)) {
          tokenCache.push(token);
          yield token;
        }
      } else {
        if (tokenCache.length !== 0) {
          tokenCache = [];
          providerCache = [];
          tokenCaches.push(tokenCache);
          providerCaches.push(providerCache);
        }
        providerCache.push(provider);
        yield* provider.parseTokens(query, idx, false);
      }
    }
    for (const provider of this.illegalProviders) {
      for (let token of provider.parseTokens(query, idx, false)) {
        token = { ...token, isLegal: false };
        tokenCache.push(token);
        yield token;
      }
    }
  }
}

/**
 * A class representing the type of a token (see {@link Token.type})
 *
 * All token types extend from {@link TokenProvider} and they provide all the tokens
 * of their type they can find.
 *
 * @abstract
 */
class TokenType extends TokenProvider {
  constructor(dontCache = false) {
    super(!dontCache);

    if (this.constructor == TokenType) throw new Error("Abstract classes can't be instantiated.");

    /**
     * If we see this token, should we know what block it's connected to?
     *
     * For example, in the query 'say Hi', 'say' is a defining feature because
     * we can narrow down what block it's from based only the fact that it's prsent.
     * 'Hi', however, is not a defining feature as it could be a part of lots of
     * different blocks.
     *
     * This is used to help eliminate some dodgey interpertations of queries, if a block
     * has no subtokens marked a defining feature it's disguarded.
     * @type {boolean}
     */
    this.isDefiningFeature = false;
    /** @type {boolean} Is this token type always represented by the same string of characters? */
    this.isConstant = false;
  }

  /**
   * Turns `token` into a value which can be passed into the {@link BlockInstance} constructor.
   * For example, in string literal tokens, this gets the string value of the token which can then
   * be used to create a block.
   * @param {Token} token
   * @param {QueryInfo} query
   * @returns {*}
   */
  createBlockValue(token, query) {
    return token.value;
  }

  /**
   * Creates the string form of this token in the same format that was used in the query.
   * If the token was only partially typed in the query, creating the text will complete the token.
   * @param {Token} token
   * @param {QueryInfo} query
   * @param {boolean} endOnly Should we only append to the end of the query. If this is false, we
   * can create text in the middle of the query that wasn't there. This is used to autocomplete
   * {@link StringEnum.GriffTokenType} tokens in the middle of a query.
   * @returns {string}
   */
  createText(token, query, endOnly) {
    throw new Error("Sub-class must override abstract method.");
  }

  /**
   * @param {Token} token
   * @param {QueryInfo} query
   * @returns {Token[]}
   */
  getSubtokens(token, query) {
    return undefined;
  }
}

/**
 * The type for tokens that represent an ommitted field.
 * Used by {@link TokenProviderOptional}
 */
class TokenTypeBlank extends TokenType {
  static INSTANCE = new TokenTypeBlank();

  constructor() {
    super();
    this.isConstant = true;
  }

  *parseTokens(query, idx) {
    yield this.createToken(idx);
  }

  /**
   * Create a new blank token
   * @param {number} idx The position of the blank token
   * @returns {Token}
   */
  createToken(idx) {
    return new Token(idx, idx, this, null, -5000);
  }

  createText(token, query) {
    return "";
  }
}

/**
 * Represents a token whos value must be one of a predetermined set of stirngs.
 * For example, a token for a dropdown menu (like the one in `set [my variable] to x`) is a
 * string enum, because the value must be one of a set of strings.
 *
 * String enums are also used for values that can only be one specific value (like the 'set' from
 * `set [my variable] to x`). These cases are just string enums with one possible value.
 */
class StringEnum {
  /**
   * The simple implimentation of TokenType for this string enum.
   */
  static FullTokenType = class extends TokenType {
    /**
     * @param {StringEnum} stringEnum
     */
    constructor(stringEnum) {
      super();
      this.stringEnum = stringEnum;
      this.isDefiningFeature = true;
      this.isConstant = stringEnum.isConstant;
    }

    *parseTokens(query, idx) {
      for (const token of this.stringEnum.getFullValues(query, idx)) {
        if (token) yield token;
      }
    }

    createText(token, query, endOnly) {
      return token.value.lower;
    }

    createBlockValue(token, query) {
      return token.value.value;
    }
  };

  /**
   * Griffpatch waneted to be able to query things like 'br p b' and have it suggest
   * `broadcast [Paint Block]`. GriffTokenType tokens are for these instances where
   * everything but the first letter can be ommited (hense, this is called the
   * GriffTokenType™)
   *
   * These results cannot just be a part of {@link FullTokenType} because they are used in
   * different places. See {@link TokenTypeBlock.createBlockTokenTypes} for more info on how griff
   * tokens work.
   */
  static GriffTokenType = class extends TokenType {
    /**
     * @param {StringEnum} stringEnum
     */
    constructor(enumValues) {
      super();
      this.values = enumValues;
      this.isConstant = this.values.length === 1;
      this.isDefiningFeature = this.isConstant;
    }

    /**
     * Importantly, this does not return a token if {@link FullTokenType} would have already returned
     * an identical token. If it did, there would be duplicate results for every block, one which internally
     * uses griff tokens the other which uses full tokens.
     */
    *parseTokens(query, idx) {
      const fullValues = this.values.getFullValues(query, idx);
      outer: for (let valueIdx = 0; valueIdx < this.values.length; valueIdx++) {
        if (fullValues[valueIdx]) continue;
        const valueInfo = this.values.values[valueIdx];
        let i = idx;

        for (let j = 0; j < valueInfo.parts.length; j++) {
          const part = valueInfo.parts[j];
          let queryPartEnd = query.skipUnignorable(i);
          const queryPart = query.lowercase.substring(i, queryPartEnd);
          const queryMatch = part.startsWith(queryPart);
          if (!queryMatch || queryPartEnd >= query.length) {
            if (j !== 0) {
              if (!queryMatch) queryPartEnd = i;
              yield new Token(
                idx,
                queryPartEnd,
                this,
                {
                  valueInfo,
                  part: j,
                  length: queryPartEnd - i,
                },
                10000,
                undefined,
                queryPartEnd >= query.length
              );
            }
            continue outer;
          }
          i = query.skipIgnorable(queryPartEnd);
        }

        yield new Token(idx, i, this, { valueInfo }, 10000);
      }
    }

    createBlockValue(token, query) {
      return token.value.valueInfo.value; // I may have named too many things 'value'
    }

    createText(token, query, endOnly) {
      if (!endOnly) return token.value.valueInfo.lower;
      if (!token.isTruncated) {
        return query.str.substring(token.start, token.end);
      }
      const str = query.str.substring(token.start, token.end - token.value.length);
      const part = token.value.valueInfo.parts[token.value.part];
      return str + part;
    }
  };

  /**
   * @typedef StringEnumValue
   * @property {string} value The string that needs to be in the query
   * @property {string} lower Cached value.toLowerCase()
   * @property {string[]} parts lower, split up by ignoreable characters.
   */

  /**
   * @param {(import("./BlockTypeInfo").BlockInputEnumOption[]} values
   */
  constructor(values) {
    /** @type {StringEnumValue[]} */
    this.values = [];
    for (const value of values) {
      let lower = value.string.toLowerCase();
      // Strip emoji
      lower = lower.replaceAll(/\p{Extended_Pictographic}/gu, "");
      const parts = [];
      {
        let lastPart = 0;
        for (let i = 0; i <= lower.length; i++) {
          const char = lower[i];
          if (QueryInfo.IGNORABLE_CHARS.indexOf(char) !== -1 || !char) {
            parts.push(lower.substring(lastPart, i));
            i = QueryInfo.skipIgnorable(lower, i);
            lastPart = i;
          }
        }
      }
      this.values.push({ lower, parts, value });
    }
    /** @type {Token?[][]?} */
    this.cache = null;
    /** @type {number?} */
    this.cacheQueryID = null;

    /** @type {StringEnum.FullTokenType} */
    this.fullTokenProvider = new StringEnum.FullTokenType(this);
    /** @type {StringEnum.GriffTokenType} */
    this.griffTokenProvider = new StringEnum.GriffTokenType(this);
    /** @type {TokenProviderGroup} A token provider group for either the full token or a griff abreviation */
    this.bothTokenProvider = new TokenProviderGroup();
    this.bothTokenProvider.pushProviders([this.fullTokenProvider, this.griffTokenProvider]);
  }

  /**
   * Gets a list of FullTokenType tokens for this string enum at idx. This can be though of as an
   * implimentation of {@link FullTokenType.parseTokens}, but it's cached so {@link GriffTokenType} can use
   * it to without repeating the search.
   * @param {QueryInfo} query
   * @param {number} idx
   * @returns {Token?[]} Map of value indecies to their corresponding tokens.
   */
  getFullValues(query, idx) {
    if (this.cacheQueryID !== query.id) {
      this.cacheQueryID = query.id;
      this.cache = [];
    }
    let cacheEntry = this.cache[idx];
    if (cacheEntry) return cacheEntry;
    cacheEntry = this.cache[idx] = [];

    for (let valueIdx = 0; valueIdx < this.length; valueIdx++) {
      const valueInfo = this.values[valueIdx];
      cacheEntry.push(null);
      const remainingChar = query.length - idx;
      if (remainingChar < valueInfo.lower.length) {
        if (valueInfo.lower.startsWith(query.lowercase.substring(idx))) {
          const end = remainingChar < 0 ? 0 : query.length;
          cacheEntry[valueIdx] = new Token(idx, end, this.fullTokenProvider, valueInfo, 100000, undefined, true);
        }
      } else {
        if (query.lowercase.startsWith(valueInfo.lower, idx)) {
          cacheEntry[valueIdx] = new Token(
            idx,
            idx + valueInfo.lower.length,
            this.fullTokenProvider,
            valueInfo,
            100000
          );
        }
      }
    }
    return cacheEntry;
  }

  /**
   * @returns {number} The number of values in this enum.
   */
  get length() {
    return this.values.length;
  }

  get isConstant() {
    return this.length === 1;
  }
}

/**
 * The token type for a litteral string, like 'Hello World' in the query `say Hello World`
 */
class TokenTypeStringLiteral extends TokenType {
  static TERMINATORS = [undefined, " ", "+", "-", "*", "/", "=", "<", ">", ")"];

  /**
   * Each time we encounter a 'terminator' we have to return the string we've read so far as a
   * possible interpertation. If we didn't, when looking for a string at index 4 of 'say Hello
   * World for 10 seconds' we would just return 'Hello World for 10 seconds', leading to the
   * only result being `say "Hello World for 10 seconds"`. This also means in addition to
   * 'Hello World' we also return 'Hello', 'Hello World for', 'Hello World for 10' and '
   * Hello World for 10 seconds', but that's just the price we pay for trying to enumerate every
   * interpetation.
   */
  *parseTokens(query, idx) {
    // First, look for strings in quotes
    let quoteEnd = -1;
    if (query.str[idx] === '"' || query.str[idx] == '"') {
      const quote = query.str[idx];
      for (let i = idx + 1; i <= query.length; i++) {
        if (query.str[i] === "\\") {
          ++i;
        } else if (query.str[i] === quote) {
          yield new Token(idx, i + 1, this, query.str.substring(idx + 1, i), 100000);
          quoteEnd = i + 1;
          break;
        }
      }
    }
    // Then all the other strings
    let wasTerminator = false,
      wasIgnorable = false;
    for (let i = idx; i <= query.length; i++) {
      const isTerminator = TokenTypeStringLiteral.TERMINATORS.indexOf(query.str[i]) !== -1;
      if (wasTerminator !== isTerminator && !wasIgnorable && i !== idx && i !== quoteEnd) {
        const value = query.str.substring(idx, i);
        let score = -10;
        if (TokenTypeNumberLiteral.isValidNumber(value)) score = 1000;
        yield new Token(idx, i, this, value, score);
      }
      wasTerminator = isTerminator;
      wasIgnorable = QueryInfo.IGNORABLE_CHARS.indexOf(query.str[i]) !== -1;
    }
  }

  createText(token, query, endOnly) {
    return query.str.substring(token.start, token.end);
  }
}

/**
 * The token type for a litteral number, like 69 in the query 'Hello + 69'
 * This token type also supports numbers in formats scratch doesn't let you type,
 * but accepts like '0xFF', 'Infinity' or '1e3'.
 */
class TokenTypeNumberLiteral extends TokenType {
  static isValidNumber(str) {
    return !isNaN(str) && !isNaN(parseFloat(str));
  }

  *parseTokens(query, idx) {
    for (let i = idx; i <= query.length; i++) {
      if (TokenTypeStringLiteral.TERMINATORS.indexOf(query.str[i]) !== -1 && i !== idx) {
        const value = query.str.substring(idx, i);
        if (TokenTypeNumberLiteral.isValidNumber(value)) {
          yield new Token(idx, i, this, value, 100000);
          break;
        }
      }
    }
  }

  createText(token, query, endOnly) {
    return query.query.substring(token.start, token.end);
  }
}

/**
 * A token type for litteral colours, like '#ffffff' for white.
 */
class TokenTypeColor extends TokenType {
  static INSTANCE = new TokenProviderOptional(new TokenTypeColor());

  *parseTokens(query, idx) {
    if (!query.str.startsWith("#", idx)) return;
    for (let i = 0; i < 6; i++) {
      if (TokenTypeNumberLiteral.HEX_CHARS.indexOf(query.lowercase[idx + i + 1]) === -1) return;
    }
    yield new Token(idx, idx + 7, this, query.str.substring(idx, idx + 7));
  }

  createText(token, query, endOnly) {
    return query.query.substring(token.start, token.end);
  }
}

/**
 * A token type for tokens that are in brackets, like (1 + 1) in '(1 + 1) * 2'.
 */
class TokenTypeBrackets extends TokenType {
  /**
   * @param {TokenProvider} tokenProvider
   */
  constructor(tokenProvider) {
    super();
    /** @type {TokenProvider} The tokens to look for between the brackets */
    this.tokenProvider = tokenProvider;
  }

  *parseTokens(query, idx) {
    const start = idx;
    if (query.str[idx++] !== "(") return;
    idx = query.skipIgnorable(idx);
    for (const token of this.tokenProvider.parseTokens(query, idx)) {
      if (token.type instanceof TokenTypeBlank) continue; // Do not allow empty brackets like '()'
      var tokenEnd = query.skipIgnorable(token.end);
      let isTruncated = token.isTruncated;
      if (!isTruncated) {
        if (tokenEnd === query.length) isTruncated = true;
        else if (query.str[tokenEnd] === ")") ++tokenEnd;
        else continue;
      }
      // Note that for bracket tokens, precidence = 0
      const newToken = new Token(start, tokenEnd, this, token.value, token.score + 100, 0, isTruncated, token.isLegal);
      newToken.innerToken = token;
      yield newToken;
    }
  }

  createBlockValue(token, query) {
    return token.innerToken.createBlockValue(token.innerToken, query);
  }

  createText(token, query, endOnly) {
    let text = "(";
    text += query.str.substring(token.start + 1, token.innerToken.start);
    text += token.innerToken.type.createText(token.innerToken, query, endOnly);
    if (token.innerToken.end !== token.end) text += query.str.substring(token.innerToken.end, token.end - 1);
    text += ")";
    return text;
  }

  getSubtokens(token, query) {
    return [token.innerToken];
  }
}

/**
 * The token type for a block, like 'say Hello' or '1 + 1'.
 */
class TokenTypeBlock extends TokenType {
  /**
   * Creates all the possible block token types for a given block.
   *
   * Note that each block has two token types, one version is allowed to use griff
   * tokens and the other isn't. The block that supports griff tokens doesn't support
   * nested blocks. This is needed because queries like 'i t = t' have a rediculus number
   * of possible interpertations ('i t = t' has 4941), so to avoid this we disallow
   * nested blocks when you're using griff tokens.
   *
   * @param {WorkspaceQuerier} querier
   * @param {*} block
   * @returns {TokenTypeBlock[]} The possible block token types.
   */
  static createBlockTokenTypes(querier, block) {
    let fullTokenProviders = [];
    let griffTokenProviders = [];

    let hasGriffableToken = false;

    for (const blockPart of block.parts) {
      let fullTokenProvider;
      let griffTokenProvider;
      if (typeof blockPart === "string") {
        const stringEnum = new StringEnum([{ value: null, string: blockPart }]);
        fullTokenProvider = stringEnum.fullTokenProvider;
        if (hasGriffableToken) {
          griffTokenProvider = stringEnum.bothTokenProvider;
        } else {
          griffTokenProvider = stringEnum.griffTokenProvider;
          hasGriffableToken = true;
        }
      } else {
        switch (blockPart.type) {
          case BlockInputType.ENUM:
            const stringEnum = new StringEnum(blockPart.values);
            fullTokenProvider = stringEnum.bothTokenProvider;
            if (blockPart.isRound) {
              const enumGroup = new TokenProviderGroup();
              enumGroup.pushProviders([fullTokenProvider, querier.tokenGroupRoundBlocks]);
              fullTokenProvider = enumGroup;
            }
            if (hasGriffableToken) {
              griffTokenProvider = stringEnum.bothTokenProvider;
            } else {
              griffTokenProvider = stringEnum.griffTokenProvider;
              hasGriffableToken = true;
            }
            break;
          case BlockInputType.STRING:
            fullTokenProvider = querier.tokenGroupString;
            // Only allow literals for griff token blocks
            griffTokenProvider = new TokenProviderOptional(querier.tokenTypeStringLiteral);
            break;
          case BlockInputType.NUMBER:
            fullTokenProvider = querier.tokenGroupNumber;
            // Only allow literals for griff token blocks
            griffTokenProvider = new TokenProviderOptional(querier.tokenTypeNumberLiteral);
            break;
          case BlockInputType.COLOUR:
            fullTokenProvider = TokenTypeColor.INSTANCE;
            griffTokenProvider = TokenTypeColor.INSTANCE;
            break;
          case BlockInputType.BOOLEAN:
            fullTokenProvider = querier.tokenGroupBoolean;
            griffTokenProvider = TokenTypeBlank.INSTANCE;
            break;
          case BlockInputType.BLOCK:
            fullTokenProvider = querier.tokenGroupStack;
            griffTokenProvider = TokenTypeBlank.INSTANCE;
            break;
        }
      }
      fullTokenProviders.push(fullTokenProvider);
      griffTokenProviders.push(griffTokenProvider);
    }

    return [new TokenTypeBlock(block, fullTokenProviders), new TokenTypeBlock(block, griffTokenProviders)];
  }

  /**
   * @param {BlockInstance} block
   * @param {TokenProvider[]} tokenProviders
   * @private
   */
  constructor(block, tokenProviders) {
    super();
    this.block = block;
    /**
     * The list of token types that make up this block.
     *
     * For example, for the non-griff version of the 'say' block this array would contains two
     * providers, the first is a {@link StringEnum.FullTokenType} containing only the value 'say'
     * and the second is equal to querier.tokenGroupString.
     *
     * @type {TokenProvider[]}
     */
    this.tokenProviders = tokenProviders;
    this.hasSubTokens = true;
  }

  *parseTokens(query, idx) {
    for (const subtokens of this._parseSubtokens(idx, 0, query)) {
      subtokens.reverse();
      let score = 0;
      let isLegal = true;
      let isTruncated = subtokens.length < this.tokenProviders.length;
      let hasDefiningFeature = false;

      // Calculate the score of this block, through a lot of arbitrary math that seems to work ok.

      for (const subtoken of subtokens) {
        isTruncated |= subtoken.isTruncated; // If any of our kids are trauncated, so are we
        isLegal &&= subtoken.isLegal; // If any of our kids are illegal, so are we
        if (!subtoken.isTruncated) score += subtoken.score;
        else score += subtoken.score / 100000 - 10; // Big score penalty if trauncated
        if (subtoken.type.isDefiningFeature && subtoken.start < query.length) hasDefiningFeature = true;
      }
      score += Math.floor(1000 * (subtokens.length / this.tokenProviders.length));

      /** See {@link TokenType.isDefiningFeature} */
      if (!hasDefiningFeature) continue;
      const end = query.skipIgnorable(subtokens[subtokens.length - 1].end);
      yield new Token(idx, end, this, subtokens, score, this.block.precedence, isTruncated, isLegal);
    }
  }

  /**
   * Parse all the tokens from this.tokenProviders[tokenProviderIdx] then
   * recursively call this for the next token. Returns a list of tokens for
   * each combination of possible interpertations of the subtokens.
   *
   * Note that the tokens in the returned token arrays are in reverse to the
   * order of their providers in this.tokenProviders, just to confuse you :P
   *
   * @param {number} idx
   * @param {number} tokenProviderIdx
   * @param {QueryInfo} query
   * @param {boolean} parseSubSubTokens
   * @yields {Token[]}
   */
  *_parseSubtokens(idx, tokenProviderIdx, query, parseSubSubTokens = true) {
    idx = query.skipIgnorable(idx);
    let tokenProvider = this.tokenProviders[tokenProviderIdx];

    for (const token of tokenProvider.parseTokens(query, idx)) {
      ++query.tokenCount;
      if (!query.canCreateMoreTokens()) break;

      if (this.block.precedence !== -1) {
        // If we care about the precedence of this block
        // Discard this token if its precedence is higher than ours, meaning it should be calculated
        //  before us not afterward.
        if (token.precedence > this.block.precedence) continue;
        /**
         * This check eliminates thousands of results by making sure blocks with equal precedence
         * can only contain themselves as their own first input. Without this, the query '1 + 2 + 3'
         * would have two interpretations '(1 + 2) + 3' and '1 + (2 + 3)'. This rule makes the second
         * of those invalid because the root '+' block contains itself as its third token.
         */
        if (token.precedence === this.block.precedence && tokenProviderIdx !== 0) continue;
      }

      if (!parseSubSubTokens || !token.isLegal || tokenProviderIdx === this.tokenProviders.length - 1) {
        yield [token];
      } else {
        for (const subTokenArr of this._parseSubtokens(token.end, tokenProviderIdx + 1, query, !token.isTruncated)) {
          subTokenArr.push(token);
          yield subTokenArr;
        }
      }
    }
  }

  createBlockValue(token, query) {
    if (!token.isLegal) throw new Error("Cannot create a block from an illegal token.");
    const blockInputs = [];

    for (let i = 0; i < token.value.length; i++) {
      const blockPart = this.block.parts[i];
      if (typeof blockPart !== "string") blockInputs.push(token.value[i].createBlockValue(query));
    }
    while (blockInputs.length < this.block.inputs.length) blockInputs.push(null);

    return this.block.createBlock(...blockInputs);
  }

  createText(token, query, endOnly) {
    if (!token.isTruncated && endOnly) return query.str.substring(token.start, token.end);
    let text = "";
    if (token.start !== token.value[0].start) {
      text += query.str.substring(token.start, token.value[0].start);
    }
    for (let i = 0; i < token.value.length; i++) {
      const subtoken = token.value[i];
      const subtokenText = subtoken.type.createText(subtoken, query, endOnly) ?? "";
      text += subtokenText;
      if (i !== token.value.length - 1) {
        const next = token.value[i + 1];
        const nextStart = next.start;
        if (nextStart !== subtoken.end) {
          text += query.str.substring(subtoken.end, nextStart);
        } else {
          if (
            (!endOnly || nextStart >= query.length) &&
            subtokenText.length !== 0 &&
            QueryInfo.IGNORABLE_CHARS.indexOf(subtokenText.at(-1)) === -1
          )
            text += " ";
        }
      }
    }
    return text;
  }

  getSubtokens(token, query) {
    return token.value;
  }
}

/**
 * A single interpertation of a query.
 */
export class QueryResult {
  constructor(query, token) {
    /**
     * The query that this is a result of.
     * @type {QueryInfo}
     */
    this.query = query;
    /**
     * The root token of this result.
     *
     * The root token is a token which encapulates the entire query.
     * @type {Token}
     */
    this.token = token;
  }

  get isTruncated() {
    return this.token.isTruncated;
  }

  /**
   * @param {boolean} endOnly
   * @returns {string}
   */
  toText(endOnly) {
    return this.token.type.createText(this.token, this.query, endOnly) ?? "";
  }

  /**
   * @returns {BlockInstance}
   */
  createBlock() {
    return this.token.createBlockValue(this.query);
  }
}

/**
 * Information on the current query being executed, with some utility
 * functions for helping out token providers.
 */
class QueryInfo {
  /** Characters that can be safely skipped over. */
  static IGNORABLE_CHARS = [" "];

  constructor(querier, query, id) {
    /** @type {WorkspaceQuerier} */
    this.querier = querier;
    /** @type {string} The query */
    this.query = query.replaceAll(String.fromCharCode(160), " ");
    /** @type {string} A lowercase version of the query. Used for case insensitive comparisons. */
    this.queryLc = this.query.toLowerCase();
    /** @type {number} A unique identifier for this query */
    this.id = id;
    /** @type{number} The number of tokens we've found so far */
    this.tokenCount = 0;
  }

  /**
   * @param {string} str
   * @param {number} idx The index to start at.
   * @returns {number} The index of the next non-ignorable character in str, after idx.
   */
  static skipIgnorable(str, idx) {
    while (QueryInfo.IGNORABLE_CHARS.indexOf(str[idx]) !== -1) ++idx;
    return idx;
  }

  /**
   * @param {number} idx The index to start at.
   * @returns {number} The index of the next non-ignorable character in the query, after idx.
   */
  skipIgnorable(idx) {
    return QueryInfo.skipIgnorable(this.queryLc, idx);
  }

  /**
   * @param {string} str
   * @param {number} idx The index to start at.
   * @returns {number} The index of the next ignorable character in str, after idx.
   */
  static skipUnignorable(str, idx) {
    while (QueryInfo.IGNORABLE_CHARS.indexOf(str[idx]) === -1 && idx < str.length) ++idx;
    return idx;
  }

  /**
   * @param {number} idx The index to start at.
   * @returns {number} The index of the next ignorable character in the query, after idx.
   */
  skipUnignorable(idx) {
    return QueryInfo.skipUnignorable(this.queryLc, idx);
  }

  /** @type {number} The length in characters of the query. */
  get length() {
    return this.query.length;
  }

  /** @type {string} The query. */
  get str() {
    return this.query;
  }

  /** @type {string} The lowercase version of the query. */
  get lowercase() {
    return this.queryLc;
  }

  canCreateMoreTokens() {
    return this.tokenCount < WorkspaceQuerier.MAX_TOKENS;
  }
}

/**
 * Workspace queriers keep track of all the data needed to query a given workspace (refered to as
 * the 'workspace index') and provides the methods to execute queries on the indexed workspace.
 */
export default class WorkspaceQuerier {
  static ORDER_OF_OPERATIONS = [
    null, // brackets
    "operator_round",
    "operator_mathop",
    "operator_mod",
    "operator_divide",
    "operator_multiply",
    "operator_subtract",
    "operator_add",
    "operator_equals",
    "operator_lt",
    "operator_gt",
    "operator_or",
    "operator_and",
    "operator_not",
  ];

  static CATEGORY_PRIORITY = ["control", "events", "data", "operators"];

  /**
   * An artificial way to increase the score of common blocks so they show up first.
   */
  static SCORE_BUMP = {
    control_if: 100000,
    control_if_else: 100000,
    data_setvariableto: 99999,
  };

  /**
   * The maximum number of results to find before giving up.
   */
  static MAX_RESULTS = 1000;

  /**
   * The maximum number of tokens to find before giving up.
   */
  static MAX_TOKENS = 10000;

  /**
   * Indexes a workspace in preperation for querying it.
   * @param {BlockTypeInfo[]} blocks The list of blocks in the workspace.
   */
  indexWorkspace(blocks) {
    this._queryCounter = 0;
    this._createTokenGroups();
    this._poppulateTokenGroups(blocks);
    this.workspaceIndexed = true;
  }

  /**
   * Queries the indexed workspace for blocks matching the query string.
   * @param {string} queryStr The query.
   * @returns {{results: QueryResult[], illegalResult: QueryResult | null, limited: boolean}} A list of the results of the query, sorted by their relevance score.
   */
  queryWorkspace(queryStr) {
    if (!this.workspaceIndexed) throw new Error("A workspace must be indexed before it can be queried!");
    if (queryStr.length === 0) return { results: [], illegalResult: null, limited: false };

    const query = new QueryInfo(this, queryStr, this._queryCounter++);
    const results = [];
    let foundTokenCount = 0;
    let bestIllegalResult = null;
    let limited = false;

    for (const option of this.tokenGroupBlocks.parseTokens(query, 0)) {
      if (option.end >= queryStr.length) {
        if (option.isLegal) {
          option.score += WorkspaceQuerier.SCORE_BUMP[option.type.block.id] ?? 0;
          results.push(new QueryResult(query, option));
        } else if (!bestIllegalResult || option.score >= bestIllegalResult.token.score) {
          bestIllegalResult = new QueryResult(query, option);
        }
      }
      ++foundTokenCount;
      if (foundTokenCount > WorkspaceQuerier.MAX_RESULTS) {
        console.log("Warning: Workspace query exceeded maximum result count.");
        limited = true;
        break;
      }
      if (!query.canCreateMoreTokens()) {
        console.log("Warning: Workspace query exceeded maximum token count.");
        limited = true;
        break;
      }
    }

    // Eliminate blocks who's strings can be parsed as something else.
    //  This step removes silly suggestions like `if <(1 + 1) = "2 then"> then`
    const canBeString = Array(queryStr.length).fill(true);
    function searchToken(token) {
      const subtokens = token.type.getSubtokens(token, query);
      if (subtokens) for (const subtoken of subtokens) searchToken(subtoken);
      else if (!(token.type instanceof TokenTypeStringLiteral) && !token.isTruncated)
        for (let i = token.start; i < token.end; i++) {
          canBeString[i] = false;
        }
    }
    for (const result of results) searchToken(result.token);
    function checkValidity(token) {
      const subtokens = token.type.getSubtokens(token, query);
      if (subtokens) {
        for (const subtoken of subtokens) if (!checkValidity(subtoken)) return false;
      } else if (token.type instanceof TokenTypeStringLiteral && !TokenTypeNumberLiteral.isValidNumber(token.value)) {
        for (let i = token.start; i < token.end; i++) if (!canBeString[i]) return false;
      }
      return true;
    }
    const validResults = [];
    for (const result of results) if (checkValidity(result.token)) validResults.push(result);

    return {
      results: validResults.sort((a, b) => b.token.score - a.token.score),
      illegalResult: bestIllegalResult,
      limited,
    };
    // return results.sort((a, b) => b.token.score - a.token.score);
  }

  /**
   * Creates the token group hierarchy used by this querier.
   *
   * Each of these token groups represents a list of all the tokens that could be encountered
   * when we're looking for a specific type of input. For example, tokenGroupString contains all
   * the tokens that could be encountered when we're looking for a string input (like after the
   * word 'say' for the `say ()` block). tokenGroupBlocks is an interesting one, it contains all
   * the tokens that could be the root token of a query result. In practice, this just means all
   * the stackable blocks (like 'say') and all the reporter blocks (like '+').
   *
   * But wait, there's a problem. Blocks like `() + ()` have two inputs, both of which are numbers.
   * The issue arrises when you realize the block '+' itself also returns a number. So when we
   * try to call parseTokens on the '+' block, it will try to look for it's first parameter thus
   * calling parseTokens on tokenGroupNumber, which will call parseTokens on the '+' block again
   * (because + can return a number) which will call tokenGroupNumber again... and we're in an
   * infinite loop. We can't just exclude blocks from being their own first parameter because then
   * queries like '1 + 2 + 3' wouldn't work. The solution is something you might have only thought
   * of as a performance boost; caching. When tokenGroupNumber gets queried for the second time,
   * it's mid way though building its cache from the first query. If this happens, it just returns
   * all the tokens it had already found, but no more. So in the example above, when the + block calls
   * tokenGroupNumber for the second time it finds only the number literal '1'. It then finds the
   * second number literal '2' and yields the block '1 + 2' which gets added to tokenGroupNumber's
   * cache. '1 + 2' then gets disguarded by the queryWorkspace function because it doesn't cover the
   * whole query. But the '+' block's query to tokenGroupNumber never finished, so it will continue
   * and, because the first one we found is now a part of the cache, tokenGroupNumber will yield
   * '1 + 2' as a result. The + block will continue parsing, find the second '+' and the number '3'
   * and yield '(1 + 2) + 3'. No infinite loops!
   *
   * A consequence of this system is something I implicitly implied in the above paragraph "when the
   * + block calls tokenGroupNumber for the second time it finds only the number literal '1'" This
   * is only true if 'TokenTypeNumberLiteral' is searched before the '+' block. This is why the order
   * the token providers are in is critically important. I'll leave it as an exercise to the reader to
   * work out why, but the same parsing order problems crops up when implementing order of operations.
   * If a suggestion that should show up isn't showing up, it's probably because the token providers
   * in one of the groups is in the wrong order. Ordering the providers within the base groups is delt
   * with by {@link _poppulateTokenGroups} and the inter-group ordering is delt with below, by the
   * order they are passed into pushProviders.
   *
   * @private
   */
  _createTokenGroups() {
    this.tokenTypeStringLiteral = new TokenProviderSingleCache(new TokenTypeStringLiteral());
    this.tokenTypeNumberLiteral = new TokenProviderSingleCache(new TokenTypeNumberLiteral());

    this.tokenGroupRoundBlocks = new TokenProviderGroup(); // Round blocks like (() + ()) or (my variable)
    this.tokenGroupBooleanBlocks = new TokenProviderGroup(); // Boolean blocks like <not ()>
    this.tokenGroupStackBlocks = new TokenProviderGroup(); // Stackable blocks like `move (10) steps`
    this.tokenGroupHatBlocks = new TokenProviderGroup(); // Hat block like `when green flag clicked`

    // Anything that fits into a boolean hole. (Boolean blocks + Brackets)
    this.tokenGroupBoolean = new TokenProviderOptional(new TokenProviderGroup());
    this.tokenGroupBoolean.inner.pushProviders([
      this.tokenGroupBooleanBlocks,
      new TokenTypeBrackets(this.tokenGroupBoolean),
    ]);
    this.tokenGroupBoolean.inner.pushProviders([this.tokenGroupRoundBlocks], false);

    // Anything that fits into a number hole. (Round blocks + Boolean blocks + Number Literals + Brackets)
    this.tokenGroupNumber = new TokenProviderOptional(new TokenProviderGroup());
    this.tokenGroupNumber.inner.pushProviders([
      this.tokenTypeNumberLiteral,
      this.tokenGroupRoundBlocks,
      this.tokenGroupBooleanBlocks,
      new TokenTypeBrackets(this.tokenGroupNumber),
    ]);

    // Anything that fits into a string hole (Round blocks + Boolean blocks + String Literals + Brackets)
    this.tokenGroupString = new TokenProviderOptional(new TokenProviderGroup());
    this.tokenGroupString.inner.pushProviders([
      this.tokenTypeStringLiteral,
      this.tokenGroupRoundBlocks,
      this.tokenGroupBooleanBlocks,
      new TokenTypeBrackets(this.tokenGroupString),
    ]);

    // Anything that fits into a c shaped hole (Stackable blocks)
    this.tokenGroupStack = new TokenProviderOptional(this.tokenGroupStackBlocks);

    // Anything you can spawn using the menu (All blocks)
    this.tokenGroupBlocks = new TokenProviderGroup();
    this.tokenGroupBlocks.pushProviders([
      this.tokenGroupStackBlocks,
      this.tokenGroupBooleanBlocks,
      this.tokenGroupRoundBlocks,
      this.tokenGroupHatBlocks,
    ]);
  }

  /**
   * Poppulates the token groups created by {@link _createTokenGroups} with the blocks
   * found in the workspace.
   * @param {BlockTypeInfo[]} blocks The list of blocks in the workspace.
   * @private
   */
  _poppulateTokenGroups(blocks) {
    blocks.sort(
      (a, b) =>
        WorkspaceQuerier.CATEGORY_PRIORITY.indexOf(b.category) - WorkspaceQuerier.CATEGORY_PRIORITY.indexOf(a.category)
    );

    // Apply order of operations
    for (const block of blocks) {
      block.precedence = WorkspaceQuerier.ORDER_OF_OPERATIONS.indexOf(block.id);
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      if (block.precedence !== -1) {
        const target = blocks.length - (WorkspaceQuerier.ORDER_OF_OPERATIONS.length - (block.precedence - 1));
        if (i !== target) {
          const oldBlock = blocks[target];
          blocks[target] = block;
          blocks[i] = oldBlock;
        }
      }
    }

    for (const block of blocks) {
      for (const blockTokenType of TokenTypeBlock.createBlockTokenTypes(this, block)) {
        switch (block.shape) {
          case BlockShape.Round:
            this.tokenGroupRoundBlocks.pushProviders([blockTokenType]);
            break;
          case BlockShape.Boolean:
            this.tokenGroupBooleanBlocks.pushProviders([blockTokenType]);
            break;
          case BlockShape.Stack:
          case BlockShape.End:
            this.tokenGroupStackBlocks.pushProviders([blockTokenType]);
            break;
          case BlockShape.Hat:
            this.tokenGroupHatBlocks.pushProviders([blockTokenType]);
            break;
        }
      }
    }
  }

  /**
   * Clears the memory used by the workspace index.
   */
  clearWorkspaceIndex() {
    this.workspaceIndexed = false;
    this._destroyTokenGroups();
  }

  /**
   * @private
   */
  _destroyTokenGroups() {
    this.tokenTypeStringLiteral = null;
    this.tokenTypeNumberLiteral = null;

    this.tokenGroupBooleanBlocks = null;
    this.tokenGroupRoundBlocks = null;
    this.tokenGroupStackBlocks = null;
    this.tokenGroupHatBlocks = null;
    this.tokenGroupBoolean = null;
    this.tokenGroupNumber = null;
    this.tokenGroupString = null;
    this.tokenGroupStack = null;
    this.tokenGroupBlocks = null;
  }
}
