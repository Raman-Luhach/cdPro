# AI Workflow: How MetroLang Was Built

This project follows the **AI Product Engineering Track**: Generative AI agents were used, step by step, to put together a complete compiler application. This document records how. The team reviewed, tested and understood every part.

## Tools used

| Tool | Used for |
|---|---|
| **Claude Code** (AI coding agent, Claude Opus model) | Planning, data research, writing code, testing, visual checks |
| Web fetch (through the agent) | Reading station lists from Wikipedia |
| Node.js | Running the automated test suite |
| Headless Google Chrome | Screenshotting the UI so the agent could check its own visual output |

## The process

### 1. Choosing the project
We gave the agent the course rubric and the list of topics. It compared the options on ease, uniqueness, how well each one maps to the compiler phases, and how easy it would be to explain in the viva. Turtle Graphics looked too common and Chess too hard. **Delhi Metro Journey** was chosen because its semantic checks (interchanges, lines, branches) are rich and its output (a journey card plus a map) is visual.

### 2. Planning
The agent wrote [PLAN.md](PLAN.md). It maps every rubric point to a feature and covers the language design, grammar, semantic rules, IR format, optimizations, UI layout, a five-way team split, tests and the report outline.

### 3. Collecting the data
The agent fetched the Wikipedia article for each line (Yellow, Blue, Violet, Magenta, Red, Pink) and pulled out the ordered station lists and interchanges. Recent changes were checked as well: the Magenta extension to Krishna Park Extension (Jan 2025) and the Pink Line ring completion (Mar 2026). The result is [data/metro-data.js](data/metro-data.js). Automated **data-integrity checks** confirm that every interchange is on 2 or more lines, every alias points to a real station, there are no duplicates, and the network is connected.

### 4. Building the compiler, one phase at a time
Each phase was written as its own file with a clear input and output: lexer, parser, semantic analysis, IR generation, optimizer and code generation. After each step, a Node smoke test ran real programs through the pipeline and the output was checked.

### 5. Testing and fixing
The test suite ([tests/cases.js](tests/cases.js)) found real bugs, which were fixed:

| Bug found | Fix |
|---|---|
| The brief's own example ends with `exit` and no `;`, which caused a syntax error | The `;` before end of input is now optional |
| `ride to Red Fort` failed because `Red` was tokenised as a line name | The parser accepts line words inside station names |
| An unknown boarding station caused extra "ride before board" errors | The analyser remembers the passenger boarded, so errors don't cascade |
| The time estimate was too slow | Average speed tuned to 36 km/h to match real line timings |

### 6. Checking the UI visually
The agent took headless-Chrome screenshots of every tab, in light and dark mode and at phone width, and inspected them. Problems found this way:

| Problem | Fix |
|---|---|
| The map didn't zoom to the journey when the page loaded | Fit immediately, and again whenever the map's size changes |
| Station labels overlapped when zoomed in | Labels keep a constant on-screen size, with greedy collision avoidance |
| The train paused one station *before* the interchange | Rewrote the animation timeline so the pause happens *at* the interchange |
| The page stalled when offline (blocking font request) | Fonts load without blocking, with system fonts as the fallback |
| Rule chips "O1" looked like "01" | Switched those labels to a sans-serif font |
| Digits inside the JSON timestamp were coloured as numbers | The JSON highlighter now works line by line |

### 7. Cinematic 3D view
After the 2D version was finished, the agent researched options for a 3D view and recommended Three.js. It saved r147 (the last release with browser-script builds) into `vendor/three/`, so the view works offline and from `file://`. It then built `ui/map3d.js` with elevated tube lines, platforms on pillars, a 3-coach train and a camera director. Headless Chrome stalls animation loops, so the agent checked the 3D output by forcing frames and copying the canvas image out. That surfaced these problems:

| Problem | Fix |
|---|---|
| The light-mode scene was washed out to white | The bloom threshold was below the background brightness; light mode now renders without bloom, dark mode keeps it |
| Thin lines were invisible from the overview camera | Thicker tubes and darker daylight ground colours |
| Coaches drifted apart on sharp curves | Coaches are now spaced by true distance along the rail |
| Labels piled up on long journeys | 3D labels show only the start, the end, the interchanges and the current station |

### 8. Documentation
README, grammar reference, viva notes and this workflow log.

## How we checked the AI's output
- **81 automated tests** pass (`node tests/run-tests.js`).
- Stop counts were checked by hand against the Wikipedia station order. For example, Rajiv Chowk → Hauz Khas is 9 stops on the Yellow Line.
- Every example program in the menu is tested to behave as its group says (valid programs compile, error demos fail).
- The team reviewed the code module by module.

## Prompts log (summary)
1. "Here are the rubric and topics. Which project gets full marks while being easy to explain?" → topic comparison
2. "Plan the Delhi Metro project: 5–6 lines, animation, great UI, full marks." → PLAN.md
3. Build phase by phase, with tests after each phase → `src/`, `tests/`
4. Visual review through screenshots, then fixes → `ui/`, `css/`
5. Documentation → README.md, docs/

_Team members: add any further prompts you used here._
