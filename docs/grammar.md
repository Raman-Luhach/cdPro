# MetroLang: Language Reference

## 1. Tokens (lexical specification)

| Token | Regular definition | Examples |
|---|---|---|
| KEYWORD | `board \| ride \| to \| change \| exit` (case-insensitive) | `board`, `RIDE` |
| LINE | `yellow \| blue \| violet \| magenta \| red \| pink` (case-insensitive) | `Yellow` |
| WORD | `[A-Za-z][A-Za-z0-9.'-]*` | `Rajiv`, `Vihar-I`, `Dr.` |
| NUMBER | `[0-9]+` | `21` |
| STRING | `"[^"\n]*"` | `"Dilli Haat - INA"` |
| HYPHEN | `-` (standing alone) | the `-` in `Dilli Haat - INA` |
| COMMA | `,` | the `,` in `Rohini Sector 18, 19` |
| PAREN | `(` or `)` | `Shaheed Sthal (New Bus Adda)` |
| SEMICOLON | `;` | |
| COMMENT | `//.*`, `#.*`, `/* … */` | kept in the token table, ignored by the parser |
| EOF | end of input | |

Whitespace and newlines separate tokens and are then discarded.

**Lexical errors:** L01 illegal character · L02 unterminated string · L03 unterminated block comment · L04 empty string.

## 2. Grammar (context-free, BNF)

```
<program> ::= <stmt>* EOF
<stmt>    ::= <board> | <ride> | <change> | <exit>
<board>   ::= "board" <station> ";"
<ride>    ::= "ride" [ LINE ] "to" <station> ";"
<change>  ::= "change" LINE ";"
<exit>    ::= "exit" ";"
<station> ::= STRING | <part> { <part> }
<part>    ::= WORD | NUMBER | HYPHEN | COMMA | PAREN
```

- The grammar is **LL(1)**: each statement starts with a different keyword, so one token of lookahead picks the rule.
- The `;` right before EOF may be left out.
- A LINE word may appear inside a station name when more name follows (`Red Fort`).

**FIRST sets**

| Non-terminal | FIRST |
|---|---|
| `<stmt>` | `board`, `ride`, `change`, `exit` |
| `<ride>` after `ride` | `LINE`, `to` |
| `<station>` | `STRING`, `WORD`, `NUMBER` (or `LINE` followed by a name part) |

## 3. Parser

A **recursive-descent** parser, with one function per non-terminal: `parseBoard`, `parseRide`, `parseChange`, `parseExit` and `station`.

**Error recovery**
- **Phrase level:** a missing `;` or `to` is reported, then assumed to be present, so parsing continues normally.
- **Panic mode:** any other error skips tokens up to the next `;` or statement keyword.
- Several errors can be reported in one pass.

**Syntax errors:** P01 missing `;` · P02 missing station · P03 unknown line (with a suggestion) · P04 missing `to` · P05 bad ride · P06 `change` without a line · P07 `exit` with an argument · P08 unknown statement (with a suggestion) · P09 stray `;` · P10 empty program.

## 4. Example derivation

Source: `ride Yellow to Hauz Khas;`

```
<stmt>
 └─ <ride>
     ├─ "ride"      KEYWORD
     ├─ LINE        Yellow
     ├─ "to"        KEYWORD
     ├─ <station>
     │    ├─ WORD   Hauz
     │    └─ WORD   Khas
     └─ ";"         SEMICOLON
```

AST: `Ride { lineName: yellow, station: "Hauz Khas" }`

## 5. Semantic rules

| Code | Rule |
|---|---|
| S01 | The station must exist (suggestions use edit distance) |
| S02 | The journey must start with `board` |
| S03 | You can board only once |
| S04 | The first ride must name a line |
| S05 | The boarding station must be on that line |
| S06 | The destination must be on the current line |
| S07 | `change` is only allowed at an interchange |
| S08 | The new line must stop at that interchange |
| S09 | You can't change to the line you're already on |
| S10 | You can't ride to the station you're already at |
| S11 | The journey must end with `exit` |
| S12 | Nothing may come after `exit` |
| S13 | Both stations must be on the same Blue branch (otherwise ride to Yamuna Bank first) |
| S14 | Riding a different line needs a `change` first |
| S15 | `change` needs a line you are already riding |
| W01–W04 | Warnings: loop, double change, board and exit only, change right before exit |

## 6. Intermediate representation

Quadruples `(op, arg1, arg2, result)`:

| op | arg1 | arg2 | result |
|---|---|---|---|
| BOARD | station | – | – |
| RIDE | line | from | to |
| CHANGE | from-line | to-line | station |
| EXIT | station | – | – |

Each RIDE also carries `stops`, `towards` (direction) and `path` (the stations in between), all computed from the network graph.
