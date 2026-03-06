/**
 * Signal: Source Health Monitor
 * Checks all data sources and generates a health dashboard page
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEALTH_FILE = path.join(__dirname, 'source_health.json');

export async function checkSourceHealth() {
  console.log('[Health] Checking all data sources...');
  const start = Date.now();

  const results = {
    checked_at: new Date().toISOString(),
    sources: {}
  };

  // Fetch all sources with timing and count
  const sources = {
    'Hacker News': async () => {
      const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids = await r.json();
      return ids.slice(0, 20).length;
    },
    'GitHub Trending': async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      const r = await fetch(`https://api.github.com/search/repositories?q=created:>=${sevenDaysAgo}&sort=stars&order=desc&per_page=10`);
      const d = await r.json();
      return (d.items || []).length;
    },
    'Lobste.rs': async () => {
      const r = await fetch('https://lobste.rs/hottest.json');
      const d = await r.json();
      return (d || []).length;
    },
    'arXiv': async () => {
      const r = await fetch('https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10');
      const text = await r.text();
      return (text.match(/<entry>/g) || []).length;
    },
    'Dev.to': async () => {
      const r = await fetch('https://dev.to/api/articles?per_page=15&top=7');
      const d = await r.json();
      return (d || []).length;
    },
    'ProductHunt': async () => {
      const r = await fetch('https://www.producthunt.com/feed?category=undefined');
      const text = await r.text();
      return (text.match(/<item>/g) || []).length;
    },
    'Show HN': async () => {
      const r = await fetch('https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=10');
      const d = await r.json();
      return (d.hits || []).length;
    },
    'TechCrunch': async () => {
      const r = await fetch('https://techcrunch.com/feed/', {
        headers: { 'User-Agent': 'Signal-Agent/1.0' }
      });
      const text = await r.text();
      return (text.match(/<item>/g) || []).length;
    },
    'Ars Technica': async () => {
      const r = await fetch('https://feeds.arstechnica.com/arstechnica/index', {
        headers: { 'User-Agent': 'Signal-Agent/1.0' }
      });
      const text = await r.text();
      return (text.match(/<item>/g) || []).length;
    },
    'The Verge': async () => {
      const r = await fetch('https://www.theverge.com/rss/index.xml', {
        headers: { 'User-Agent': 'Signal-Agent/1.0' }
      });
      const text = await r.text();
      return (text.match(/<entry>/g) || []).length;
    },
    'Reddit (r/programming)': async () => {
      const r = await fetch('https://www.reddit.com/r/programming/top.rss?t=day&limit=10', {
        headers: { 'User-Agent': 'Signal-Agent/1.0; +https://chief-o-brien-bot.github.io/signal/' }
      });
      const text = await r.text();
      return (text.match(/<entry>/g) || []).length;
    },
    'Reddit (r/MachineLearning)': async () => {
      const r = await fetch('https://www.reddit.com/r/MachineLearning/top.rss?t=day&limit=10', {
        headers: { 'User-Agent': 'Signal-Agent/1.0; +https://chief-o-brien-bot.github.io/signal/' }
      });
      const text = await r.text();
      return (text.match(/<entry>/g) || []).length;
    }
  };

  await Promise.all(Object.entries(sources).map(async ([name, fn]) => {
    const t0 = Date.now();
    try {
      const count = await fn();
      const ms = Date.now() - t0;
      results.sources[name] = {
        status: count > 0 ? 'healthy' : 'empty',
        count,
        latency_ms: ms,
        last_checked: new Date().toISOString()
      };
      console.log(`[Health] ${name}: ${count} items (${ms}ms)`);
    } catch (err) {
      const ms = Date.now() - t0;
      results.sources[name] = {
        status: 'error',
        error: err.message,
        latency_ms: ms,
        last_checked: new Date().toISOString()
      };
      console.error(`[Health] ${name}: ERROR - ${err.message}`);
    }
  }));

  results.total_ms = Date.now() - start;

  // Load history
  let history = [];
  if (fs.existsSync(HEALTH_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8')); } catch {}
  }
  history.unshift(results);
  history = history.slice(0, 48); // keep last 48 checks (2 days at hourly)
  fs.writeFileSync(HEALTH_FILE, JSON.stringify(history, null, 2));

  return results;
}

export function renderHealthPage(latestCheck, history) {
  const sourceNames = Object.keys(latestCheck.sources);
  const totalHealthy = sourceNames.filter(n => latestCheck.sources[n].status === 'healthy').length;
  const overallStatus = totalHealthy === sourceNames.length ? 'ALL SYSTEMS GO' :
    totalHealthy > sourceNames.length / 2 ? 'DEGRADED' : 'CRITICAL';
  const statusColor = overallStatus === 'ALL SYSTEMS GO' ? '#00ff88' :
    overallStatus === 'DEGRADED' ? '#ffcc00' : '#ff4444';

  const sourceRows = sourceNames.map(name => {
    const s = latestCheck.sources[name];
    const statusDot = s.status === 'healthy' ? '🟢' : s.status === 'empty' ? '🟡' : '🔴';
    const latency = s.latency_ms < 500 ? `${s.latency_ms}ms` : s.latency_ms < 2000 ? `${s.latency_ms}ms ⚠` : `${s.latency_ms}ms 🐌`;

    // Build sparkline from history (last 10 checks)
    const sparkline = history.slice(0, 10).reverse().map(h => {
      const src = h.sources?.[name];
      if (!src) return '·';
      return src.status === 'healthy' ? '▪' : src.status === 'empty' ? '○' : '✗';
    }).join('');

    return `
      <tr>
        <td class="source-name">${statusDot} ${name}</td>
        <td class="status ${s.status}">${s.status.toUpperCase()}</td>
        <td class="count">${s.count ?? '—'}</td>
        <td class="latency">${latency}</td>
        <td class="sparkline">${sparkline}</td>
      </tr>
    `;
  }).join('');

  const checkedAt = new Date(latestCheck.checked_at).toUTCString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal — Source Health</title>
  <meta http-equiv="refresh" content="300">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0f;
      color: #e2e2f0;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
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
    .logo { font-size: 11px; letter-spacing: 4px; color: #666680; margin-bottom: 8px; }
    .logo span { color: #00ff88; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .overall {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 4px;
      font-size: 12px;
      letter-spacing: 2px;
      font-weight: bold;
      color: ${statusColor};
      border: 1px solid ${statusColor}44;
      background: ${statusColor}11;
    }
    .subtitle { color: #666680; font-size: 11px; margin-top: 8px; }
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
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    thead tr { border-bottom: 1px solid #1e1e2e; }
    th { font-size: 10px; letter-spacing: 2px; color: #666680; text-align: left; padding: 8px 12px; }
    td { padding: 14px 12px; border-bottom: 1px solid #12121a; vertical-align: middle; }
    tr:hover td { background: #12121a; }
    td.source-name { font-weight: bold; }
    td.status.healthy { color: #00ff88; }
    td.status.empty { color: #ffcc00; }
    td.status.error { color: #ff4444; }
    td.count { color: #6c63ff; }
    td.latency { color: #888; font-size: 12px; }
    td.sparkline { font-size: 16px; color: #444460; letter-spacing: 2px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat {
      background: #12121a;
      border: 1px solid #1e1e2e;
      border-radius: 4px;
      padding: 16px;
      text-align: center;
    }
    .stat .val { font-size: 28px; color: #6c63ff; font-weight: bold; }
    .stat .lbl { font-size: 10px; letter-spacing: 2px; color: #666680; margin-top: 4px; }
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
    <h1>Source Health Dashboard</h1>
    <div class="overall">${overallStatus}</div>
    <div class="subtitle">Last checked: ${checkedAt} · Auto-refreshes every 5 min</div>
  </header>
  <main class="main">
    <div class="nav"><a href="/">← Today's brief</a> · <a href="/archive/">Archive</a></div>

    <div class="stats-grid">
      <div class="stat">
        <div class="val">${totalHealthy}/${sourceNames.length}</div>
        <div class="lbl">Sources Healthy</div>
      </div>
      <div class="stat">
        <div class="val">${sourceNames.reduce((s, n) => s + (latestCheck.sources[n].count || 0), 0)}</div>
        <div class="lbl">Items Fetched</div>
      </div>
      <div class="stat">
        <div class="val">${latestCheck.total_ms}ms</div>
        <div class="lbl">Total Check Time</div>
      </div>
    </div>

    <div class="section-label">Data Sources</div>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Status</th>
          <th>Items</th>
          <th>Latency</th>
          <th>History (10 runs)</th>
        </tr>
      </thead>
      <tbody>${sourceRows}</tbody>
    </table>

    <div class="section-label">Legend</div>
    <p style="color:#666680;font-size:12px;">▪ Healthy &nbsp;·&nbsp; ○ Empty (0 items) &nbsp;·&nbsp; ✗ Error &nbsp;·&nbsp; · No data</p>
  </main>
  <footer>SIGNAL — Autonomous AI tech curation · Source health auto-checked every hour</footer>
</body>
</html>`;
}

// Standalone runner
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const check = await checkSourceHealth();
  let history = [];
  if (fs.existsSync(HEALTH_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8')); } catch {}
  }
  const html = renderHealthPage(check, history);
  const outPath = path.join(__dirname, 'public', 'health.html');
  fs.writeFileSync(outPath, html);
  console.log(`[Health] Dashboard written to ${outPath}`);
}
