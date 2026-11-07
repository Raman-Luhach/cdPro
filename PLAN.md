# Delhi Metro Journey Compiler: Project Plan

**Product name:** MetroLang, a compiler for Delhi Metro journeys
**Track:** AI Product Engineering (JavaScript web app)
**Team:** 5 members (names to be added)
**Rule:** Keep it simple, make it correct, make it look great.

---

## 1. What we are building (in one line)

The user writes a journey like this:

```
board Rajiv Chowk;
ride Yellow to Hauz Khas;
change Magenta;
ride to Botanical Garden;
exit;
```

The compiler checks it phase by phase and shows every phase on screen:
**Tokens → Parse Tree/AST → Symbol Table → Semantic Check → IR → Optimized IR → Journey Card + Animated Map.**

---

## 2. How we cover every marking point

| Rubric point | How we cover it |
|---|---|
| Complexity and relevance | A real-world language over a real metro graph: about 180 stations, 5 lines, real interchanges |
| Correct output / generated code | Readable IR, optimized IR, and two targets: a **journey card** and a **JSON e-ticket** |
| Edge cases (lexical, syntax, semantic) | 20+ error cases with line and column, red underline, and "Did you mean …?" suggestions |
| Phase-by-phase visualization | One tab per phase, an interactive AST tree, highlighting between tokens and code |
| Report | IEEE template, done later (outline in section 13) |
| Viva: pipeline phases | Each phase is a separate file with a one-line explanation (section 14) |
| Viva: end-to-end workflow | A "Pipeline" diagram in the UI, plus a step-through mode |
| Viva: individual contribution | One module per member (section 11) |
| GitHub standards | README, AI_WORKFLOW.md, tests, opens by double-clicking `index.html`, GitHub Pages link |

---

## 3. Metro data (fetched from the web, then verified)

**Lines (6, as built):** Yellow, Blue (main line plus Vaishali branch), Violet, Magenta, Red, Pink. That gives 203 stations and 17 interchanges.

**Sources:** Wikipedia's page for each line (station order, interchanges), plus approximate coordinates from Wikipedia/OpenStreetMap for drawing the map.

**What we store for each station:** `name`, `lines[]`, `x, y` (map position), and `aliases` (for example "Rajiv Chowk" and "Rajiv Chowk Metro").

**What we store for each line:** `name`, `colour`, and the ordered list of stations.

**Interchanges** are computed automatically: any station on 2 or more lines. Examples:

| Interchange | Lines |
|---|---|
| Rajiv Chowk | Yellow, Blue |
| Kashmere Gate | Yellow, Red, Violet |
| Mandi House | Blue, Violet |
| Central Secretariat | Yellow, Violet |
| Hauz Khas | Yellow, Magenta |
| Botanical Garden | Blue, Magenta |
| Kalkaji Mandir | Violet, Magenta |
| Janakpuri West | Blue, Magenta |

**Estimated time (kept simple and clearly labelled as an estimate):**
- About 2 minutes 15 seconds per station hop
- Plus 5 minutes per interchange walk
- Plus 3 minutes for entry and exit

**Fare:** an estimate from DMRC distance slabs, based on the number of stops.

The data lives in `data/metro-data.js`. We use a JS file instead of JSON so the app works even when you just double-click the HTML file.

---

## 4. The language (MetroLang)

### 4.1 Tokens (lexical analysis)

| Token type | Examples |
|---|---|
| KEYWORD | `board`, `ride`, `to`, `change`, `exit` (case-insensitive) |
| LINE | `Yellow`, `Blue`, `Violet`, `Magenta`, `Red` |
| WORD | `Rajiv`, `Chowk`, `Phase-1`, `21` (parts of station names) |
| SEMICOLON | `;` |
| COMMENT | `# anything` (skipped, but shown in the token table) |
| EOF | end of input |

Each token records its **type, value, line and column**.

**Lexical errors:** illegal characters (`@`, `$`, `!`), a bad number format, an unterminated quoted name.

### 4.2 Grammar (BNF), small and clean

```
program     → statement* EOF
statement   → board | ride | change | exit
board       → "board" station ";"
ride        → "ride" LINE? "to" station ";"
change      → "change" LINE ";"
exit        → "exit" ";"
station     → WORD+          (multi-word names like "Mayur Vihar Phase-1")
```

**Parser:** recursive descent, with one function per rule.
**Error recovery:** panic mode. When the parser hits an error, it skips ahead to the next `;` and keeps going, so it can report several errors at once.

**Syntax errors:** missing `;`, missing `to`, `ride` without a station, `change` without a line, a statement that starts with an unknown word, or text after `exit`.

### 4.3 AST nodes

`Program`, `Board(station)`, `Ride(line?, station)`, `Change(line)`, `Exit`. Each node keeps its source position so errors can point to the right place.

---

## 5. Semantic analysis (where the marks are)

The semantic phase walks the AST and keeps track of the **current station** and **current line**.

