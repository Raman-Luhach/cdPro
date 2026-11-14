/* Example programs shown in the "Examples" menu */
(function (root) {
  'use strict';
  root.METRO_EXAMPLES = [
    // ---------------- valid journeys ----------------
    { group: 'Valid journeys', title: 'Project brief example', code:
'// The example from the project brief\nboard Rajiv Chowk;\nride Yellow to Hauz Khas;\nchange Magenta;\nride to Botanical Garden;\nexit' },
    { group: 'Valid journeys', title: 'To the airport (Terminal 1)', code:
'// Kashmere Gate ISBT to IGI Airport Terminal 1\nboard Kashmere Gate;\nride Yellow to Hauz Khas;\nchange Magenta;\nride to Terminal 1-IGI Airport;\nexit;' },
    { group: 'Valid journeys', title: 'North Delhi to Gurugram (one line)', code:
'# Straight down the Yellow line\nboard Samaypur Badli;\nride Yellow to Millennium City Centre;\nexit;' },
    { group: 'Valid journeys', title: 'Across the city on 4 lines', code:
'// Dwarka -> Ghaziabad using Blue, Violet, Pink and Red\nboard Dwarka Sector 21;\nride Blue to Mandi House;\nchange Violet;\nride to Lajpat Nagar;\nchange Pink;\nride to Welcome;\nchange Red;\nride to Shaheed Sthal;\nexit;' },
    { group: 'Valid journeys', title: 'Blue line branch to Vaishali', code:
'// Noida and Vaishali are on different Blue branches,\n// so we ride to Yamuna Bank first and take the Vaishali train\nboard Noida City Centre;\nride Blue to Yamuna Bank;\nride to Vaishali;\nexit;' },
    { group: 'Valid journeys', title: 'Faridabad to Rohini', code:
'board Raja Nahar Singh;\nride Violet to Kashmere Gate;\nchange Red;\nride to Rithala;\nexit;' },
    { group: 'Valid journeys', title: 'Pink line ring road ride', code:
'/* Pink line runs around the city:\n   Majlis Park -> Lajpat Nagar -> Welcome */\nboard Majlis Park;\nride Pink to Lajpat Nagar;\nride to "Sarai Kale Khan - Nizamuddin";\nride to Welcome;\nexit;' },
    { group: 'Valid journeys', title: 'Short names & quoted names', code:
'// Aliases like INA, Red Fort, Pitampura are understood\nboard INA;\nride Yellow to Kashmere Gate;\nchange Violet;\nride to "Red Fort";\nexit;' },
    { group: 'Optimizer demos', title: 'Optimizer: merge, detour, dead change', code:
'// Every optimization rule fires here\nboard Kashmere Gate;\nride Yellow to Chandni Chowk;     // O1 merge ...\nride to Rajiv Chowk;              // ... with this\nride to New Delhi;                // O2 back-and-forth\nride to Central Secretariat;\nchange Violet;                    // O3 these two\nchange Yellow;                    //    cancel out\nchange Violet;\nride to Lajpat Nagar;\nchange Pink;                      // O4 dead change\nexit;' },
    { group: 'Optimizer demos', title: 'Optimizer: round trip removed', code:
'board Hauz Khas;\nride Magenta to Kalkaji Mandir;\nride to Hauz Khas;      // came straight back\nride to IIT;\nexit;' },
    { group: 'Optimizer demos', title: 'Route advisor: slow route', code:
'// A long way round — the optimizer suggests a faster route\nboard Rajiv Chowk;\nride Blue to Janakpuri West;\nchange Magenta;\nride to Botanical Garden;\nexit;' },
    // ---------------- lexical errors ----------------
    { group: 'Lexical errors', title: 'Illegal characters', code:
'board Rajiv Chowk @;\nride Yellow to Hauz Khas $;\nexit;' },
    { group: 'Lexical errors', title: 'Unterminated string', code:
'board "Rajiv Chowk;\nride Yellow to Hauz Khas;\nexit;' },
    // ---------------- syntax errors ----------------
    { group: 'Syntax errors', title: 'Missing semicolon', code:
'board Rajiv Chowk\nride Yellow to Hauz Khas;\nexit;' },
    { group: 'Syntax errors', title: 'Missing "to"', code:
'board Rajiv Chowk;\nride Yellow Hauz Khas;\nexit;' },
    { group: 'Syntax errors', title: 'Misspelt keyword & line', code:
'bord Rajiv Chowk;\nride Yelow to Hauz Khas;\nchange;\nexit;' },
    // ---------------- semantic errors ----------------
    { group: 'Semantic errors', title: 'Unknown station (did you mean?)', code:
'board Rajiv Chok;\nride Yellow to Hauz Kas;\nexit;' },
    { group: 'Semantic errors', title: 'Change at a non-interchange', code:
'board Rajiv Chowk;\nride Yellow to Green Park;\nchange Magenta;      // Green Park is not an interchange\nride to Botanical Garden;\nexit;' },
    { group: 'Semantic errors', title: 'Line does not stop here', code:
'board Rajiv Chowk;\nride Yellow to Kashmere Gate;\nchange Blue;     // Kashmere Gate has Red and Violet, not Blue\nexit;' },
    { group: 'Semantic errors', title: 'Station not on this line', code:
'board Rajiv Chowk;\nride Yellow to Botanical Garden;\nexit;' },
    { group: 'Semantic errors', title: 'Riding another line without change', code:
'board Rajiv Chowk;\nride Yellow to Hauz Khas;\nride Magenta to Botanical Garden;\nexit;' },
    { group: 'Semantic errors', title: 'Blue branch — no direct train', code:
'board Noida Sector 18;\nride Blue to Vaishali;\nexit;' },
    { group: 'Semantic errors', title: 'Journey structure errors', code:
'ride Yellow to Hauz Khas;\nboard Rajiv Chowk;\nboard Mandi House;\nexit;\nride Yellow to Saket;' },
    { group: 'Semantic errors', title: 'Missing exit', code:
'board Rajiv Chowk;\nride Blue to Mandi House;' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
