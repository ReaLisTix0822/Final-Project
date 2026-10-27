#!/usr/bin/env node
// ==============================================================================
// CONTRAST CHECK for the color palette (WCAG 2.1 AA)
// Reads the palette from public/css/main.css (normal) and public/css/accessibility.css
// (high-contrast mode), then checks each pair the site uses:
//   text  >= 4.5:1 (WCAG 1.4.3)   borders / icons / focus ring >= 3:1 (WCAG 1.4.11)
// Usage: node scripts/check-contrast.js      (exit code 1 when a pair fails)
// ==============================================================================
const fs = require('fs');
const path = require('path');

const css = file => fs.readFileSync(path.join(__dirname, '..', 'public', 'css', file), 'utf8');
function readVars(block) {
    const vars = {};
    for (const m of block.matchAll(/--(color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) vars[m[1]] = m[2];
    return vars;
}
const main = css('main.css');
const normal = readVars(main.slice(main.indexOf(':root {'), main.indexOf('}', main.indexOf(':root {'))));
const a11y = css('accessibility.css');
const hcStart = a11y.indexOf('html.a11y-contrast-high {');
const high = { ...normal, ...readVars(a11y.slice(hcStart, a11y.indexOf('}', hcStart))) };

const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = hex => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel(n >> 16 & 255) + 0.7152 * channel(n >> 8 & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [foreground, background, minimum ratio, what it is, only in mode ('normal' | 'high', optional)]
const TEXT = 4.5, UI = 3;
const PAIRS = [
    ['color-text', 'color-bg', TEXT, 'ข้อความหลัก บนพื้นหน้าเว็บ'],
    ['color-text', 'color-surface', TEXT, 'ข้อความหลัก บนการ์ด'],
    ['color-text', 'color-surface-alt', TEXT, 'ข้อความหลัก บนพื้นรอง'],
    ['color-text-muted', 'color-bg', TEXT, 'ข้อความรอง บนพื้นหน้าเว็บ'],
    ['color-text-muted', 'color-surface', TEXT, 'ข้อความรอง บนการ์ด'],
    ['color-text-muted', 'color-surface-alt', TEXT, 'ข้อความรอง บนพื้นรอง'],
    ['color-primary', 'color-surface', TEXT, 'ลิงก์ / ปุ่มรอง บนการ์ด'],
    ['color-primary', 'color-bg', TEXT, 'ลิงก์ / ปุ่มรอง บนพื้นหน้าเว็บ'],
    ['color-on-primary', 'color-primary', TEXT, 'ตัวอักษรบนปุ่มหลัก'],
    ['color-on-primary', 'color-primary-hover', TEXT, 'ตัวอักษรบนปุ่มหลัก (hover)'],
    ['color-on-primary-muted', 'color-primary', TEXT, 'ข้อความรองบนแถบสีเขียวเข้ม'],
    ['color-primary-hover', 'color-primary-soft', TEXT, 'ตัวอักษรบนป้าย chip / แท็บที่เลือก'],
    ['color-primary', 'color-primary-soft', TEXT, 'ลิงก์บนพื้นเขียวอ่อน'],
    ['color-text', 'color-primary-soft', TEXT, 'ข้อความหลัก บนพื้นเขียวอ่อน'],
    ['color-accent', 'color-surface', TEXT, 'ราคา / เป้าระดมทุน'],
    ['color-accent', 'color-bg', TEXT, 'ราคา บนพื้นหน้าเว็บ'],
    ['color-success', 'color-surface', TEXT, 'ข้อความสำเร็จ'],
    ['color-success', 'color-success-soft', TEXT, 'ข้อความสำเร็จ บนกล่องสีเขียว'],
    ['color-error', 'color-surface', TEXT, 'ข้อความผิดพลาด'],
    ['color-error', 'color-error-soft', TEXT, 'ข้อความผิดพลาด บนกล่องสีแดง'],
    ['color-info', 'color-surface', TEXT, 'ลิงก์ในเนื้อหา'],
    ['color-info', 'color-info-soft', TEXT, 'ข้อความ info บนกล่องสีฟ้า'],
    ['color-text', 'color-warning-bg', TEXT, 'ข้อความในกล่องเตือน'],
    ['color-accent', 'color-warning-bg', TEXT, 'ป้ายสถานะ "รอ" บนกล่องเตือน'],
    ['color-text-muted', 'color-disabled-bg', TEXT, 'ปุ่ม disabled'],
    ['color-on-photo', 'color-photo-overlay', TEXT, 'ตัวอักษรบนรูป (ชั้นทับ กรณีรูปเป็นสีขาวล้วน)'],
    ['color-border', 'color-surface', UI, 'ขอบช่องกรอก บนการ์ด'],
    ['color-border', 'color-bg', UI, 'ขอบช่องกรอก บนพื้นหน้าเว็บ'],
    ['color-primary', 'color-surface', UI, 'ไอคอน / ขอบปุ่มรอง'],
    ['color-focus', 'color-focus-line', UI, 'กรอบโฟกัส: วงเหลือง เทียบเส้นเข้มสองข้าง'],
    ['color-focus-line', 'color-surface', UI, 'กรอบโฟกัส: เส้นเข้ม บนการ์ดขาว', 'normal'],
    ['color-focus-line', 'color-bg', UI, 'กรอบโฟกัส: เส้นเข้ม บนพื้นหน้าเว็บ', 'normal'],
    ['color-focus', 'color-primary', UI, 'กรอบโฟกัส: วงเหลือง บนแถบ/ปุ่มสีเขียวเข้ม', 'normal'],
    ['color-focus', 'color-bg', UI, 'กรอบโฟกัส: วงฟ้า บนพื้นดำ', 'high'],
    ['color-focus-line', 'color-primary', UI, 'กรอบโฟกัส: เส้นดำ บนปุ่มเหลือง', 'high'],
];

let failures = 0;
function report(title, vars, mode) {
    console.log(`\n${title}`);
    const rows = PAIRS.filter(p => !p[4] || p[4] === mode).map(([fg, bg, min, label]) => {
        const r = ratio(vars[fg], vars[bg]);
        const pass = r >= min;
        if (!pass) failures++;
        return { 'คู่สี': label, 'ตัวหน้า': `--${fg} ${vars[fg]}`, 'พื้น': `--${bg} ${vars[bg]}`, 'อัตราส่วน': `${r.toFixed(2)}:1`, 'เกณฑ์': `${min}:1`, 'ผล': pass ? 'PASS' : 'FAIL' };
    });
    console.table(rows);
}
// The photo overlay is rgba(31,42,28,.70) in normal mode. Worst case = the photo is pure white there.
const ov = main.match(/--color-photo-overlay:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
const alpha = Number(ov[4]);
normal['color-photo-overlay'] = '#' + [1, 2, 3].map(i => Math.round(Number(ov[i]) * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0')).join('');
high['color-photo-overlay'] = high['color-photo-overlay'] || '#000000';
report('โหมดปกติ', normal, 'normal');
report('โหมดคอนทราสต์สูง', high, 'high');
console.log(failures ? `\n${failures} คู่ไม่ผ่าน` : '\nผ่านทุกคู่');
process.exit(failures ? 1 : 0);
