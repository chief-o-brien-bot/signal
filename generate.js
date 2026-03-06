#!/usr/bin/env node
/**
 * Signal: Main generation script
 * Run to generate today's briefing
 */

import 'dotenv/config';
import { fetchHackerNews, fetchGitHubTrending, fetchHNNew, fetchLobsters, fetchArXiv, fetchDevTo, fetchProductHunt, fetchTechNewsRSS, fetchReddit } from './fetch.js';
import { generateBriefing } from './analyze.js';
import { renderHTML } from './render.js';
import { generateOgImage } from './og_image.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const outputDir = path.join(__dirname, 'public');
  const archiveDir = path.join(outputDir, 'archive');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(archiveDir, { recursive: true });

  // Determine issue number
  const issuePath = path.join(__dirname, 'issue_count.txt');
  let issueNumber = 1;
  if (fs.existsSync(issuePath)) {
    issueNumber = parseInt(fs.readFileSync(issuePath, 'utf-8').trim()) + 1;
  }

  console.log(`[Signal] Generating Issue #${issueNumber} for ${today}...`);

  // Fetch all data sources in parallel for speed
  console.log('[Signal] Fetching all data sources in parallel...');
  const [hnStories, githubRepos, hnNew, lobsteStories, arxivPapers, devtoArticles, phPosts, techNews, redditPosts] = await Promise.all([
    fetchHackerNews(20).catch(e => { console.warn('[Signal] HN failed:', e.message); return []; }),
    fetchGitHubTrending().catch(e => { console.warn('[Signal] GitHub failed:', e.message); return []; }),
    fetchHNNew(10).catch(e => { console.warn('[Signal] HN New failed:', e.message); return []; }),
    fetchLobsters(20).catch(e => { console.warn('[Signal] Lobsters failed:', e.message); return []; }),
    fetchArXiv(10).catch(e => { console.warn('[Signal] arXiv failed:', e.message); return []; }),
    fetchDevTo(15).catch(e => { console.warn('[Signal] Dev.to failed:', e.message); return []; }),
    fetchProductHunt(10).catch(e => { console.warn('[Signal] ProductHunt failed:', e.message); return []; }),
    fetchTechNewsRSS(20).catch(e => { console.warn('[Signal] Tech News RSS failed:', e.message); return []; }),
    fetchReddit(15).catch(e => { console.warn('[Signal] Reddit failed:', e.message); return []; }),
  ]);

  console.log(`[Signal] Got: ${hnStories.length} HN, ${githubRepos.length} GitHub, ${hnNew.length} Show HN, ${lobsteStories.length} Lobsters, ${arxivPapers.length} arXiv, ${devtoArticles.length} Dev.to, ${phPosts.length} ProductHunt, ${techNews.length} TechNews, ${redditPosts.length} Reddit`);

  // Collect recent themes + story titles to avoid repetition
  const recentThemes = [];
  const recentStoryTitles = [];
  for (let i = Math.max(1, issueNumber - 5); i < issueNumber; i++) {
    try {
      const prevJson = JSON.parse(fs.readFileSync(path.join(archiveDir, `issue-${i}.json`), 'utf-8'));
      const t = prevJson?.briefing?.theme;
      if (t) recentThemes.push(t);
      // Collect all top story titles from last 3 issues
      if (i >= issueNumber - 3 && prevJson?.briefing?.top_stories) {
        prevJson.briefing.top_stories.forEach(s => {
          if (s.title && !recentStoryTitles.includes(s.title)) {
            recentStoryTitles.push(s.title);
          }
        });
      }
    } catch {}
  }
  if (recentThemes.length > 0) {
    console.log(`[Signal] Recent themes (avoiding): ${recentThemes.join(', ')}`);
  }
  if (recentStoryTitles.length > 0) {
    console.log(`[Signal] Recent stories (avoiding ${recentStoryTitles.length} titles)`);
  }

  // Analyze
  console.log('[Signal] Analyzing with OpenAI...');
  const briefing = await generateBriefing(hnStories, githubRepos, hnNew, lobsteStories, today, arxivPapers, devtoArticles, phPosts, recentThemes, recentStoryTitles, techNews, redditPosts);
  console.log('[Signal] Briefing generated:', briefing.headline);

  // Generate OG image for social sharing
  const ogDir = path.join(outputDir, 'og');
  fs.mkdirSync(ogDir, { recursive: true });
  const ogImagePath = path.join(ogDir, `issue-${issueNumber}.png`);
  try {
    await generateOgImage(
      issueNumber,
      briefing.headline,
      briefing.theme,
      today,
      briefing.top_stories || [],
      ogImagePath
    );
    console.log(`[Signal] OG image generated: og/issue-${issueNumber}.png`);
  } catch (e) {
    console.warn('[Signal] OG image generation failed:', e.message);
  }

  // Render
  const html = renderHTML(briefing, today, issueNumber);

  // Save current issue as index.html
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
  // Save to archive
  fs.writeFileSync(path.join(archiveDir, `${today}.html`), html, 'utf-8');

  // Save raw JSON for future reference
  const jsonData = {
    issue: issueNumber,
    date: today,
    generated_at: new Date().toISOString(),
    briefing,
    raw: {
      hn_count: hnStories.length,
      github_count: githubRepos.length,
      lobste_count: lobsteStories.length,
      arxiv_count: arxivPapers.length,
      devto_count: devtoArticles.length,
      producthunt_count: phPosts.length,
      technews_count: techNews.length,
    }
  };
  // Save by date (latest for this date) AND by issue number (never overwritten)
  fs.writeFileSync(path.join(archiveDir, `${today}.json`), JSON.stringify(jsonData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(archiveDir, `issue-${issueNumber}.json`), JSON.stringify(jsonData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(archiveDir, `issue-${issueNumber}.html`), html, 'utf-8');

  // Update issue count
  fs.writeFileSync(issuePath, String(issueNumber), 'utf-8');

  // Write summary for agent use
  const summary = {
    issue: issueNumber,
    date: today,
    headline: briefing.headline,
    theme: briefing.theme,
    one_liner: briefing.one_liner,
    story_count: briefing.top_stories?.length || 0,
    arxiv_pick: briefing.arxiv_pick?.title || null,
  };
  fs.writeFileSync(path.join(__dirname, 'latest.json'), JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`[Signal] Issue #${issueNumber} saved to ${outputDir}/index.html`);
  console.log(`[Signal] ONE LINER: ${briefing.one_liner}`);

  // Rebuild RSS feed
  try {
    const { buildRssFeed } = await import('./rss.js');
    buildRssFeed();
    console.log('[Signal] RSS feed rebuilt.');
  } catch (e) {
    console.warn('[Signal] RSS feed rebuild failed:', e.message);
  }

  // Rebuild archive index
  try {
    const { buildArchiveIndex } = await import('./archive.js');
    buildArchiveIndex();
    console.log('[Signal] Archive index rebuilt.');
  } catch (e) {
    console.warn('[Signal] Archive index rebuild failed:', e.message);
  }

  // Run source health check and build health dashboard
  try {
    const { checkSourceHealth, renderHealthPage } = await import('./health.js');
    const healthResult = await checkSourceHealth();
    let healthHistory = [];
    const healthFile = path.join(__dirname, 'source_health.json');
    if (fs.existsSync(healthFile)) {
      try { healthHistory = JSON.parse(fs.readFileSync(healthFile, 'utf8')); } catch {}
    }
    const healthHtml = renderHealthPage(healthResult, healthHistory);
    fs.writeFileSync(path.join(outputDir, 'health.html'), healthHtml);
    console.log('[Signal] Source health dashboard rebuilt.');
  } catch (e) {
    console.warn('[Signal] Health check failed:', e.message);
  }

  // Rebuild sitemap
  try {
    const { buildSitemap } = await import('./sitemap.js');
    buildSitemap();
    console.log('[Signal] Sitemap rebuilt.');
  } catch (e) {
    console.warn('[Signal] Sitemap rebuild failed:', e.message);
  }

  // Rebuild landing page (index.html as proper pitch page)
  try {
    const { buildLandingPage } = await import('./landing.js');
    buildLandingPage();
    console.log('[Signal] Landing page rebuilt.');
  } catch (e) {
    console.warn('[Signal] Landing page rebuild failed:', e.message);
  }

  // Rebuild search index
  try {
    const { buildSearchIndex } = await import('./build_search_index.js');
    buildSearchIndex();
    console.log('[Signal] Search index rebuilt.');
  } catch (e) {
    console.warn('[Signal] Search index rebuild failed:', e.message);
  }

  // Build share packs for all issues
  try {
    const { buildSharePacks } = await import('./share_pack.js');
    buildSharePacks();
  } catch (e) {
    console.warn('[Signal] Share pack build failed:', e.message);
  }

  // Deploy to GitHub Pages
  try {
    execSync(`bash ${__dirname}/deploy-gh-pages.sh`, { cwd: __dirname, stdio: 'inherit' });
  } catch (e) {
    console.warn('[Signal] GitHub Pages deploy failed:', e.message);
  }

  // Send Telegram notification
  try {
    const { notifyTelegram } = await import('./telegram_notify.js');
    await notifyTelegram();
    console.log('[Signal] Telegram notification sent.');
  } catch (e) {
    console.warn('[Signal] Telegram notify failed:', e.message);
  }

  return summary;
}

main().catch(err => {
  console.error('[Signal] FATAL ERROR:', err.message);
  process.exit(1);
});