| # | Rule | Example of a violation |
|---|---|---|
| S1 | Station must exist (with a "Did you mean?" suggestion) | `board Rajiv Chok` → *Did you mean "Rajiv Chowk"?* |
| S2 | Journey must start with `board` | `ride Yellow to Hauz Khas` as the first line |
| S3 | Only one `board` | Boarding twice |
| S4 | The first `ride` must name a line | `ride to Hauz Khas` before any line is chosen |
| S5 | The boarding station must be on the line being ridden | Board at Rajiv Chowk, `ride Magenta …` |
| S6 | The destination must be on the current line | `ride Yellow to Botanical Garden` |
| S7 | `change` is only allowed at a real interchange | `change Blue` at Hauz Khas |
| S8 | The new line must serve this interchange | `change Red` at Rajiv Chowk |
| S9 | You can't change to the line you're already on | `change Yellow` while on Yellow |
| S10 | You can't ride to the station you're already at | `ride Yellow to Rajiv Chowk` at Rajiv Chowk |
| S11 | The journey must end with `exit` | Missing `exit` |
| S12 | Nothing may come after `exit` | `exit; ride …` |
| S13 | A branch must be reachable (Blue main line vs Vaishali branch) | Riding Blue from Dwarka to Vaishali without changing at Yamuna Bank |
| W1 | **Warning:** a loop back to a station already visited | A → B → A |
| W2 | **Warning:** `change` with no ride after it | `change Magenta; change Yellow;` |

Errors stop code generation. Warnings don't.

### Symbol table (shown as a tab)
1. **Global table:** every station and line used in the program, with its type, the lines it's on, and whether it's an interchange.
2. **Journey state table:** step number, current station, current line, and stops so far.

---

## 6. Intermediate representation (IR)

This is a simple three-address-style instruction list:

```
1: BOARD    "Rajiv Chowk"
2: RIDE     Yellow, "Rajiv Chowk" -> "Hauz Khas", stops=8, dir="Samaypur Badli → Millennium City Centre"
3: CHANGE   Yellow -> Magenta @ "Hauz Khas"
4: RIDE     Magenta, "Hauz Khas" -> "Botanical Garden", stops=11
5: EXIT     "Botanical Garden"
```

The IR resolves things the source code leaves out: the **direction of travel**, the **number of stops** and the **list of intermediate stations**.

---

## 7. Optimization (easy to explain, all real)

| # | Optimization | Before → after |
|---|---|---|
| O1 | Merge consecutive rides on the same line | `ride Yellow to A; ride to B` → `RIDE Yellow → B` |
| O2 | Collapse redundant changes | `change Magenta; change Blue` (no ride between) → `CHANGE Blue` |
| O3 | Remove back-and-forth rides | `ride to A; ride to B; ride back to A` (same line) → one ride, or none |
| O4 | Remove a dead change (changing lines and then exiting without riding) | `change X; exit` → `exit` |
| O5 | **Route suggestion:** BFS/Dijkstra finds a faster route and shows "Your route: 42 min, best route: 31 min" | Shown as a suggestion; the user's route is kept |

The UI shows the IR **before and after side by side**, with each change highlighted and labelled with the rule that caused it.

---

## 8. Code generation (targets)

1. **Journey card** (the main output). It shows the start and end stations, each leg as a coloured line segment, every intermediate station, interchanges marked with an icon, total stops, estimated time and estimated fare.
2. **Animated metro map.** An SVG of the 5 lines, with a train dot that moves along the route and other lines faded out.
3. **JSON e-ticket.** Machine-readable target code that can be downloaded.
4. **Plain-English instructions.** For example: "Board at Rajiv Chowk. Take the Yellow Line towards Millennium City Centre for 8 stops…"

---

## 9. UI design

