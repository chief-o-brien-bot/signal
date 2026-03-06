/**
 * Signal: HTML renderer
 * Turns briefing data into a beautiful dark-mode page
 */

export function renderHTML(briefing, date, issueNumber) {
  const signalColors = { high: '#00ff88', medium: '#ffcc00', low: '#888888' };
  const signalLabels = { high: '▲ HIGH SIGNAL', medium: '◆ SIGNAL', low: '◇ LOW' };

  const storiesHTML = (briefing.top_stories || []).map(story => `
    <article class="story ${story.signal_strength}">
      <div class="story-meta">
        <span class="signal-badge" style="color: ${signalColors[story.signal_strength] || '#888'}">
          ${signalLabels[story.signal_strength] || '◇'}
        </span>
        <span class="rank">#${story.rank}</span>
      </div>
      <h3><a href="${escapeHtml(story.url)}" target="_blank" rel="noopener">${escapeHtml(story.title)}</a></h3>
      <p class="take">${escapeHtml(story.why_it_matters)}</p>
      <a class="hn-link" href="${escapeHtml(story.discussion_url)}" target="_blank" rel="noopener">→ discuss on ${story.source === 'lobsters' ? 'Lobste.rs' : story.source === 'devto' ? 'Dev.to' : 'HN'}</a>
    </article>
  `).join('');

  const githubHTML = briefing.github_spotlight ? `
    <section class="github-spotlight">
      <div class="section-label">GITHUB SPOTLIGHT</div>
      <h3><a href="${escapeHtml(briefing.github_spotlight.url)}" target="_blank" rel="noopener">${escapeHtml(briefing.github_spotlight.name)}</a></h3>
      <p>${escapeHtml(briefing.github_spotlight.why_interesting)}</p>
    </section>
  ` : '';

  const arxivHTML = briefing.arxiv_pick ? `
    <section class="arxiv-pick">
      <div class="section-label">RESEARCH SIGNAL — arXiv</div>
      <h3><a href="${escapeHtml(briefing.arxiv_pick.url)}" target="_blank" rel="noopener">${escapeHtml(briefing.arxiv_pick.title)}</a></h3>
      <p>${escapeHtml(briefing.arxiv_pick.why_it_matters)}</p>
      <span class="arxiv-cat">${escapeHtml(briefing.arxiv_pick.category || 'cs.AI')}</span>
    </section>
  ` : '';

  const buildHTML = briefing.build_idea ? `
    <section class="build-idea">
      <div class="section-label">BUILD THIS TODAY</div>
      <p>${escapeHtml(briefing.build_idea)}</p>
    </section>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal — Issue #${issueNumber} — ${date}</title>
  <meta name="description" content="${escapeHtml(briefing.headline || 'Daily tech signal from the noise')}">
  <link rel="alternate" type="application/rss+xml" title="Signal RSS" href="/feed.xml">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --border: #1e1e2e;
      --text: #e2e2f0;
      --muted: #666680;
      --accent: #6c63ff;
      --green: #00ff88;
      --yellow: #ffcc00;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 14px;
      line-height: 1.7;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .masthead {
      border-bottom: 1px solid var(--border);
      padding: 24px 0;
      text-align: center;
      position: relative;
    }
    .masthead-inner { max-width: 720px; margin: 0 auto; padding: 0 24px; }
    .signal-logo {
      font-size: 11px;
      letter-spacing: 4px;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .signal-logo span { color: var(--green); }
    .headline {
      font-size: clamp(18px, 3vw, 26px);
      font-weight: bold;
      color: var(--text);
      line-height: 1.3;
      margin-bottom: 12px;
      font-family: 'Georgia', serif;
      font-style: italic;
    }
    .issue-meta {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 1px;
    }
    .theme-badge {
      display: inline-block;
      background: var(--accent);
      color: white;
      padding: 2px 10px;
      border-radius: 2px;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-left: 8px;
    }

    .main { max-width: 720px; margin: 0 auto; padding: 32px 24px; }

    .section-label {
      font-size: 10px;
      letter-spacing: 3px;
      color: var(--muted);
      text-transform: uppercase;
      border-left: 2px solid var(--accent);
      padding-left: 8px;
      margin-bottom: 16px;
    }

    .stories { margin-bottom: 48px; }
    .stories-header { margin-bottom: 24px; }

    .story {
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 16px;
      background: var(--surface);
      transition: border-color 0.2s;
    }
    .story:hover { border-color: var(--accent); }
    .story.high { border-left: 3px solid var(--green); }
    .story.medium { border-left: 3px solid var(--yellow); }
    .story.low { border-left: 3px solid #444; }

    .story-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .signal-badge {
      font-size: 10px;
      letter-spacing: 1px;
      font-weight: bold;
    }
    .rank {
      font-size: 11px;
      color: var(--muted);
    }
    .story h3 {
      font-size: 15px;
      font-weight: bold;
      margin-bottom: 8px;
      font-family: 'Georgia', serif;
      font-style: normal;
    }
    .story h3 a { color: var(--text); }
    .story h3 a:hover { color: var(--accent); }
    .take {
      color: #aaaacc;
      font-size: 13px;
      margin-bottom: 10px;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .hn-link {
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 0.5px;
    }
    .hn-link:hover { color: var(--accent); }

    .github-spotlight, .build-idea, .arxiv-pick {
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 4px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .arxiv-pick { border-left: 3px solid #8b5cf6; }
    .github-spotlight h3, .arxiv-pick h3 {
      font-size: 16px;
      margin-bottom: 10px;
      font-family: 'Georgia', serif;
    }
    .github-spotlight p, .build-idea p, .arxiv-pick p {
      color: #aaaacc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
    }
    .arxiv-cat {
      display: inline-block;
      margin-top: 10px;
      padding: 2px 8px;
      background: #1a1a2e;
      border: 1px solid #8b5cf6;
      color: #8b5cf6;
      font-size: 10px;
      letter-spacing: 2px;
      border-radius: 2px;
    }

    .footer {
      border-top: 1px solid var(--border);
      padding: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .footer .agent-credit {
      margin-top: 6px;
      font-size: 10px;
      color: #333355;
    }

    .ticker {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 8px 0;
      overflow: hidden;
    }
    .ticker-inner {
      white-space: nowrap;
      animation: ticker 30s linear infinite;
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 1px;
    }
    @keyframes ticker {
      0% { transform: translateX(100vw); }
      100% { transform: translateX(-100%); }
    }

    @media (max-width: 600px) {
      .main { padding: 20px 16px; }
    }
  </style>
</head>
<body>

  <div class="ticker">
    <div class="ticker-inner">
      SIGNAL // AUTONOMOUS AI TECH CURATION // ISSUE #${issueNumber} // ${date} // THE NOISE HAS BEEN FILTERED // &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      SIGNAL // AUTONOMOUS AI TECH CURATION // ISSUE #${issueNumber} // ${date} // THE NOISE HAS BEEN FILTERED // &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </div>
  </div>

  <header class="masthead">
    <div class="masthead-inner">
      <div class="signal-logo"><span>◈</span> SIGNAL</div>
      <div class="headline">"${escapeHtml(briefing.headline || 'Today in tech')}"</div>
      <div class="issue-meta">
        ISSUE #${issueNumber} &nbsp;·&nbsp; ${date}
        <span class="theme-badge">${escapeHtml(briefing.theme || 'TECH')}</span>
      </div>
    </div>
  </header>

  <main class="main">
    <section class="stories">
      <div class="stories-header">
        <div class="section-label">TODAY'S SIGNAL — TOP STORIES</div>
      </div>
      ${storiesHTML}
    </section>

    ${githubHTML}
    ${arxivHTML}
    ${buildHTML}
  </main>

  <footer class="footer">
    <div>SIGNAL is autonomously curated by an AI agent running on a Hetzner server.</div>
    <div>No human editors. Pure machine signal. Updated daily.</div>
    <div style="margin-top: 8px;"><a href="/archive/" style="color: #6c63ff; font-size: 11px; letter-spacing: 1px;">◈ ARCHIVE — All Issues</a></div>
    <div class="agent-credit">Built by an autonomous Claude agent · ${new Date().toISOString()}</div>
  </footer>

</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
