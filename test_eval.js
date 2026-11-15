// Quick test script — run with: node test_eval.js

const code1 = `
function isPalindrome(str) {
    if (!str || typeof str !== 'string') return false;
    let left = 0;
    let right = str.length - 1;
    while (left > right) {
        if (str[left] !== str[right]) return false;
        left++;
        right--;
    }
    return true;
}`;

const code2 = `
function binarySearch(arr, target) {
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`;

const code3 = `
function sumArray(arr) {
    let sum = 0;
    for (let i = 0; i <= arr.length; i++) {
        sum = arr[i];
    }
    return sum;
}`;

const code4 = `
public class PalindromeString {
    public static void main(String[] args) {
        String text = "madam";
        String reversed = new StringBuilder(text).reverse().toString();
        if (text.equalsIgnoreCase(reversed)) {
            System.out.println(text + " is a palindrome.");
        }
    }
}`;

// ── Load evaluator functions from server.js ──────────────────────────────
// We extract just the helper functions — no express/db needed for unit test
const fs = require('fs');
let src = fs.readFileSync('./server.js', 'utf8');

// Strip out express/db setup so we can eval the helper functions only
src = src
    .replace(/const express.*?app\.use[^;]+;/gs, '')
    .replace(/const db.*?console\.log\([^)]+\);/gs, '')
    .replace(/app\.(post|get|listen)[^}]+}\);/gs, '')
    .replace(/require\('express'\)|require\('cors'\)|require\('path'\)|require\('node:sqlite'\)/g, '{}')
    .replace(/const \{ DatabaseSync \}[^;]+;/g, '')
    .replace(/const app[^;]+;/g, '')
    .replace(/const PORT[^;]+;/g, '');

try {
    eval(src);
} catch(e) {
    console.error('❌ Failed to load helper functions:', e.message);
    process.exit(1);
}

console.log('✅ Helper functions loaded successfully\n');

// ── Run tests ────────────────────────────────────────────────────────────
const tests = [
    { label: 'JS: while(left > right) bug',        code: code1, expectBug: true  },
    { label: 'JS: correct binary search O(log n)',  code: code2, expectBug: false },
    { label: 'JS: off-by-one + accumulator bug',   code: code3, expectBug: true  },
    { label: 'Java: palindrome with reverse()',     code: code4, expectBug: false },
];

for (const t of tests) {
    const lang = detectLanguage(t.code);
    const result = evaluateStudentCode('Code', t.code);
    const bugMessages = result.errors.filter(e =>
        e.startsWith('Bug') || e.startsWith('Critical') || e.startsWith('Syntax')
    );
    const gotBug = bugMessages.length > 0;
    const pass = gotBug === t.expectBug;

    console.log(`${pass ? '✅' : '❌'} ${t.label}`);
    console.log(`   Language: ${lang} | Score: ${result.score} | Complexity: ${result.timeComplexity}`);
    result.errors.forEach(e => console.log(`   • ${e}`));
    console.log();
}
