# Viva Notes: MetroLang

Short, simple answers. Practise saying them out loud while showing the matching tab in the app.

## Part A: Core compiler phases (2 marks)

**Q. What are the phases of a compiler?**
Lexical analysis → syntax analysis → semantic analysis → intermediate code generation → code optimization → code generation. The symbol table and error handler are used by all phases.

**Q. What does the lexer do? (Tokens tab)**
It reads characters and groups them into tokens using regular expressions, for example `board` → KEYWORD and `Yellow` → LINE. It skips whitespace, records the line and column of each token, and reports illegal characters such as `@`.

**Q. Token, lexeme and pattern?**
The token is the category (KEYWORD). The lexeme is the actual text (`board`). The pattern is the rule that matches it (the regex).

**Q. What does the parser do? (Parse Tree tab)**
It checks that the tokens follow the grammar and builds a tree. Ours is a **recursive-descent** parser: one function per grammar rule.

**Q. Parse tree vs AST? (Parse Tree and AST tabs)**
The parse tree contains everything, including keywords and `;`. The AST keeps only the meaning: `Ride(line = Yellow, station = Hauz Khas)`.

**Q. Why is your grammar LL(1)?**
Every statement starts with a different keyword (board, ride, change, exit), so one token of lookahead is enough to choose the rule.

**Q. How do you recover from syntax errors?**
Phrase level: a missing `;` or `to` is assumed present. Panic mode: skip to the next `;`. That way we report several errors at once instead of stopping at the first.

**Q. What is semantic analysis? (Semantic tab)**
It checks meaning, not form. `change Blue;` at Hauz Khas is syntactically fine, but Blue doesn't stop at Hauz Khas, so it's a semantic error.

**Q. What is the symbol table? (Symbol Table tab)**
A data structure that stores information about identifiers. Ours is pre-loaded with the metro network (station → lines, interchange or not) and also records where each name is used.

**Q. What is intermediate code? Why use it? (IR tab)**
It's a simple, machine-independent form between the source and the target. We use quadruples `(op, arg1, arg2, result)`. It makes optimization and code generation easier.

**Q. What is optimization? (Optimizer tab)**
Improving the IR without changing its meaning. We use **peephole optimization**: look at two neighbouring instructions and simplify them, repeating until nothing changes (a fixed point).

**Q. What is code generation? (Output and Target Code tabs)**
Producing the final target from the optimized IR. Our targets are the journey card, the animated map, the directions and a JSON e-ticket.

## Part B: Our project end to end (2 marks)

**Q. Explain your project in one line.**
MetroLang is a small language for Delhi Metro journeys. Our compiler checks a journey against the real network and turns it into a journey card with an animated map.

**Q. Walk through `board Rajiv Chowk; ride Yellow to Hauz Khas; change Magenta; ride to Botanical Garden; exit`.**
1. Lexer: 20 tokens (KEYWORD board, WORD Rajiv, WORD Chowk, SEMICOLON, …).
2. Parser: a `<program>` with 5 statements, and the AST Board → Ride → Change → Ride → Exit.
3. Semantic: Rajiv Chowk exists, Yellow stops there, Hauz Khas is on Yellow, Hauz Khas is a Yellow/Magenta interchange, Botanical Garden is on Magenta. All passed.
4. IR: `BOARD`, `RIDE Yellow Rajiv Chowk → Hauz Khas (9 stops)`, `CHANGE Yellow → Magenta @ Hauz Khas`, `RIDE Magenta … (13 stops)`, `EXIT`.
5. Optimizer: nothing redundant, but O5 notices the Blue Line goes there directly and suggests it.
6. Codegen: 22 stops, 1 change, about 63 minutes, ₹64, plus the train animation.

**Q. Where does the data come from?**
The Wikipedia article for each line: 6 lines, 203 stations, 17 interchanges, stored in `data/metro-data.js`.

**Q. Give 3 semantic errors your compiler catches.**
- Changing line at a station that isn't an interchange (S07).
- Riding to a station that isn't on the current line (S06).
- Noida → Vaishali on the Blue Line without changing at Yamuna Bank (S13), because they're on different branches.

**Q. How does "Did you mean …?" work?**
It uses **Levenshtein edit distance** between what was typed and every known station name, and suggests the closest ones.

**Q. Explain one optimization.**
O1: `ride Yellow to Chandni Chowk; ride to Rajiv Chowk;` is two IR rides on the same line in the same direction, so they merge into one ride, Kashmere Gate → Rajiv Chowk. The start and end stay the same, with fewer instructions.

**Q. How is the faster route found?**
Dijkstra's shortest path over (station, line) states. Each hop costs its travel time and each line change costs 5 minutes.

**Q. How is time and fare estimated?**
Time = stops × average time per stop (36 km/h) + 5 min per change + 3 min to enter and exit. Fare uses DMRC distance slabs. Both are labelled as estimates.

**Q. How do you know the output is correct?**
81 automated tests (`node tests/run-tests.js`): stop counts and directions checked against the real station order, every error code, every optimization, and every example program.

**Q. What happens when there's an error?**
The phase that finds it turns red in the pipeline bar, the later phases are skipped, and the console shows the error code, the line:column and a hint. Clicking it jumps to the error in the code.

## Part C: Individual contribution (1 mark)

Each member should be able to:
1. Open their own file in `src/` or `ui/` and explain its main function.
2. Show their phase's tab in the app.
3. Demo one error or feature from their module using the Examples menu.

| Member | Phase / files | Be ready to demo |
|---|---|---|
| Raman (Lead) | Parser + Semantic (`src/parser.js`, `src/semantic.js`), `ui/app.js`, `ui/map3d.js` | *Syntax errors → Misspelt keyword & line*: Parse Tree, AST, recovery reporting 3 errors. *Semantic errors → Change at a non-interchange*: rule checklist and Symbol Table. The 3D view. |
| Ritesh | Lexer (`src/lexer.js`), `src/network.js`, `src/compiler.js` | *Lexical errors → Illegal characters*: Tokens tab and regex table. How Dijkstra finds the faster route. |
| Meghavi | Optimizer (`src/optimizer.js`), panels, 2D map | *Optimizer demos → merge, detour, dead change*: the before/after table and the O5 advisor. |
| Rachit | Code generation (`src/codegen.js`), styling | Any valid example: Output tab, journey card, Target Code, JSON e-ticket download. |
| Harshal | IR generation (`src/irgen.js`), metro data, tree view | IR tab: how each AST statement becomes a quadruple (`BOARD`, `RIDE`, `CHANGE`, `EXIT`). Where the 203 stations come from. |

**Everyone** must also know Part A (all 6 phases) and Part B (the full walkthrough). Those are 4 of the 5 marks.
