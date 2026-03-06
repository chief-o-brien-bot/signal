/**
 * Signal: Weekly Digest Generator
 * Aggregates the best stories from the past 7 issues into a "Week in Review" special.
 * Run manually or via cron every Friday/Sunday.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PUBLIC_DIR = path.join(__dirname, 'public');
const ARCHIVE_DIR = path.join(PUBLIC_DIR, 'archive');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getWeeklyDigestNumber() {
  const weeklyCountFile = path.join(__dirname, 'weekly_count.txt');
  if (!existsSync(weeklyCountFile)) {
    writeFileSync(weeklyCountFile, '0');
  }
  const count = parseInt(readFileSync(weeklyCountFile, 'utf8').trim()) + 1;
  writeFileSync(weeklyCountFile, String(count));
  return count;
}

// ─── Load all available issues ────────────────────────────────────────────────

function loadAllIssues() {
  const issues = [];
  const recoveredFile = path.join(__dirname, 'recovered_issues.json');

  // First, try the recovered issues file (built from git history)
  if (existsSync(recoveredFile)) {
    const recovered = JSON.parse(readFileSync(recoveredFile, 'utf8'));
    for (const issue of recovered) {
      if (issue.top_stories && issue.top_stories.length > 0) {
        issues.push(issue);
      }
    }
    console.log(`[Weekly] Loaded ${issues.length} issues from recovered_issues.json`);
    return issues;
  }

  // Fallback: scan archive directory
  const files = readdirSync(ARCHIVE_DIR).filter(f => f.startsWith('issue-') && f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(path.join(ARCHIVE_DIR, file), 'utf8'));
      const briefing = data.briefing || {};
      if (briefing.top_stories && briefing.top_stories.length > 0) {
        issues.push({ issue: data.issue, date: data.date, ...briefing });
      }
    } catch (e) { /* skip */ }
  }
  return issues;
}

// ─── OpenAI: pick best-of-week ────────────────────────────────────────────────

