/**
 * Signal: Archive index builder
 * Generates /archive/index.html listing all past issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildArchiveIndex() {
  const archiveDir = path.join(__dirname, 'public', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });

  // Prefer issue-N.json files (individual per issue), fall back to date files
  let jsonFiles = fs.readdirSync(archiveDir)
    .filter(f => /^issue-\d+\.json$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]);
      const nb = parseInt(b.match(/\d+/)[0]);
      return nb - na; // descending (newest first)
    });

  if (jsonFiles.length === 0) {
    jsonFiles = fs.readdirSync(archiveDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
  }

  const issues = jsonFiles.map(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
      // Determine best HTML link: issue-N.html if exists, else date.html
      const issueHtml = `issue-${data.issue}.html`;
      const dateHtml = `${data.date}.html`;
      const htmlFile = fs.existsSync(path.join(archiveDir, issueHtml)) ? issueHtml : dateHtml;
      return {
        issue: data.issue,
        date: data.date,
        headline: data.briefing?.headline || '',
        theme: data.briefing?.theme || '',
        one_liner: data.briefing?.one_liner || '',
        story_count: data.briefing?.top_stories?.length || 0,
        generated_at: data.generated_at,
        htmlFile,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const issueRows = issues.map(i => `
    <tr>
      <td class="num">#${i.issue}</td>
      <td class="date">${i.date}</td>
      <td><a href="${i.htmlFile || i.date + '.html'}">${escapeHtml(i.headline)}</a></td>
      <td><span class="badge">${escapeHtml(i.theme)}</span></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal — Archive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0f;
      color: #e2e2f0;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 14px;
      line-height: 1.7;
    }
    a { color: #6c63ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    header {
      border-bottom: 1px solid #1e1e2e;
      padding: 24px;
      text-align: center;
    }
    .logo { font-size: 11px; letter-spacing: 4px; color: #666680; margin-bottom: 4px; }
    .logo span { color: #00ff88; }
    h1 { font-size: 20px; color: #e2e2f0; }
    .subtitle { color: #666680; font-size: 12px; margin-top: 4px; }
    .main { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
    .section-label {
      font-size: 10px;
      letter-spacing: 3px;
      color: #666680;
      text-transform: uppercase;
      border-left: 2px solid #6c63ff;
      padding-left: 8px;
      margin-bottom: 20px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 1px solid #1e1e2e; }
    th { font-size: 10px; letter-spacing: 2px; color: #666680; text-align: left; padding: 8px 12px; }
    td { padding: 14px 12px; border-bottom: 1px solid #12121a; vertical-align: top; }
    tr:hover td { background: #12121a; }
    td.num { color: #6c63ff; font-size: 12px; white-space: nowrap; }
    td.date { color: #666680; white-space: nowrap; font-size: 12px; }
    .badge {
      display: inline-block;
      background: #6c63ff22;
      color: #6c63ff;
      padding: 2px 8px;
      border-radius: 2px;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .empty { color: #666680; text-align: center; padding: 40px; }
    .nav { margin-bottom: 32px; }
    .nav a { color: #666680; font-size: 12px; }
    footer {
      border-top: 1px solid #1e1e2e;
      padding: 20px;
      text-align: center;
      color: #333355;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo"><span>◈</span> SIGNAL</div>
    <h1>Archive</h1>
    <div class="subtitle">${issues.length} issue${issues.length !== 1 ? 's' : ''} generated</div>
  </header>
  <main class="main">
    <div class="nav"><a href="/">← Today's brief</a></div>
    <div class="section-label">All Issues</div>
    ${issues.length === 0 ? '<p class="empty">No issues yet.</p>' : `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Headline</th>
          <th>Theme</th>
        </tr>
      </thead>
      <tbody>
        ${issueRows}
      </tbody>
    </table>
    `}
  </main>
  <footer>SIGNAL — Autonomous AI tech curation · Generated ${new Date().toISOString()}</footer>
</body>
</html>`;

  fs.writeFileSync(path.join(archiveDir, 'index.html'), html, 'utf-8');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Standalone runner
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  buildArchiveIndex();
  console.log('[Signal/Archive] Archive index rebuilt.');
}
