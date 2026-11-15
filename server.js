
const express = require('express');
const path = require('path');
const cors = require('cors');
// (vm not needed — using built-in Function parser for syntax checks)

// Node.js built-in SQLite engine
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// STEP 1: INITIALIZE SQL DATABASE & CREATE TABLES
// ============================================================
const db = new DatabaseSync(path.join(__dirname, 'database.sqlite'));

// Users Table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    );
`);

// Evaluations Table
db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_type TEXT NOT NULL,
        code_input TEXT NOT NULL,
        score INTEGER NOT NULL,
        time_complexity TEXT NOT NULL,
        space_complexity TEXT NOT NULL,
        errors TEXT NOT NULL,
        optimized_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

console.log('✔ SQLite Database connected and tables created successfully!');

// ============================================================
// STEP 2: USER AUTHENTICATION (SIGN UP & LOGIN)
// ============================================================

// Sign Up Route
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Please fill in all fields!' });
    }

    try {
        const checkUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (checkUser) {
            return res.status(400).json({ success: false, message: 'Email is already registered. Please Sign In!' });
        }

        const insertUser = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        const result = insertUser.run(name.trim(), email.toLowerCase().trim(), password);

        res.json({
            success: true,
            message: 'Account created successfully!',
            user: { id: Number(result.lastInsertRowid), name: name.trim(), email: email.toLowerCase().trim() }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
});

// Sign In Route
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Please enter both email and password!' });
    }

    try {
        const user = db.prepare('SELECT id, name, email, password FROM users WHERE email = ?').get(email.toLowerCase().trim());

        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid email or password. Please try again.' });
        }

        res.json({
            success: true,
            message: 'Welcome back! Signed in successfully.',
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// ============================================================
// STEP 3: HELPERS
// ============================================================

/**
 * Detects the programming language of the submitted code.
 * Returns: 'java' | 'python' | 'cpp' | 'javascript'
 */
function detectLanguage(code) {
    // Java signals: class keyword + public static void main, or Java types
    if (/\bpublic\s+(class|static|void)\b/.test(code)) return 'java';
    if (/\b(System\.out\.print|StringBuilder|ArrayList|HashMap|import\s+java)\b/.test(code)) return 'java';

    // Python signals
    if (/^\s*def\s+\w+\s*\(|^\s*import\s+\w+|print\s*\(/m.test(code)) return 'python';

    // C++ signals
    if (/#include\s*<|std::|cout\s*<<|cin\s*>>/.test(code)) return 'cpp';

    // Default: JavaScript
    return 'javascript';
}

/**
 * Tries to syntax-check JS code by parsing it.
 * Only call this for JavaScript — not for Java/Python/C++.
 * Returns { valid: true } or { valid: false, syntaxError: "message" }
 */
function checkSyntax(code) {
    try {
        new Function(code); // Parses JS without executing it
        return { valid: true };
    } catch (e) {
        return { valid: false, syntaxError: e.message };
    }
}

/**
 * Java-specific bug detection (pattern-based, no JS parser used).
 */
function detectJavaBugs(code) {
    const errors = [];
    let score = 100;
    let correctedCode = code;

    // 1. Off-by-one: i <= arr.length  (Java uses array.length too)
    if (/\b\w+\s*<=\s*[a-zA-Z0-9_]+\.length\b/.test(code)) {
        score -= 20;
        errors.push('Bug: Off-by-one error — "<= array.length" reads past the last index. Use "< array.length".');
        correctedCode = correctedCode.replace(/(<=\s*)([a-zA-Z0-9_]+\.length)/g, '< $2');
    }

    // 2. Assignment in if condition: if (x = 5)
    if (/if\s*\(\s*[a-zA-Z0-9_.]+\s*=[^=]/.test(code)) {
        score -= 15;
        errors.push('Bug: Assignment "=" used inside if-condition. Did you mean "==" (equality)?');
    }

    // 3. == used to compare Strings in Java (should use .equals())
    if (/"\s*==\s*"|==\s*"/.test(code) || /String.*==/.test(code)) {
        score -= 20;
        errors.push('Bug: In Java, use ".equals()" to compare Strings — "==" compares object references, not content. E.g., text.equals(reversed)');
    }

    // 4. Infinite loop: while(true) with no break/return
    if (/while\s*\(\s*true\s*\)/i.test(code) && !/\b(break|return)\b/i.test(code)) {
        score -= 30;
        errors.push('Critical Bug: "while(true)" with no break or return — infinite loop!');
    }

    // 5. Missing return type (void method that seems to compute a value)
    if (/public\s+void\s+\w+/.test(code) && /return\s+\w+/.test(code)) {
        errors.push('Warning: Method declared "void" but has a return statement with a value — change return type accordingly.');
        score -= 10;
    }

    // 6. StringBuilder reverse() — valid but O(n) space; suggest two-pointer
    if (/StringBuilder.*\.reverse\(\)|\.reverse\(\)/.test(code) &&
        /palindrome/i.test(code)) {
        errors.push('Suggestion: StringBuilder.reverse() uses O(n) extra space. A two-pointer approach checks in O(n) time with O(1) space.');
        score = Math.min(score, 85);
    }

    // 7. Console.log leftover (Java uses System.out.println — just a note)
    if (/System\.out\.print/.test(code)) {
        errors.push('Note: System.out.println() found — remove debug output before production.');
    }

    if (errors.length === 0) {
        errors.push('Great job! No bugs detected in your Java code.');
    }

    return { score: Math.max(25, Math.min(100, score)), errors, correctedCode, hasBugs: errors.some(e => e.startsWith('Bug') || e.startsWith('Critical')) };
}

/**
 * Python-specific bug detection.
 */
function detectPythonBugs(code) {
    const errors = [];
    let score = 100;

    if (/==[^=]/.test(code) && /if\s+\w+\s*=\s*[^=]/.test(code)) {
        errors.push('Bug: Assignment "=" in condition. Python uses "==" for comparison.');
        score -= 15;
    }
    if (/while\s+True:/i.test(code) && !/\b(break|return)\b/.test(code)) {
        errors.push('Critical Bug: "while True:" with no break or return — infinite loop!');
        score -= 30;
    }
    if (errors.length === 0) errors.push('Great job! No obvious bugs detected in your Python code.');
    return { score: Math.max(25, score), errors, correctedCode: code, hasBugs: errors.some(e => e.startsWith('Bug') || e.startsWith('Critical')) };
}

/**
 * Properly detect NESTED loops by checking if one loop body
 * contains another loop — not just counting keyword appearances.
 *
 * Returns: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)' | 'O(n³)'
 */
function detectTimeComplexity(code) {
    // Count nesting depth properly by tracking brace depth
    // when we encounter a loop keyword
    const loopPattern = /\b(for|while)\s*\(/g;
    let maxNestingDepth = 0;
    let currentLoopDepth = 0;
    let braceDepth = 0;
    // Stack: each entry is the brace depth at which a loop started
    const loopStack = [];

    // Tokenise character by character
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];

        // Skip strings
        if (ch === '"' || ch === "'" || ch === '`') {
            const quote = ch;
            i++;
            while (i < code.length && code[i] !== quote) {
                if (code[i] === '\\') i++; // skip escaped char
                i++;
            }
            continue;
        }

        // Skip single-line comments
        if (ch === '/' && code[i + 1] === '/') {
            while (i < code.length && code[i] !== '\n') i++;
            continue;
        }

        // Skip multi-line comments
        if (ch === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i++;
            continue;
        }

        if (ch === '{') {
            braceDepth++;
        } else if (ch === '}') {
            braceDepth--;
            // Pop any loops that ended at this brace depth
            while (loopStack.length > 0 && loopStack[loopStack.length - 1] >= braceDepth) {
                loopStack.pop();
                currentLoopDepth--;
            }
        }

        // Detect loop keyword: for( or while(
        const remaining = code.slice(i);
        const loopMatch = remaining.match(/^(for|while)\s*\(/);
        if (loopMatch) {
            // Make sure it's not inside a string (we already skipped those)
            // Check it's not "if" or a function name by ensuring previous char isn't a letter
            const prevChar = i > 0 ? code[i - 1] : ' ';
            if (!/[a-zA-Z0-9_$]/.test(prevChar)) {
                currentLoopDepth++;
                loopStack.push(braceDepth);
                if (currentLoopDepth > maxNestingDepth) {
                    maxNestingDepth = currentLoopDepth;
                }
                i += loopMatch[0].length - 1;
            }
        }
    }

    // Check for recursion (function calls itself)
    const funcNameMatch = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    const isRecursive = funcNameMatch
        ? new RegExp('\\b' + funcNameMatch[1] + '\\s*\\(').test(code.replace(new RegExp(`function\\s+${funcNameMatch[1]}\\s*\\(`), ''))
        : false;

    // Check for binary search / divide-and-conquer patterns
    // A real binary search: has a loop AND divides search space by 2 (mid = floor(.../ 2))
    const hasMidCalc   = /Math\.floor\s*\(.*\/\s*2\s*\)/.test(code);
    const hasMidVar    = /\bmid\b/.test(code);
    const hasPivot     = /\bpivot\b/i.test(code);
    const hasBinarySearch = (hasMidCalc && hasMidVar) || hasPivot;
    const hasSort = /\.sort\s*\(/.test(code);

    // --- O(n³): triple-nested loops
    if (maxNestingDepth >= 3) return 'O(n³)';

    // --- O(n²): two nested loops (no binary search involvement)
    if (maxNestingDepth === 2 && !hasBinarySearch) return 'O(n²)';

    // --- O(n log n): outer loop AROUND a binary search (depth 2 + binary search)
    //                 or a plain .sort() with no extra loops
    if (maxNestingDepth === 2 && hasBinarySearch) return 'O(n log n)';
    if (hasSort && maxNestingDepth <= 1) return 'O(n log n)';

    // --- O(log n): the single loop IS the binary search (depth 1 + binary search pattern)
    //              or a recursive divide-and-conquer with no linear scan
    if (hasBinarySearch && maxNestingDepth <= 1) return 'O(log n)';

    // --- O(n): one loop, or simple recursion
    if (maxNestingDepth === 1 || isRecursive) return 'O(n)';

    // --- O(1): no loops, no recursion
    return 'O(1)';
}