async function generateWeeklyBriefing(issues, weekNumber, dateRange) {
  // Collect all stories with issue context
  const allStories = [];
  for (const issue of issues) {
    for (const story of (issue.top_stories || [])) {
      allStories.push({ ...story, issue_num: issue.issue, issue_date: issue.date });
    }
  }

  const storiesText = allStories.map((s, i) =>
    `${i+1}. [Issue #${s.issue_num}, ${s.issue_date}] ${s.title}\n   Why it matters: ${s.why_it_matters}\n   Signal: ${s.signal_strength}\n   URL: ${s.url}`
  ).join('\n\n');

  const arxivPicks = issues.map(i => i.arxiv_pick).filter(Boolean);
  const arxivText = arxivPicks.map((p, i) =>
    `${i+1}. ${p.title} — ${p.why_it_matters}`
  ).join('\n');

  const githubPicks = issues.map(i => i.github_spotlight).filter(Boolean);
  const githubText = githubPicks.map((p, i) =>
    `${i+1}. ${p.name} — ${p.why_interesting}`
  ).join('\n');

  const themes = issues.map(i => i.theme).filter(Boolean);
  const buildIdeas = issues.map(i => i.build_idea).filter(Boolean);

  const prompt = `You are Signal — an autonomous AI weekly digest curator.

Here are all ${allStories.length} stories from Signal Issues #${issues[0]?.issue}–#${issues[issues.length-1]?.issue} (${dateRange}):

${storiesText}

arXiv picks of the week:
${arxivText}

GitHub spotlights of the week:
${githubText}

Weekly themes across issues: ${themes.join(', ')}

Build ideas this week:
${buildIdeas.map((b,i) => `${i+1}. ${b}`).join('\n')}

Your task: Produce a "Week in Review" digest — the definitive summary of what mattered most in tech this week.

Return JSON with this exact structure:
{
  "week_headline": "One powerful sentence capturing the most important thing that happened in tech this week",
  "week_theme": "The dominant narrative of the week (3-5 words)",
  "executive_summary": "2-3 sentence paragraph summarizing the week for a senior engineer or technical founder. Sharp, opinionated, no fluff.",
  "top_stories": [
    {
      "rank": 1,
      "title": "story title",
      "why_it_matters": "2-3 sentences — more depth than daily briefings. This is the weekly record.",
      "signal_strength": "high|medium|low",
      "source": "hn|lobsters|devto",
      "url": "url",
      "discussion_url": "discussion url",
      "issue_num": 7
    }
  ],
  "best_github_spotlight": {
    "name": "repo name",
    "why_interesting": "2-3 sentence weekly take",
    "url": "github url"
  },
  "best_arxiv_pick": {
    "title": "paper title",
    "why_it_matters": "2-3 sentence take on why this research will matter",
    "category": "cs.AI|cs.LG|cs.SE",
    "url": "arxiv url"
  },
  "weekly_build_idea": "One ambitious thing a team could build this week, synthesizing the week's signal",
  "recurring_signal": "The pattern that kept appearing across the week — what does it mean for the next 6 months?",
  "one_liner": "A single tweet-worthy sentence capturing the entire week (<280 chars)"
}

Pick the 7 most important stories of the week. Prioritize HIGH signal stories. Where stories are similar (like multiple Wikipedia breach stories), pick the one with the most depth. Be a discerning editor. Return ONLY the JSON object, no markdown fences.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}

// ─── HTML Renderer ────────────────────────────────────────────────────────────

function renderWeeklyHTML(digest, weekNumber, dateRange, issueRange) {
  const signalColors = { high: '#00ff88', medium: '#ffcc00', low: '#888888' };
  const signalLabels = { high: '▲ HIGH SIGNAL', medium: '◆ SIGNAL', low: '◇ LOW' };

  const storiesHTML = (digest.top_stories || []).map(story => `
    <article class="story ${story.signal_strength}">
      <div class="story-meta">
        <span class="signal-badge" style="color: ${signalColors[story.signal_strength] || '#888'}">
          ${signalLabels[story.signal_strength] || '◇'}
        </span>
        <span class="rank">#${story.rank}</span>
        <span class="issue-tag">Issue #${story.issue_num || '—'}</span>
      </div>
      <h3><a href="${escapeHtml(story.url)}" target="_blank" rel="noopener">${escapeHtml(story.title)}</a></h3>
      <p class="take">${escapeHtml(story.why_it_matters)}</p>
      <a class="hn-link" href="${escapeHtml(story.discussion_url)}" target="_blank" rel="noopener">→ discuss on ${story.source === 'lobsters' ? 'Lobste.rs' : story.source === 'devto' ? 'Dev.to' : 'HN'}</a>
    </article>
  `).join('');

  const githubHTML = digest.best_github_spotlight ? `
    <section class="github-spotlight">
      <div class="section-label">GITHUB SPOTLIGHT OF THE WEEK</div>
      <h3><a href="${escapeHtml(digest.best_github_spotlight.url)}" target="_blank" rel="noopener">${escapeHtml(digest.best_github_spotlight.name)}</a></h3>
      <p>${escapeHtml(digest.best_github_spotlight.why_interesting)}</p>
    </section>
  ` : '';

  const arxivHTML = digest.best_arxiv_pick ? `
    <section class="arxiv-pick">
      <div class="section-label">RESEARCH SIGNAL OF THE WEEK — arXiv</div>
      <h3><a href="${escapeHtml(digest.best_arxiv_pick.url)}" target="_blank" rel="noopener">${escapeHtml(digest.best_arxiv_pick.title)}</a></h3>
      <p>${escapeHtml(digest.best_arxiv_pick.why_it_matters)}</p>
      <span class="arxiv-cat">${escapeHtml(digest.best_arxiv_pick.category || 'cs.AI')}</span>
    </section>
  ` : '';

  const recurringHTML = digest.recurring_signal ? `
    <section class="recurring-signal">
      <div class="section-label">RECURRING SIGNAL THIS WEEK</div>
      <p>${escapeHtml(digest.recurring_signal)}</p>
    </section>
  ` : '';

  const buildHTML = digest.weekly_build_idea ? `
    <section class="build-idea">
      <div class="section-label">BUILD THIS WEEK</div>
      <p>${escapeHtml(digest.weekly_build_idea)}</p>
    </section>
  ` : '';

  const ghPagesBase = 'https://chief-o-brien-bot.github.io/signal';
  const weeklyUrl = `${ghPagesBase}/archive/weekly-${weekNumber}.html`;
  const shareText = encodeURIComponent(`${escapeHtml(digest.week_headline)} — Signal Week ${weekNumber} digest`);
  const shareUrl = encodeURIComponent(weeklyUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signal Week ${weekNumber}: ${escapeHtml(digest.week_theme)} | ${dateRange}</title>
  <meta name="description" content="${escapeHtml(digest.week_headline)}">
  <meta property="og:title" content="Signal Week ${weekNumber}: ${escapeHtml(digest.week_theme)}">
  <meta property="og:description" content="${escapeHtml(digest.week_headline)}">
  <meta property="og:url" content="${weeklyUrl}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Signal Week ${weekNumber}: ${escapeHtml(digest.week_theme)}">
  <meta name="twitter:description" content="${escapeHtml(digest.week_headline)}">
  <link rel="canonical" href="${weeklyUrl}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }

    .header { border-bottom: 1px solid #222; padding-bottom: 2rem; margin-bottom: 2rem; }
    .weekly-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 0.65rem;
      font-weight: bold;
      letter-spacing: 0.1em;
      padding: 0.25rem 0.6rem;
      border-radius: 3px;
      margin-bottom: 1rem;
    }
    .issue-meta { font-size: 0.75rem; color: #666; margin-top: 0.5rem; }
    h1 { font-size: 1.6rem; font-weight: 700; color: #fff; line-height: 1.3; margin: 0.5rem 0; }
    .date-range { color: #888; font-size: 0.8rem; margin-bottom: 0.5rem; }
    .week-theme { color: #667eea; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: bold; margin-bottom: 0.75rem; }

    .exec-summary {
      background: #0f1117;
      border: 1px solid #1e2030;
      border-left: 3px solid #667eea;
      padding: 1.25rem;
      margin: 1.5rem 0;
      border-radius: 4px;
    }
    .exec-summary .section-label { color: #667eea; font-size: 0.7rem; letter-spacing: 0.1em; font-weight: bold; margin-bottom: 0.5rem; }
    .exec-summary p { color: #ccc; font-size: 0.9rem; }

    .stories-section h2 { color: #fff; font-size: 0.8rem; letter-spacing: 0.1em; margin-bottom: 1rem; color: #888; }
    .story { border: 1px solid #1a1a1a; border-radius: 6px; padding: 1.25rem; margin-bottom: 1rem; background: #0d0d0d; }
    .story.high { border-left: 3px solid #00ff88; }
    .story.medium { border-left: 3px solid #ffcc00; }
    .story-meta { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .signal-badge { font-size: 0.65rem; font-weight: bold; letter-spacing: 0.05em; }
    .rank { color: #555; font-size: 0.75rem; }
    .issue-tag { color: #667eea; font-size: 0.65rem; background: #1a1a2e; padding: 0.15rem 0.4rem; border-radius: 3px; }
    .story h3 { margin-bottom: 0.5rem; }
    .story h3 a { color: #e0e0e0; text-decoration: none; font-size: 0.95rem; }
    .story h3 a:hover { color: #fff; text-decoration: underline; }
    .take { color: #aaa; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .hn-link { font-size: 0.75rem; color: #666; text-decoration: none; }
    .hn-link:hover { color: #aaa; }

    .section-label { font-size: 0.7rem; letter-spacing: 0.1em; font-weight: bold; color: #888; margin-bottom: 0.75rem; text-transform: uppercase; }

    .github-spotlight, .arxiv-pick, .build-idea, .recurring-signal {
      background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 6px; padding: 1.25rem; margin: 1rem 0;
    }
    .github-spotlight { border-left: 3px solid #333; }
    .github-spotlight h3 a, .arxiv-pick h3 a { color: #e0e0e0; text-decoration: none; font-size: 0.95rem; }
    .github-spotlight h3 a:hover, .arxiv-pick h3 a:hover { text-decoration: underline; }
    .github-spotlight p, .arxiv-pick p, .build-idea p, .recurring-signal p { color: #aaa; font-size: 0.85rem; margin-top: 0.5rem; }
    .arxiv-pick { border-left: 3px solid #4a90d9; }
    .arxiv-pick .section-label { color: #4a90d9; }
    .arxiv-cat { display: inline-block; font-size: 0.7rem; color: #4a90d9; background: #0a1628; padding: 0.2rem 0.5rem; border-radius: 3px; margin-top: 0.5rem; }
    .build-idea { border-left: 3px solid #ff6b6b; }
    .build-idea .section-label { color: #ff6b6b; }
    .recurring-signal { border-left: 3px solid #667eea; }
    .recurring-signal .section-label { color: #667eea; }

    .one-liner-box {
      background: #111; border: 1px dashed #333; border-radius: 6px; padding: 1.25rem; margin: 1.5rem 0;
    }
    .one-liner-box .section-label { color: #555; }
    .one-liner-box p { color: #ccc; font-size: 0.9rem; font-style: italic; }

    .share-row { display: flex; gap: 0.75rem; margin: 1.5rem 0; flex-wrap: wrap; }
    .share-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
    .share-x { background: #000; color: #fff; border: 1px solid #333; }
    .share-x:hover { background: #111; }
    .share-li { background: #0a66c2; color: #fff; }
    .share-li:hover { background: #0958a8; }

    .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 0; border-top: 1px solid #1a1a1a; margin-top: 2rem; }
    .nav-bar a { color: #667eea; text-decoration: none; font-size: 0.8rem; }
    .nav-bar a:hover { text-decoration: underline; }

    .footer { text-align: center; padding: 2rem 0; color: #444; font-size: 0.75rem; border-top: 1px solid #111; margin-top: 2rem; }
    .footer a { color: #555; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="weekly-badge">✦ WEEK IN REVIEW — ISSUE #${issueRange}</div>
      <p class="date-range">${dateRange}</p>
      <div class="week-theme">This week: ${escapeHtml(digest.week_theme)}</div>
      <h1>${escapeHtml(digest.week_headline)}</h1>
      <div class="issue-meta">Signal Weekly Digest #${weekNumber} · ${(digest.top_stories || []).length} stories curated from ${issueRange.split('–')[1] ? parseInt(issueRange.split('–')[1]) - parseInt(issueRange.split('#')[1]) + 1 : 7} daily issues</div>
    </div>

    <div class="exec-summary">
      <div class="section-label">EXECUTIVE SUMMARY</div>
      <p>${escapeHtml(digest.executive_summary)}</p>
    </div>

    <section class="stories-section">
      <h2>TOP STORIES OF THE WEEK</h2>
      ${storiesHTML}
    </section>

    ${recurringHTML}
    ${githubHTML}
    ${arxivHTML}
    ${buildHTML}

    <div class="one-liner-box">
      <div class="section-label">THE WEEK IN ONE LINE</div>
      <p>${escapeHtml(digest.one_liner)}</p>
    </div>

    <div class="share-row">
      <a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Share on X
      </a>
      <a class="share-btn share-li" href="https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareText}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        Share on LinkedIn
      </a>
    </div>

    <div class="nav-bar">
      <a href="../index.html">← Back to Signal</a>
      <a href="index.html">Archive →</a>
    </div>

    <div class="footer">
      <p>Signal · AI-curated tech briefings · <a href="https://chief-o-brien-bot.github.io/signal/">chief-o-brien-bot.github.io/signal</a></p>
      <p style="margin-top:0.5rem">Weekly digest generated autonomously · ${new Date().toISOString().slice(0,10)}</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[Weekly] Starting weekly digest generation...');

  const issues = loadAllIssues();
  if (issues.length === 0) {
    console.error('[Weekly] No issues found. Aborting.');
    process.exit(1);
  }

  const sortedIssues = issues.sort((a, b) => a.issue - b.issue);
  const firstIssue = sortedIssues[0];
  const lastIssue = sortedIssues[sortedIssues.length - 1];
  const dateRange = `${firstIssue.date} – ${lastIssue.date}`;
  const issueRange = `#${firstIssue.issue}–#${lastIssue.issue}`;

  console.log(`[Weekly] Aggregating ${issues.length} issues (${issueRange}, ${dateRange})`);

  const weekNumber = getWeeklyDigestNumber();
  console.log(`[Weekly] This is Weekly Digest #${weekNumber}`);

  console.log('[Weekly] Calling OpenAI for weekly curation...');
  const digest = await generateWeeklyBriefing(sortedIssues, weekNumber, dateRange);
  console.log(`[Weekly] Theme: ${digest.week_theme}`);
  console.log(`[Weekly] Stories selected: ${digest.top_stories?.length || 0}`);

  // Render HTML
  const html = renderWeeklyHTML(digest, weekNumber, dateRange, issueRange);

  // Save files
  const weeklyHtmlPath = path.join(ARCHIVE_DIR, `weekly-${weekNumber}.html`);
  const weeklyJsonPath = path.join(ARCHIVE_DIR, `weekly-${weekNumber}.json`);

  writeFileSync(weeklyHtmlPath, html);
  writeFileSync(weeklyJsonPath, JSON.stringify({
    type: 'weekly',
    week_number: weekNumber,
    date_range: dateRange,
    issue_range: issueRange,
    generated_at: new Date().toISOString(),
    digest,
  }, null, 2));

  console.log(`[Weekly] Saved: archive/weekly-${weekNumber}.html`);
  console.log(`[Weekly] Saved: archive/weekly-${weekNumber}.json`);

  // Update archive index
  await updateArchiveIndex(weekNumber, dateRange, digest);

  // Update sitemap
  await updateSitemap(weekNumber);

  // Deploy to GitHub Pages
  console.log('[Weekly] Deploying to GitHub Pages...');
  try {
    execSync('bash deploy-gh-pages.sh', { cwd: __dirname, stdio: 'inherit' });
    console.log('[Weekly] Deployed to GitHub Pages.');
  } catch (e) {
    console.error('[Weekly] GH Pages deploy failed:', e.message);
  }

  // Send Telegram notification
  await sendTelegramWeekly(digest, weekNumber, dateRange);

  console.log('[Weekly] Done.');
  return { weekNumber, digest };
}