**Layout (desktop):**
```
┌──────────────────────────────────────────────────────────────┐
│  🚇 MetroLang  — Delhi Metro Journey Compiler   [Examples ▾] │
├────────────────────────┬─────────────────────────────────────┤
│  Code editor           │  Tabs: Tokens | Parse Tree | Symbol │
│  (line numbers,        │  Table | Semantic | IR | Optimized  │
│   syntax colours,      │  IR | Output                         │
│   red error squiggles) │                                      │
│                        │  [ phase content here ]              │
│  [▶ Compile] [Step ⏭]  │                                      │
├────────────────────────┴─────────────────────────────────────┤
│  Pipeline bar: Lexer ✔ → Parser ✔ → Semantic ✖ → IR → Opt → Gen │
│  Console: errors / warnings with line:col (click to jump)    │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Line colours match Delhi Metro's colours, the design is clean and modern, and there's a light/dark mode.
- The pipeline bar shows each phase as ✔, ✖ or skipped. Clicking a phase opens its tab.
- **Step mode** runs one phase at a time, which is good for the viva.
- An **Examples dropdown** includes 6 valid journeys and 10 error demos (lexical, syntax and semantic).
- Clicking a token highlights it in the code. Clicking an AST node highlights its source.
- Station autocomplete appears in the editor.
- The layout is responsive and works on a phone.

**Tech (no install, no build):** plain HTML, CSS and JavaScript. The editor is a textarea with a highlighted overlay; we may load CodeMirror from a CDN if it looks better. The AST tree and map are hand-made SVG.

---

## 10. File structure

```
cdPro/
├── index.html              ← opens directly in the browser
├── css/style.css
├── data/metro-data.js      ← stations, lines, coordinates
├── src/
│   ├── lexer.js            ← Phase 1
│   ├── parser.js           ← Phase 2 (AST)
│   ├── semantic.js         ← Phase 3 (+ symbol table)
│   ├── irgen.js            ← Phase 4
│   ├── optimizer.js        ← Phase 5
│   ├── codegen.js          ← Phase 6 (card, JSON, instructions)
│   ├── graph.js            ← BFS/Dijkstra helpers
│   └── compiler.js         ← runs the pipeline
├── ui/
│   ├── app.js              ← editor, tabs, pipeline bar
│   ├── treeView.js         ← AST drawing
│   └── mapView.js          ← metro map + train animation
├── examples/examples.js
├── tests/run-tests.js      ← `node tests/run-tests.js`
├── README.md
├── AI_WORKFLOW.md          ← how AI agents were used (required for the AI track)
└── docs/
    ├── grammar.md
    ├── viva-notes.md
    └── screenshots/
```

---

## 11. Team split (one module per member)

| Member | Module | Explains in the viva |
|---|---|---|
| M1 (Lead) | Lexer + `compiler.js` pipeline + integration | Tokens, regex, lexical errors, how the phases connect |
| M2 | Parser + AST + grammar + error recovery | CFG, recursive descent, panic mode |
| M3 | Semantic analysis + symbol table + metro data | Rules S1–S13, "Did you mean" (edit distance) |
| M4 | IR generation + optimizer + graph (BFS) | IR design, O1–O5, shortest path |
| M5 | Code generation + UI + map/tree visualization | Journey card, SVG animation, UI flow |

---

## 12. Testing (proof that the output is correct)

- **Valid journeys (6+):** the example from the brief, a 2-change journey, a Blue branch journey, a long cross-city trip, a single-line trip, and a trip that triggers an optimization.
- **Lexical errors (3):** `@`, `$`, an unterminated quote.
- **Syntax errors (5):** missing `;`, missing `to`, an empty `change`, an unknown statement, an empty program.
- **Semantic errors (S1–S13), one test each,** plus warnings W1 and W2.
- **Data checks:** every interchange is on 2 or more lines, every line's station list is connected, and there are no duplicate station names.
- **Command:** `node tests/run-tests.js` prints a pass/fail table. We'll also add a "Run tests" button in the UI.

---

## 13. Report (IEEE, done later)

1. Abstract
2. Introduction (problem, motivation)
3. Language design (tokens, grammar)
4. Methodology and architecture (pipeline diagram)
5. Implementation of each phase (lexer → codegen)
6. Error handling (tables of lexical, syntax and semantic errors)
7. Optimization
8. Results (screenshots, test table)
9. Individual member contribution
10. Use of Generative AI (from AI_WORKFLOW.md)
11. Conclusion and future scope (all lines, live fares from an API, voice input, Hindi keywords, multi-target output such as a PDF ticket or QR code, shortest-route mode)
12. References

---

## 14. Viva notes (one line per phase)

- **Lexer:** "It turns the text into tokens: keywords, line names, words and semicolons, each with a line and column."
- **Parser:** "Recursive descent checks the order of tokens against our grammar and builds an AST. Panic-mode recovery skips to the next `;`."
- **Semantic:** "It walks the AST with the current station and line, and checks the real metro rules against the symbol table."
- **IR:** "It converts the AST into simple instructions and fills in the direction, number of stops and stations in between."
- **Optimizer:** "It merges or removes redundant instructions without changing where you end up, and BFS suggests a faster route."
- **Codegen:** "It turns the optimized IR into the journey card, the map animation and a JSON ticket."

Full Q&A goes in `docs/viva-notes.md`.

---

## 15. Build order

1. **Data:** fetch the 5 lines from the web, build `metro-data.js`, verify it with the data checks.
2. **Lexer, then parser, then semantic,** each with its tests.
3. **IR, optimizer and graph,** with tests.
4. **Codegen** (card, JSON, instructions).
5. **UI:** layout, editor, tabs, pipeline bar, AST tree, map animation, examples, dark mode.
6. **Polish:** error messages, "Did you mean", responsiveness, screenshots.
7. **Docs:** README, AI_WORKFLOW.md, grammar.md, viva-notes.md.
8. **Final check** against the rubric in section 2, then push **only when you say so** and enable GitHub Pages.
9. **Report:** later, when you ask.
