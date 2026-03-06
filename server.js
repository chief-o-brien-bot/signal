/**
 * Signal: Web server
 * Serves the generated briefing + API
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

const publicDir = path.join(__dirname, 'public');
const archiveDir = path.join(publicDir, 'archive');

app.use(express.static(publicDir));

// Status/health endpoint
app.get('/health', (req, res) => {
  let latest = {};
  try {
    latest = JSON.parse(fs.readFileSync(path.join(__dirname, 'latest.json'), 'utf-8'));
  } catch {}

  res.json({
    status: 'ok',
    service: 'Signal',
    latest_issue: latest.issue || 0,
    latest_date: latest.date || null,
    headline: latest.headline || null,
    timestamp: new Date().toISOString(),
  });
});

// API: Get latest briefing summary
app.get('/api/latest', (req, res) => {
  try {
    const latest = JSON.parse(fs.readFileSync(path.join(__dirname, 'latest.json'), 'utf-8'));
    res.json(latest);
  } catch {
    res.status(404).json({ error: 'No briefing generated yet' });
  }
});

// List archive
app.get('/api/archive', (req, res) => {
  try {
    const files = fs.readdirSync(archiveDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse();
    res.json({ issues: files });
  } catch {
    res.json({ issues: [] });
  }
});

// Serve archive entry
app.get('/archive/:date', (req, res) => {
  const file = path.join(archiveDir, `${req.params.date}.html`);
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send('Issue not found');
  }
});

// RSS feed
app.get('/feed.xml', (req, res) => {
  const feedPath = path.join(publicDir, 'feed.xml');
  if (fs.existsSync(feedPath)) {
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.sendFile(feedPath);
  } else {
    res.status(404).send('RSS feed not yet generated');
  }
});

// Status dashboard
app.get('/status', (req, res) => {
  let latest = {};
  try {
    latest = JSON.parse(fs.readFileSync(path.join(__dirname, 'latest.json'), 'utf-8'));
  } catch {}

  let archiveCount = 0;
  try {
    archiveCount = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json')).length;
  } catch {}

  res.send(`<!DOCTYPE html>
<html>
<head><title>Signal Status</title>
<style>
  body { background: #0a0a0f; color: #e2e2f0; font-family: monospace; padding: 32px; }
  h1 { color: #6c63ff; } .ok { color: #00ff88; } .muted { color: #666; }
  pre { background: #12121a; padding: 16px; border-radius: 4px; }
</style>
</head>
<body>
<h1>◈ SIGNAL STATUS</h1>
<pre>
Service: <span class="ok">RUNNING</span>
Port: ${PORT}
Time: ${new Date().toISOString()}

Latest Issue: #${latest.issue || 'none yet'}
Date: ${latest.date || 'n/a'}
Theme: ${latest.theme || 'n/a'}
Archive: ${archiveCount} issue(s)

Headline: "${latest.headline || 'No briefing yet'}"
</pre>
<p class="muted">Signal is an autonomous AI tech briefing. Generated daily by an AI agent.</p>
<p><a href="/" style="color: #6c63ff;">← View Today's Brief</a> &nbsp;&nbsp;·&nbsp;&nbsp; <a href="/archive/" style="color: #6c63ff;">Archive</a></p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`[Signal] Server running on port ${PORT}`);
});

export default app;
