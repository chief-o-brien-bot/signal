/**
 * Signal: Build landing page (index.html) from existing issues
 * Can be run independently or called from generate.js
 */

import { renderLandingPage } from './renderLanding.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildLandingPage() {
  const archiveDir = path.join(__dirname, 'public', 'archive');
  const outputDir = path.join(__dirname, 'public');

  // Load all issue-N.json files (individual per issue), fall back to date files
  let jsonFiles = fs.readdirSync(archiveDir)
    .filter(f => /^issue-\d+\.json$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]);
      const nb = parseInt(b.match(/\d+/)[0]);
      return nb - na;
    });

  if (jsonFiles.length === 0) {
    jsonFiles = fs.readdirSync(archiveDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
  }

  if (jsonFiles.length === 0) {
    console.warn('[Landing] No archive JSON found, skipping landing page build');
    return;
  }

  const allIssues = jsonFiles
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(archiveDir, f), 'utf-8'));
      } catch { return null; }
    })
    .filter(Boolean);

  const latest = allIssues[0];

  // Read issue count
  const issuePath = path.join(__dirname, 'issue_count.txt');
  const issueNumber = fs.existsSync(issuePath)
    ? parseInt(fs.readFileSync(issuePath, 'utf-8').trim())
    : latest.issue || 1;

  const html = renderLandingPage(
    latest.briefing,
    issueNumber,
    latest.date,
    allIssues
  );

  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
  console.log(`[Landing] Built index.html (Issue #${issueNumber}, ${latest.date})`);
}

// Run standalone
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildLandingPage();
}
