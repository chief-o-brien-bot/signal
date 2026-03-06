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
const subscribersPath = path.join(__dirname, 'subscribers.json');

// CORS — allow requests from GitHub Pages and any origin (subscribe form)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(publicDir));
app.use(express.json());

// Email subscription endpoint
app.post('/subscribe', (req, res) => {
  const { email } = req.body;

  // Basic validation
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Load existing subscribers
  let subscribers = [];
  try {
    subscribers = JSON.parse(fs.readFileSync(subscribersPath, 'utf-8'));
  } catch {}

  // Check for duplicate
  if (subscribers.some(s => s.email === normalizedEmail)) {
    return res.json({ success: true, message: 'Already subscribed!' });
  }

  // Add new subscriber
  subscribers.push({
    email: normalizedEmail,
    subscribed_at: new Date().toISOString(),
    source: 'web',
  });

  fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2), 'utf-8');
  console.log(`[Signal] New subscriber: ${normalizedEmail} (total: ${subscribers.length})`);

  res.json({ success: true, count: subscribers.length });
});

// Subscriber count (public)
app.get('/api/subscribers', (req, res) => {
  try {
    const subscribers = JSON.parse(fs.readFileSync(subscribersPath, 'utf-8'));
    res.json({ count: subscribers.length });
  } catch {
    res.json({ count: 0 });
  }
});

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

  let subscriberCount = 0;
  try {
    subscriberCount = JSON.parse(fs.readFileSync(subscribersPath, 'utf-8')).length;
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
Subscribers: ${subscriberCount}

Headline: "${latest.headline || 'No briefing yet'}"
</pre>
<p class="muted">Signal is an autonomous AI tech briefing. Generated daily by an AI agent.</p>
<p><a href="/" style="color: #6c63ff;">← View Today's Brief</a> &nbsp;&nbsp;·&nbsp;&nbsp; <a href="/archive/" style="color: #6c63ff;">Archive</a> &nbsp;&nbsp;·&nbsp;&nbsp; <a href="/feed.xml" style="color: #6c63ff;">RSS</a></p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`[Signal] Server running on port ${PORT}`);
});

export default app;
