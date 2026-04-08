/**
 * Generates audit.pdf in repo root (comprehensive technical audit).
 * Run: node scripts/generate-audit-pdf.js
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outPath = path.join(__dirname, '..', 'audit.pdf');
const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
doc.pipe(fs.createWriteStream(outPath));

function heading(text) {
  doc.moveDown(0.55);
  doc.fontSize(13).fillColor('#0f172a').font('Helvetica-Bold').text(text);
  doc.font('Helvetica').fillColor('#334155');
}

function subheading(text) {
  doc.moveDown(0.35);
  doc.fontSize(11).fillColor('#1e293b').font('Helvetica-Bold').text(text);
  doc.font('Helvetica').fillColor('#334155');
}

function bullet(text) {
  doc.moveDown(0.2);
  doc.fontSize(10).text(`• ${text}`, { indent: 8, lineGap: 2, align: 'left' });
}

function para(text) {
  doc.moveDown(0.3);
  doc.fontSize(10).text(text, { align: 'left', lineGap: 2 });
}

doc.fontSize(18).fillColor('#0f172a').font('Helvetica-Bold').text('EpexFit — Comprehensive technical audit', { underline: true });
doc.font('Helvetica').fillColor('#334155');
doc.moveDown(0.4);
doc.fontSize(10).text(`Document version: 1.0  |  Generated: ${new Date().toISOString().slice(0, 19)}Z`);

heading('Should you launch now?');
para(
  'You can start the app locally or on a device for testing at any time. Treat a public store release as "ready" only after you complete device QA, production env validation, and your own acceptance criteria — not solely because the codebase compiles.'
);
subheading('Short answer');
para(
  'Safe to launch for internal / TestFlight-style testing: yes, assuming Supabase and required env vars are configured. Safe to ship to end users without further QA: not guaranteed — this audit did not replace manual testing on real hardware, store review prep, or legal/privacy review.'
);

heading('Audit scope (what was verified)');
bullet('Full-project TypeScript check: npx tsc --noEmit (strict mode per tsconfig).');
bullet('Code review of reported compile errors and targeted fixes (ActivityScreen, theme typography).');
bullet('Cross-check of PDF tooling pattern used elsewhere in the repo (pdfkit script).');
bullet('Not run as part of this document: automated UI tests, E2E tests, perf profiling, security penetration testing, accessibility audit, or App Store / Play Console submission checks.');
para('Expo Doctor was attempted in the audit environment and failed with a Node/tooling error (parseEnv). That reflects the local toolchain, not necessarily your machine — re-run npx expo doctor on your dev PC before release.');

heading('Static analysis results');
subheading('TypeScript');
para('Status: PASS (after fixes below). Strict compilation succeeded with zero errors at audit time.');
subheading('ESLint / Prettier');
para('No eslint script is defined in package.json. Consistency and many bug classes are not enforced automatically. Recommendation: add ESLint (expo/eslint-config-universe or similar) and a "lint" script for CI.');

heading('Issues found and resolved (audit session)');
bullet('ActivityScreen.tsx — SplitsTable referenced unitSystem outside its scope (TS2552). Fix: pass unitSystem from the screen into SplitsTable props (typed as UnitSystem).');
bullet('HomeScreen.tsx + theme.ts — typography.titleMedium was used in UI but omitted from the exported typography scale (TS2339). Fix: add titleMedium to src/constants/theme.ts aligned with internal fontConfig.');

heading('Stack & architecture (high level)');
bullet('Runtime: Expo SDK ~52, React 18.3, React Native 0.76.x.');
bullet('Navigation: React Navigation (native stack, bottom tabs, stack).');
bullet('Backend: Supabase (@supabase/supabase-js).');
bullet('Observability: Sentry optional via EXPO_PUBLIC_SENTRY_DSN.');
bullet('Notable native modules: camera, location, notifications, health-related integrations, WebView (e.g. maps), reanimated, gesture handler.');

heading('Residual risks & gaps');
bullet('Manual QA on Android and iOS physical devices (permissions, background behavior, health sync, notifications) remains essential.');
bullet('Third-party and network dependencies (maps tiles, APIs) need spot checks offline and on slow networks.');
bullet('Environment secrets: ensure .env is never committed; validate .env.example stays accurate for collaborators.');
bullet('EAS build profiles (preview vs production) and app signing must be verified before store upload.');
bullet('Privacy policy, data retention, and store listing assets are product/legal tasks outside this technical audit.');

heading('Pre-launch checklist (recommended)');
bullet('Run tsc --noEmit after each significant change; add to CI when possible.');
bullet('Run expo doctor on your primary development machine; resolve dependency warnings.');
bullet('Production build: eas build with production profile; install artifact on a clean device.');
bullet('Smoke test: auth, Home APS, activity tracking, food log, settings, offline/airplane scenarios.');
bullet('Verify Sentry receives a test event when DSN is set (non-dev build).');
bullet('Confirm Supabase RLS policies and API keys match your security model.');

heading('Conclusion');
para(
  'The codebase passed strict TypeScript analysis after the two fixes above. That is a strong signal for maintainability and catches many runtime mistakes early, but it is not a substitute for user acceptance testing. Use this PDF as a technical snapshot; update it or regenerate after major releases.'
);

doc.end();
doc.on('finish', () => {
  console.log('Wrote', outPath);
});