async function updateArchiveIndex(weekNumber, dateRange, digest) {
  const indexPath = path.join(ARCHIVE_DIR, 'index.html');
  let indexHtml = '';
  if (existsSync(indexPath)) {
    indexHtml = readFileSync(indexPath, 'utf8');
  }

  const weeklyEntry = `
    <li class="weekly-entry">
      <a href="weekly-${weekNumber}.html">
        <span class="weekly-tag">WEEKLY #${weekNumber}</span>
        ${escapeHtml(dateRange)} — ${escapeHtml(digest.week_theme)}
      </a>
    </li>`;

  // Insert after <ul class="archive-list"> or similar — simple approach: prepend to list
  if (indexHtml.includes('<ul') && indexHtml.includes('<li')) {
    indexHtml = indexHtml.replace(/<ul([^>]*)>/, `<ul$1>${weeklyEntry}`);
    writeFileSync(indexPath, indexHtml);
    console.log('[Weekly] Updated archive index.');
  }
}

async function updateSitemap(weekNumber) {
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  if (!existsSync(sitemapPath)) return;

  let sitemap = readFileSync(sitemapPath, 'utf8');
  const weeklyUrl = `https://chief-o-brien-bot.github.io/signal/archive/weekly-${weekNumber}.html`;
  const today = new Date().toISOString().slice(0, 10);
  const newEntry = `  <url><loc>${weeklyUrl}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;

  if (!sitemap.includes(weeklyUrl)) {
    sitemap = sitemap.replace('</urlset>', newEntry + '</urlset>');
    writeFileSync(sitemapPath, sitemap);
    console.log('[Weekly] Updated sitemap.');
  }
}

async function sendTelegramWeekly(digest, weekNumber, dateRange) {
  try {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
    if (!TELEGRAM_BOT_TOKEN || !GROUP_CHAT_ID) return;

    const ghPagesUrl = `https://chief-o-brien-bot.github.io/signal/archive/weekly-${weekNumber}.html`;
    const topStories = (digest.top_stories || []).slice(0, 5);
    const storiesText = topStories.map((s, i) =>
      `${i+1}. <a href="${s.url}">${s.title}</a>`
    ).join('\n');

    const message = `📅 <b>Signal Weekly Digest #${weekNumber}</b>
<i>${dateRange}</i>

<b>${digest.week_headline}</b>

<b>Theme:</b> ${digest.week_theme}

<b>Top stories this week:</b>
${storiesText}

<b>Recurring signal:</b> ${digest.recurring_signal || ''}

<a href="${ghPagesUrl}">→ Read the full week in review</a>`;

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: GROUP_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const result = await response.json();
    if (result.ok) {
      console.log('[Weekly] Telegram notification sent.');
    } else {
      console.error('[Weekly] Telegram failed:', result.description);
    }
  } catch (e) {
    console.error('[Weekly] Telegram error:', e.message);
  }
}

main().catch(console.error);
