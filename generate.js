#!/usr/bin/env node
/**
 * Signal: Main generation script
 * Run to generate today's briefing
 */

import 'dotenv/config';
import { fetchHackerNews, fetchGitHubTrending, fetchHNNew, fetchLobsters } from './fetch.js';
import { generateBriefing } from './analyze.js';
import { renderHTML } from './render.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // Fetch data
  console.log('[Signal] Fetching Hacker News...');
  const hnStories = await fetchHackerNews(20);
  console.log(`[Signal] Got ${hnStories.length} HN stories`);

  console.log('[Signal] Fetching GitHub trending...');
  const githubRepos = await fetchGitHubTrending();
  console.log(`[Signal] Got ${githubRepos.length} GitHub repos`);

  console.log('[Signal] Fetching HN Show/Ask...');
  const hnNew = await fetchHNNew(10);
  console.log(`[Signal] Got ${hnNew.length} Show/Ask HN`);

  console.log('[Signal] Fetching Lobste.rs...');
  const lobsteStories = await fetchLobsters(20);
  console.log(`[Signal] Got ${lobsteStories.length} Lobste.rs stories`);

  // Analyze
  console.log('[Signal] Analyzing with Claude...');
  const briefing = await generateBriefing(hnStories, githubRepos, hnNew, lobsteStories, today);
  console.log('[Signal] Briefing generated:', briefing.headline);

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
    raw: { hn_count: hnStories.length, github_count: githubRepos.length, lobste_count: lobsteStories.length }
  };
  fs.writeFileSync(path.join(archiveDir, `${today}.json`), JSON.stringify(jsonData, null, 2), 'utf-8');

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

  // Send Telegram notification
  try {
    const { notifyTelegram } = await import('./telegram_notify.js');
    await notifyTelegram(summary, briefing);
    console.log('[Signal] Telegram notification sent.');
  } catch (e) {
    console.warn('[Signal] Telegram notification failed:', e.message);
  }

  return summary;
}

main().catch(err => {
  console.error('[Signal] FATAL ERROR:', err.message);
  process.exit(1);
});