/**
 * Detect space complexity based on data-structure usage patterns.
 */
function detectSpaceComplexity(code) {
    if (/new\s+(Array|Map|Set|Object)\s*\(|=\s*\[\s*\]/i.test(code)) return 'O(n)';
    if (/\.push\s*\(|\.unshift\s*\(/i.test(code)) return 'O(n)';
    return 'O(1)';
}

/**
 * Comprehensive bug detection: syntax check + pattern-based logic analysis.
 */
function detectBugs(code) {
    const errors = [];
    let score = 100;
    let correctedCode = code;

    // ── 1. SYNTAX CHECK via JS parser ──────────────────────────────────────
    const syntaxResult = checkSyntax(code);
    if (!syntaxResult.valid) {
        errors.push(`Syntax Error: ${syntaxResult.syntaxError}`);
        score -= 40;
        return { score, errors, correctedCode: code, hasBugs: true };
    }

    // ── 2. OFF-BY-ONE: i <= arr.length ─────────────────────────────────────
    if (/\b\w+\s*<=\s*[a-zA-Z0-9_]+\.length\b/.test(code)) {
        score -= 20;
        errors.push('Bug: Off-by-one error — "<= array.length" accesses an undefined index. Fix: use "< array.length".');
        correctedCode = correctedCode.replace(/(<=\s*)([a-zA-Z0-9_]+\.length)/g, '< $2');
    }

    // ── 3. ASSIGNMENT IN IF CONDITION: if (x = 5) ──────────────────────────
    if (/if\s*\(\s*[a-zA-Z0-9_.]+\s*=[^=]/.test(code)) {
        score -= 15;
        errors.push('Bug: Single "=" (assignment) used inside if-condition. Did you mean "===" (strict equality)?');
        correctedCode = correctedCode.replace(/(if\s*\(\s*[a-zA-Z0-9_.]+)\s*=([^=])/g, '$1 === $2');
    }

    // ── 4. INFINITE LOOP: while(true) with no break/return ─────────────────
    if (/while\s*\(\s*true\s*\)/i.test(code) && !/\b(break|return)\b/i.test(code)) {
        score -= 30;
        errors.push('Critical Bug: "while(true)" detected with no break or return — infinite loop!');
        correctedCode = correctedCode.replace(/while\s*\(\s*true\s*\)/g, 'while (/* add exit condition */ false)');
    }

    // ── 5. WRONG RETURN: return x = value ──────────────────────────────────
    if (/\breturn\s+[a-zA-Z0-9_]+\s*=[^=>]/.test(code)) {
        score -= 10;
        errors.push('Bug: "return x = value" assigns a value instead of comparing. Did you mean "return x === value"?');
    }

    // ── 6. LOOSE EQUALITY: == instead of === ───────────────────────────────
    // Ignore ==, !==, <=, >= by requiring a non-operator char before the ==
    const looseEq = [...code.matchAll(/(?<![=!<>])={2}(?!=)/g)];
    if (looseEq.length > 0) {
        score -= 5;
        errors.push('Warning: Loose equality "==" found. Prefer strict "===" to avoid type coercion bugs (e.g., 0 == false → true).');
    }

    // ── 7. MISSING RETURN in non-void function ─────────────────────────────
    const allFunctions = [...code.matchAll(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{([\s\S]*?)\}(?=\s*[\n;]|\s*$)/g)];
    for (const fn of allFunctions) {
        const fnName = fn[1];
        const fnBody = fn[2];
        const isVoid = /^(print|log|display|show|render|draw|set|init|update|handle|run)/i.test(fnName);
        if (!isVoid && fnBody.trim().length > 5 && !/\breturn\b/.test(fnBody)) {
            errors.push(`Warning: Function "${fnName}" has no return statement — if it should produce a value, add a return.`);
            score -= 8;
        }
    }

    // ── 8. UNDECLARED VARIABLE USAGE ───────────────────────────────────────
    const declared = new Set(['undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
        'console', 'Math', 'Array', 'Object', 'String', 'Number', 'Boolean',
        'parseInt', 'parseFloat', 'isNaN', 'JSON', 'Date', 'Promise',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'require', 'module', 'exports', 'process', '__dirname', '__filename']);

    // Collect all declared identifiers
    const declPattern = /\b(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let m;
    while ((m = declPattern.exec(code)) !== null) declared.add(m[2]);

    // Function names and params
    const fnPattern = /function\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*\(([^)]*)\)/g;
    while ((m = fnPattern.exec(code)) !== null) {
        if (m[1]) declared.add(m[1]);
        m[2].split(',').forEach(p => {
            const name = p.trim().split(/[\s=]/)[0];
            if (name && /^[a-zA-Z_$]/.test(name)) declared.add(name);
        });
    }

    // Arrow function params: (a, b) => or a =>
    const arrowPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g;
    while ((m = arrowPattern.exec(code)) !== null) declared.add(m[1]);

    // For-loop variables: for (let i ... or for (var i ...
    const forPattern = /for\s*\(\s*(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    while ((m = forPattern.exec(code)) !== null) declared.add(m[1]);

    // Find all used identifiers and flag truly undeclared ones
    const usedPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const keywords = new Set(['if','else','for','while','do','return','function','var','let',
        'const','new','typeof','instanceof','in','of','break','continue','switch',
        'case','default','try','catch','finally','throw','class','extends','this',
        'super','import','export','async','await','yield','delete','void','static']);
    const undeclared = new Set();
    while ((m = usedPattern.exec(code)) !== null) {
        const name = m[1];
        if (!keywords.has(name) && !declared.has(name) && isNaN(name)) {
            // Check it's being used as a standalone expression (not part of a declaration on the same line)
            const lineStart = code.lastIndexOf('\n', m.index) + 1;
            const lineEnd = code.indexOf('\n', m.index);
            const line = code.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
            if (!/\b(var|let|const|function|class)\b/.test(line)) {
                undeclared.add(name);
            }
        }
    }
    if (undeclared.size > 0) {
        const list = [...undeclared].slice(0, 5).join('", "');
        errors.push(`Warning: Possibly undeclared variable(s): "${list}". Declare them with let/const before use.`);
        score -= 10;
    }

    // ── 9. WRONG COMPARISON IN LOOP CONDITION (Two-pointer & index bugs) ───
    // Detect any two variables: one initialized to 0, the other to length-1 (or size-1)
    // Then check if the while-loop uses > instead of < between them → loop never runs.
    const twoPointerPairs = [
        ['left',  'right'],
        ['low',   'high'],
        ['lo',    'hi'],
        ['start', 'end'],
        ['begin', 'end'],
        ['i',     'j'],
        ['l',     'r'],
        ['s',     'e'],
    ];

    for (const [a, b] of twoPointerPairs) {
        // Check: varA initialized near 0, varB near length/size/n-1
        const aInit = new RegExp(`\\b(?:let|var|const)\\s+${a}\\s*=\\s*0`).test(code);
        const bInit = new RegExp(`\\b(?:let|var|const)\\s+${b}\\s*=`).test(code);
        const wrongDir = new RegExp(`while\\s*\\(\\s*${a}\\s*>\\s*${b}\\s*\\)`).test(code);

        if (aInit && bInit && wrongDir) {
            score -= 35;
            const fix = `while (${a} < ${b})`;
            errors.push(`Critical Bug: "while (${a} > ${b})" — since "${a}" starts at 0 and "${b}" starts at a higher index, this condition is immediately FALSE and the loop NEVER executes. Fix: change to "${fix}".`);
            correctedCode = correctedCode.replace(
                new RegExp(`while\\s*\\(\\s*${a}\\s*>\\s*${b}\\s*\\)`),
                fix
            );
            break; // only report once
        }
    }

    // Also catch: while (i > 0) when i is initialized to 0
    if (/\b(?:let|var|const)\s+i\s*=\s*0/.test(code) && /while\s*\(\s*i\s*>\s*\d/.test(code)) {
        score -= 25;
        errors.push('Bug: Loop variable "i" initialised to 0 but while-condition is "i > ..." — loop never runs. Did you mean "i <"?');
    }

    // ── 10. DIV BY ZERO risk ───────────────────────────────────────────────
    if (/\/\s*0\b/.test(code)) {
        errors.push('Bug: Division by zero (/ 0) — produces Infinity or NaN.');
        score -= 15;
    }

    // ── 11. NEGATIVE ARRAY INDEX ───────────────────────────────────────────
    if (/\[\s*-\s*\d+\s*\]/.test(code)) {
        errors.push('Bug: Negative array index (e.g., arr[-1]) — JS does not support negative indexing. Use arr[arr.length - 1] for the last element.');
        score -= 10;
    }

    // ── 12. NaN COMPARISON ─────────────────────────────────────────────────
    if (/===\s*NaN|NaN\s*===|==\s*NaN|NaN\s*==/.test(code)) {
        errors.push('Bug: Comparing with NaN using === or == always returns false. Use isNaN(value) or Number.isNaN(value) instead.');
        score -= 15;
    }

    // ── 13. MISSING BREAK IN SWITCH-CASE ──────────────────────────────────
    if (/\bswitch\s*\(/.test(code)) {
        const caseBlocks = code.split(/\bcase\b/);
        let missingBreak = false;
        for (let ci = 1; ci < caseBlocks.length - 1; ci++) {
            if (!/break\b|return\b|throw\b/.test(caseBlocks[ci])) {
                missingBreak = true;
                break;
            }
        }
        if (missingBreak) {
            errors.push('Bug: switch-case missing "break" — execution falls through to the next case unintentionally. Add "break;" at the end of each case.');
            score -= 15;
        }
    }

    // ── 14. WRONG SORT — no comparator for numbers ────────────────────────
    if (/\.sort\s*\(\s*\)/.test(code) && /\d/.test(code)) {
        errors.push('Bug: arr.sort() without a comparator sorts numbers as strings — [10,2,1] becomes [1,10,2]. Use arr.sort((a, b) => a - b) for correct numeric sort.');
        score -= 10;
    }

    // ── 15. ACCUMULATOR ASSIGNMENT BUG: sum = num instead of sum += num ───
    const accNames = ['sum', 'total', 'count', 'result', 'acc', 'product'];
    for (const acc of accNames) {
        if (new RegExp(`\\b${acc}\\b`).test(code) &&
            /for\s*\(|while\s*\(/.test(code) &&
            !new RegExp(`\\b${acc}\\s*\\+=`).test(code) &&
            new RegExp(`\\b${acc}\\s*=[^=]`).test(code)) {
            errors.push(`Bug: "${acc} = value" inside a loop overwrites on every iteration instead of accumulating. Did you mean "${acc} += value"?`);
            score -= 20;
            break;
        }
    }

    // ── 16. UNREACHABLE CODE AFTER RETURN ─────────────────────────────────
    if (/return\b[^;\n]*[;\n]\s*\n\s*[a-zA-Z$_]/.test(code)) {
        errors.push('Warning: Code exists after a "return" statement — it will never execute (unreachable code).');
        score -= 5;
    }

    // ── 17. TWO-POINTER BOTH MOVING SAME DIRECTION ────────────────────────
    for (const [a, b] of twoPointerPairs) {
        if (new RegExp(`\\b${a}\\b`).test(code) && new RegExp(`\\b${b}\\b`).test(code)) {
            if (new RegExp(`${a}\\+\\+[\\s\\S]{0,80}${b}\\+\\+`).test(code)) {
                errors.push(`Bug: Both "${a}++" and "${b}++" increment — in a two-pointer loop one should go forward (${a}++) and one backward (${b}--).`);
                score -= 20;
                break;
            }
            if (new RegExp(`${a}--[\\s\\S]{0,80}${b}--`).test(code)) {
                errors.push(`Bug: Both "${a}--" and "${b}--" decrement — one pointer should move forward (${a}++) and the other backward (${b}--).`);
                score -= 20;
                break;
            }
        }
    }

    // ── 18. TYPEOF NULL TRAP ───────────────────────────────────────────────
    if (/typeof\s+\w+\s*===?\s*['"]object['"]/.test(code) && !/null/.test(code)) {
        errors.push('Warning: typeof null === "object" is a JS quirk. If checking for objects, also verify the value is not null: value !== null && typeof value === "object".');
        score -= 5;
    }

    // ── 19. PARSEINT WITHOUT RADIX ─────────────────────────────────────────
    if (/\bparseInt\s*\(\s*[^,)]+\s*\)/.test(code)) {
        errors.push('Warning: parseInt() used without a radix. Always pass the base: parseInt(value, 10) to prevent unexpected octal parsing in older environments.');
        score -= 5;
    }

    // ── 20. RECURSIVE FUNCTION WITH NO BASE CASE ───────────────────────────
    const recMatch = code.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/);
    if (recMatch) {
        const fnName = recMatch[1];
        const fnBody = recMatch[3];
        const isSelfCalling = new RegExp(`\\b${fnName}\\s*\\(`).test(fnBody);
        const hasBaseCase = /if\s*\(/.test(fnBody) && /return\b/.test(fnBody);
        if (isSelfCalling && !hasBaseCase) {
            errors.push(`Critical Bug: Recursive function "${fnName}" calls itself with no base case — this causes infinite recursion and a stack overflow error.`);
            score -= 30;
        }
    }

    // ── 21. CONSOLE.LOG left in code ───────────────────────────────────────
    if (/console\.log\s*\(/.test(code)) {
        errors.push('Note: console.log() found — remove debug logs before submitting/deploying.');
    }

    // ── 22. PERFORMANCE WARNINGS ───────────────────────────────────────────
    const timeC = detectTimeComplexity(code);
    if (timeC === 'O(n²)') {
        errors.push('Performance: Nested loops detected → O(n²). Consider a Map/Set-based O(n) solution.');
        score -= 5;
    } else if (timeC === 'O(n³)') {
        errors.push('Performance: Triple-nested loops → O(n³). Very slow for large inputs — refactor if possible.');
        score -= 10;
    }

    const isBug = (e) => e.startsWith('Bug') || e.startsWith('Critical') || e.startsWith('Syntax');
    return {
        score,
        errors,
        correctedCode,
        hasBugs: errors.some(isBug)
    };
}

// ============================================================
// STEP 4: C / C++ BUG DETECTION
// ============================================================
function detectCBugs(code) {
    const errors = [];
    let score = 100;

    // 1. Assignment in condition
    if (/if\s*\(\s*[a-zA-Z0-9_]+\s*=[^=]/.test(code)) {
        errors.push('Bug: Assignment "=" in if-condition. Use "==" for comparison.');
        score -= 15;
    }

    // 2. Buffer overflow risk: gets() is unsafe
    if (/\bgets\s*\(/.test(code)) {
        errors.push('Critical Bug: gets() is unsafe — it causes buffer overflows. Use fgets() instead.');
        score -= 25;
    }

    // 3. Infinite loop
    if (/while\s*\(\s*1\s*\)|while\s*\(\s*true\s*\)/i.test(code) && !/\b(break|return)\b/.test(code)) {
        errors.push('Critical Bug: Infinite loop with no break or return.');
        score -= 30;
    }

    // 4. Missing null check after malloc/calloc
    if (/\bmalloc\s*\(|\bcalloc\s*\(/.test(code) && !/==\s*NULL|!=\s*NULL/.test(code)) {
        errors.push('Warning: malloc()/calloc() used without NULL check. Always verify the pointer before use.');
        score -= 10;
    }

    // 5. Array index with potential off-by-one
    if (/\b\w+\s*<=\s*[a-zA-Z0-9_]+\b/.test(code) && /for\s*\(/.test(code)) {
        errors.push('Warning: Possible off-by-one — check loop condition does not go out of array bounds.');
        score -= 10;
    }

    // 6. printf without format string (security risk)
    if (/printf\s*\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)/.test(code)) {
        errors.push('Warning: printf(variable) without format string — use printf("%s", variable) to prevent format string attacks.');
        score -= 10;
    }

    if (errors.length === 0) errors.push('Great job! No obvious bugs detected in your C/C++ code.');
    return { score: Math.max(25, Math.min(100, score)), errors, correctedCode: code, hasBugs: errors.some(e => e.startsWith('Bug') || e.startsWith('Critical')) };
}

// ============================================================
// STEP 5: MAIN EVALUATOR (Language-Aware)
// ============================================================

function evaluateStudentCode(type, code) {
    const lang = detectLanguage(code);  // 'java' | 'python' | 'cpp' | 'javascript'

    // ── FLOWCHART ──────────────────────────────────────────────────────────
    if (type === 'Flowchart') {
        let score = 100;
        const errors = [];
        const hasStart = /start|begin/i.test(code);
        const hasEnd = /end|stop/i.test(code);
        const hasBranches = /-->|->/i.test(code);

        if (!hasStart) { errors.push('Missing explicit [Start] node in the flowchart.'); score -= 15; }
        if (!hasEnd)   { errors.push('Missing [End / Stop] terminal node. Flowchart may run infinitely.'); score -= 20; }
        if (!hasBranches) { errors.push('No connecting arrows (-->) found between steps.'); score -= 15; }

        let fixedFlow = code;
        if (!hasStart) fixedFlow = 'Start([Start]) --> ' + fixedFlow;
        if (!hasEnd)   fixedFlow = fixedFlow + ' --> End([End])';

        if (errors.length === 0) errors.push('Great job! Flowchart structure looks correct.');

        return {
            score: Math.max(25, Math.min(100, score)),
            language: 'Flowchart',
            timeComplexity: 'O(n)',
            spaceComplexity: 'O(1)',
            errors,
            optimized: (hasStart && hasEnd) ? code : fixedFlow
        };
    }

    // ── ROUTE BY LANGUAGE ──────────────────────────────────────────────────
    let bugResult;

    if (lang === 'java') {
        bugResult = detectJavaBugs(code);
    } else if (lang === 'python') {
        bugResult = detectPythonBugs(code);
    } else if (lang === 'cpp') {
        bugResult = detectCBugs(code);
    } else {
        // JavaScript — also check palindrome optimization
        if (/palindrome/i.test(code) && /reverse\s*\(/i.test(code)) {
            bugResult = detectBugs(code);
            const optimizedJS = `// Optimized Two-Pointer Approach (O(n) time, O(1) space)
function isPalindrome(str) {
    if (!str || typeof str !== 'string') return false;
    let left = 0, right = str.length - 1;
    while (left < right) {
        if (str[left] !== str[right]) return false;
        left++; right--;
    }
    return true;
}`;
            return {
                score: Math.max(25, Math.min(100, bugResult.hasBugs ? bugResult.score - 10 : 80)),
                language: 'JavaScript',
                timeComplexity: 'O(n)',
                spaceComplexity: 'O(n)',
                errors: [...bugResult.errors,
                    'Inefficient: .reverse() creates O(n) auxiliary space.',
                    'Suggestion: Use Two-Pointer approach for O(1) space.'],
                optimized: optimizedJS
            };
        }
        bugResult = detectBugs(code);
    }

    // ── SHARED: Time & Space complexity (works for all languages) ──────────
    const timeComplexity = detectTimeComplexity(code);
    const spaceComplexity = detectSpaceComplexity(code);

    // Add language-specific optimized suggestion for palindrome in Java
    let optimized = bugResult.correctedCode || code;
    if (lang === 'java' && /palindrome/i.test(code) && /\.reverse\(\)/.test(code)) {
        optimized = `// Optimized Two-Pointer Approach in Java (O(n) time, O(1) space)
public static boolean isPalindrome(String str) {
    if (str == null || str.isEmpty()) return false;
    int left = 0, right = str.length() - 1;
    while (left < right) {
        if (Character.toLowerCase(str.charAt(left)) != Character.toLowerCase(str.charAt(right)))
            return false;
        left++;
        right--;
    }
    return true;
}`;
    }

    if (bugResult.errors.length === 0 || bugResult.errors.every(e => e.startsWith('Note'))) {
        bugResult.errors.unshift('Great job! No bugs detected in your code.');
    }

    return {
        score: bugResult.score,
        language: lang.charAt(0).toUpperCase() + lang.slice(1),
        timeComplexity,
        spaceComplexity,
        errors: bugResult.errors,
        optimized
    };
}

// ============================================================
// STEP 5: EVALUATION ROUTE
// ============================================================
app.post('/api/evaluate', (req, res) => {
    const { submissionType, codeInput } = req.body;

    if (!submissionType || !codeInput || !codeInput.trim()) {
        return res.status(400).json({ success: false, message: 'Please choose a format and paste your code!' });
    }

    const result = evaluateStudentCode(submissionType, codeInput);

    try {
        const insertEval = db.prepare(`
            INSERT INTO evaluations (submission_type, code_input, score, time_complexity, space_complexity, errors, optimized_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        insertEval.run(
            submissionType,
            codeInput,
            result.score,
            result.timeComplexity,
            result.spaceComplexity,
            JSON.stringify(result.errors),
            result.optimized
        );

        res.json({
            success: true,
            submissionType,
            language: result.language,
            score: result.score,
            timeComplexity: result.timeComplexity,
            spaceComplexity: result.spaceComplexity,
            errors: result.errors,
            optimizedCode: result.optimized
        });
    } catch (err) {
        console.error('Save evaluation error:', err);
        res.status(500).json({ success: false, message: 'Error saving evaluation to SQL.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  CodeCraft Server running on PORT ${PORT}`);
    console.log(`  Open in browser: http://localhost:${PORT}`);
    console.log(`  Tech Stack: HTML5, CSS3, JavaScript, Express & SQLite`);
    console.log(`  Color Theme: Lavender, Violet, and White`);
    console.log(`=======================================================`);
});
