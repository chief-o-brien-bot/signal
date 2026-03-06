/**
 * Signal: Share Pack Generator
 * For each issue, generates pre-written sharing templates for:
 * - Hacker News (Show HN post)
 * - Reddit (r/programming, r/MachineLearning)
 * - Twitter/X
 * - LinkedIn
 *
 * Output: public/share/issue-{N}.json + public/share/issue-{N}.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function generateSharePack(issueData) {
  const { issue, date, briefing } = issueData;
  const { headline, theme, top_stories = [], one_liner, build_idea } = briefing;

  const issueUrl = `https://chief-o-brien-bot.github.io/signal/archive/issue-${issue}.html`;
  const siteUrl = `https://chief-o-brien-bot.github.io/signal/`;

  // Format date nicely
  const dateFormatted = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  // Top 3 story bullets
  const topBullets = top_stories.slice(0, 3)
    .map(s => `• ${s.title}`)
    .join('\n');

  // --- HN Show HN ---
  const hnTitle = `Show HN: Signal Issue #${issue} — ${theme} (${dateFormatted})`;
  const hnBody = `Signal is an autonomous AI that reads HN, Lobsters, Reddit, arXiv, TechCrunch, The Verge and 8 other sources every hour — then distills it all to 5 signal stories worth your attention.

Issue #${issue} theme: ${theme}

${topBullets}

Live at: ${issueUrl}

The whole site is AI-generated end-to-end. New issue every hour. Full archive + search + weekly digest. Would love feedback on the curation quality.`;

  // --- Reddit r/programming ---
  const redditProgTitle = `Signal Issue #${issue}: ${headline}`;
  const redditProgBody = `Signal is an AI-curated tech briefing that reads HN, Reddit, arXiv, Lobsters, TechCrunch and more — then picks the 5 stories that actually matter.

**Issue #${issue} — ${theme}**

${topBullets}

Full issue: ${issueUrl}

It also has a weekly digest, full-text search across all issues, and OG images. New issue every hour. Open to feedback on the curation.`;

  // --- Reddit r/MachineLearning ---
  const redditMLTitle = `Signal: AI-curated ML/AI digest — Issue #${issue}`;
  const redditMLBody = `Signal is an autonomous AI briefing that monitors arXiv (cs.AI, cs.LG, cs.SE) + HN + tech media and surfaces the most important signal.

**Today's theme: ${theme}**

${topBullets}

${briefing.arxiv_pick ? `**arXiv pick:** ${briefing.arxiv_pick.title}\n${briefing.arxiv_pick.why_it_matters}` : ''}

Read it: ${issueUrl}`;

  // --- Twitter/X thread ---
  const twitterThread = [
    `🔔 Signal #${issue}: ${headline}\n\nTheme: ${theme} 👇`,
    ...top_stories.slice(0, 3).map((s, i) =>
      `${i + 1}/ ${s.title}\n\nWhy it matters: ${s.why_it_matters?.slice(0, 200) || ''}\n${s.url}`
    ),
    build_idea ? `💡 Build idea: ${build_idea}\n\nFull brief + all ${issue} issues: ${siteUrl}` :
      `📬 Full brief + archive: ${siteUrl}\n\nNew issue every hour. Free.`,
  ];

  // --- LinkedIn post ---
  const linkedinPost = `📡 Signal Issue #${issue}: ${theme}

${headline}

Top stories worth your attention today:

${top_stories.slice(0, 5).map((s, i) =>
  `${i + 1}. ${s.title}\n   ${s.why_it_matters?.slice(0, 150) || ''}`
).join('\n\n')}

${build_idea ? `💡 Build idea of the day: ${build_idea}\n\n` : ''}Signal is an autonomous AI-curated tech briefing. New issue every hour. Free.

Read it: ${issueUrl}

#TechNews #AI #MachineLearning #Programming #SoftwareDevelopment`;

  const sharePack = {
    issue,
    date,
    theme,
    headline,
    issue_url: issueUrl,
    generated_at: new Date().toISOString(),
    platforms: {
      hacker_news: {
        title: hnTitle,
        body: hnBody,
        submit_url: 'https://news.ycombinator.com/submitlink?u=' + encodeURIComponent(issueUrl) + '&t=' + encodeURIComponent(hnTitle),
      },
      reddit_programming: {
        title: redditProgTitle,
        body: redditProgBody,
        submit_url: 'https://www.reddit.com/r/programming/submit?title=' + encodeURIComponent(redditProgTitle),
      },
      reddit_machinelearning: {
        title: redditMLTitle,
        body: redditMLBody,
        submit_url: 'https://www.reddit.com/r/MachineLearning/submit?title=' + encodeURIComponent(redditMLTitle),
      },
      twitter_thread: {
        tweets: twitterThread,
        first_tweet_url: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(twitterThread[0]),
      },
      linkedin: {
        post: linkedinPost,
      },
    },
  };

  return sharePack;
}

export function renderSharePackHTML(sharePack) {
  const { issue, theme, headline, issue_url, platforms } = sharePack;
  const p = platforms;

  const copyBtn = (id, text) => `
    <button class="copy-btn" onclick="copyText('${id}')">Copy</button>
    <textarea id="${id}" readonly>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Pack — Signal Issue #${issue}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d1117;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.6;
      padding: 0 0 80px;
    }
    a { color: #6c63ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    header {
      border-bottom: 1px solid #21262d;
      padding: 24px;
      text-align: center;
    }
    .logo { font-size: 11px; letter-spacing: 4px; color: #666; margin-bottom: 8px; }
    .logo span { color: #00ff88; }
    h1 { font-size: 22px; margin-bottom: 6px; }
    .subtitle { color: #8b949e; font-size: 13px; }
    .main { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
    .nav { margin-bottom: 28px; font-size: 13px; color: #8b949e; }
    .platform {
      background: #161b22;
      border: 1px solid #21262d;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .platform-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .platform-name {
      font-size: 13px;
      letter-spacing: 2px;
      color: #8b949e;
      text-transform: uppercase;
      font-weight: bold;
    }
    .platform-name .icon { margin-right: 8px; }
    .submit-link {
      font-size: 12px;
      background: #21262d;
      padding: 6px 14px;
      border-radius: 4px;
      color: #00ff88;
      border: 1px solid #00ff8844;
    }
    .submit-link:hover { background: #00ff8822; text-decoration: none; }
    .field { margin-bottom: 16px; }
    .field-label { font-size: 11px; letter-spacing: 2px; color: #666; margin-bottom: 6px; text-transform: uppercase; }
    textarea {
      width: 100%;
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 4px;
      color: #e6edf3;
      padding: 12px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      resize: vertical;
      min-height: 100px;
    }
    textarea:focus { outline: none; border-color: #6c63ff; }
    .copy-btn {
      float: right;
      background: #21262d;
      border: 1px solid #30363d;
      color: #e6edf3;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .copy-btn:hover { background: #30363d; }
    .copy-btn.copied { color: #00ff88; border-color: #00ff8844; }
    .tweets .tweet {
      background: #0d1117;
      border: 1px solid #21262d;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 8px;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .tweet-num { color: #6c63ff; font-size: 11px; font-weight: bold; margin-bottom: 4px; }
    footer {
      border-top: 1px solid #21262d;
      padding: 20px;
      text-align: center;
      color: #333;
      font-size: 11px;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo"><span>◈</span> SIGNAL</div>
    <h1>Share Pack — Issue #${issue}</h1>
    <div class="subtitle">${theme}: "${headline}"</div>
  </header>
  <main class="main">
    <div class="nav">
      <a href="${issue_url}">← Read Issue #${issue}</a> ·
      <a href="/">Today's brief</a> ·
      <a href="/archive/">Archive</a>
    </div>

    <p style="color:#8b949e;font-size:13px;margin-bottom:28px;">
      Pre-written posts for sharing this issue. Click "Copy" to grab the text, then click the submit link to open the platform.
    </p>

    <!-- Hacker News -->
    <div class="platform">
      <div class="platform-header">
        <div class="platform-name"><span class="icon">🟠</span> Hacker News (Show HN)</div>
        <a href="${p.hacker_news.submit_url}" target="_blank" rel="noopener" class="submit-link">Submit to HN →</a>
      </div>
      <div class="field">
        <div class="field-label">Title</div>
        <button class="copy-btn" onclick="copyText('hn-title')">Copy</button>
        <textarea id="hn-title" rows="2">${p.hacker_news.title}</textarea>
      </div>
      <div class="field">
        <div class="field-label">Body text (paste in "text" box)</div>
        <button class="copy-btn" onclick="copyText('hn-body')">Copy</button>
        <textarea id="hn-body" rows="10">${p.hacker_news.body}</textarea>
      </div>
    </div>

    <!-- Reddit r/programming -->
    <div class="platform">
      <div class="platform-header">
        <div class="platform-name"><span class="icon">🔵</span> Reddit — r/programming</div>
        <a href="${p.reddit_programming.submit_url}" target="_blank" rel="noopener" class="submit-link">Submit to Reddit →</a>
      </div>
      <div class="field">
        <div class="field-label">Title</div>
        <button class="copy-btn" onclick="copyText('reddit-prog-title')">Copy</button>
        <textarea id="reddit-prog-title" rows="2">${p.reddit_programming.title}</textarea>
      </div>
      <div class="field">
        <div class="field-label">Body (for self post)</div>
        <button class="copy-btn" onclick="copyText('reddit-prog-body')">Copy</button>
        <textarea id="reddit-prog-body" rows="10">${p.reddit_programming.body}</textarea>
      </div>
    </div>

    <!-- Reddit r/MachineLearning -->
    <div class="platform">
      <div class="platform-header">
        <div class="platform-name"><span class="icon">🔴</span> Reddit — r/MachineLearning</div>
        <a href="${p.reddit_machinelearning.submit_url}" target="_blank" rel="noopener" class="submit-link">Submit to Reddit →</a>
      </div>
      <div class="field">
        <div class="field-label">Title</div>
        <button class="copy-btn" onclick="copyText('reddit-ml-title')">Copy</button>
        <textarea id="reddit-ml-title" rows="2">${p.reddit_machinelearning.title}</textarea>
      </div>
      <div class="field">
        <div class="field-label">Body</div>
        <button class="copy-btn" onclick="copyText('reddit-ml-body')">Copy</button>
        <textarea id="reddit-ml-body" rows="10">${p.reddit_machinelearning.body}</textarea>
      </div>
    </div>

    <!-- Twitter/X -->
    <div class="platform">
      <div class="platform-header">
        <div class="platform-name"><span class="icon">𝕏</span> Twitter / X (thread)</div>
        <a href="${p.twitter_thread.first_tweet_url}" target="_blank" rel="noopener" class="submit-link">Start thread →</a>
      </div>
      <div class="tweets">
        ${p.twitter_thread.tweets.map((t, i) => `
          <div>
            <div class="tweet-num">Tweet ${i + 1}/${p.twitter_thread.tweets.length}</div>
            <button class="copy-btn" onclick="copyText('tweet-${i}')">Copy</button>
            <textarea id="tweet-${i}" rows="4">${t}</textarea>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- LinkedIn -->
    <div class="platform">
      <div class="platform-header">
        <div class="platform-name"><span class="icon">💼</span> LinkedIn</div>
        <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(issue_url)}" target="_blank" rel="noopener" class="submit-link">Share on LinkedIn →</a>
      </div>
      <div class="field">
        <div class="field-label">Post text</div>
        <button class="copy-btn" onclick="copyText('linkedin-post')">Copy</button>
        <textarea id="linkedin-post" rows="14">${p.linkedin.post}</textarea>
      </div>
    </div>
  </main>
  <footer>SIGNAL — Autonomous AI tech curation · Issue #${issue}</footer>
  <script>
    function copyText(id) {
      const el = document.getElementById(id);
      el.select();
      document.execCommand('copy');
      const btn = el.previousElementSibling;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    }
  </script>
</body>
</html>`;
}

export function buildSharePacks() {
  const archiveDir = path.join(__dirname, 'public', 'archive');
  const shareDir = path.join(__dirname, 'public', 'share');
  fs.mkdirSync(shareDir, { recursive: true });

  // Build share pack for every issue
  const files = fs.readdirSync(archiveDir).filter(f => f.match(/^issue-\d+\.json$/));
  let built = 0;

  for (const file of files) {
    try {
      const issueData = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
      const issueNum = issueData.issue;

      const pack = generateSharePack(issueData);
      const jsonPath = path.join(shareDir, `issue-${issueNum}.json`);
      const htmlPath = path.join(shareDir, `issue-${issueNum}.html`);

      fs.writeFileSync(jsonPath, JSON.stringify(pack, null, 2));
      fs.writeFileSync(htmlPath, renderSharePackHTML(pack));
      built++;
    } catch (e) {
      console.warn(`[SharePack] Skipping ${file}:`, e.message);
    }
  }

  console.log(`[SharePack] Built ${built} share packs → public/share/`);
  return built;
}

// Standalone runner
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  buildSharePacks();
}
