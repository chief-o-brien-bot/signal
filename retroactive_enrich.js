#!/usr/bin/env node
/**
 * Signal: Retroactive HN Comment Enrichment
 * Enriches existing issue JSONs with community_take fields
 * Run once to backfill all issues
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllHNComments } from './enrich_hn.js';
import { complete } from './claude.js';
import { renderHTML } from './render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archiveDir = path.join(__dirname, 'public', 'archive');

async function enrichIssue(jsonPath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.warn(`  Skip ${jsonPath}: ${e.message}`);
    return false;
  }

  if (!data.briefing?.top_stories) {
    console.warn(`  Skip ${jsonPath}: no top_stories`);
    return false;
  }

  // Check if already enriched
  const alreadyEnriched = data.briefing.top_stories.some(s => s.community_take);
  if (alreadyEnriched) {
    console.log(`  Already enriched: ${path.basename(jsonPath)}`);
    return false;
  }

  console.log(`  Enriching: ${path.basename(jsonPath)} (${data.briefing.top_stories.length} stories)...`);

  // Fetch HN comments for all stories
  const hnStories = data.briefing.top_stories.filter(s => s.source === 'hn' && s.discussion_url);
  const fakeHnStories = hnStories.map(s => {
    const match = s.discussion_url?.match(/item\?id=(\d+)/);
    return { id: match ? parseInt(match[1]) : null, title: s.title, hn_url: s.discussion_url };
  }).filter(s => s.id);
  const commentMap = await fetchAllHNComments(fakeHnStories);

  // Use single AI call to distill all comments
  let enrichedStories = [...data.briefing.top_stories];
  if (Object.keys(commentMap).length > 0) {
    const commentsText = Object.entries(commentMap).map(([id, d]) =>
      `Story: "${d.title}" (HN:${id})\n` + d.comments.map((c, i) => `  Comment ${i+1} (${c.by}): "${c.text}"`).join('\n')
    ).join('\n\n');

    const prompt = `For each HN story below, distill the community reaction into 1-2 sharp sentences.\n\n${commentsText}\n\nReturn JSON: { "takes": { "<hn_id>": "community take text" } }. Return ONLY the JSON.`;
    try {
      const result = await complete(prompt, { model: 'claude-sonnet-4-6' });
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        const takes = JSON.parse(match[0]).takes || {};
        enrichedStories = data.briefing.top_stories.map(s => {
          const m = s.discussion_url?.match(/item\?id=(\d+)/);
          const id = m ? m[1] : null;
          if (id && takes[id]) return { ...s, community_take: takes[id] };
          return s;
        });
      }
    } catch (e) {
      console.warn(`  AI distillation failed: ${e.message}`);
    }
  }
  const enrichedCount = enrichedStories.filter(s => s.community_take).length;

  if (enrichedCount === 0) {
    console.log(`  No HN takes found for ${path.basename(jsonPath)}`);
    return false;
  }

  data.briefing.top_stories = enrichedStories;

  // Save updated JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ Enriched ${enrichedCount} stories in ${path.basename(jsonPath)}`);

  // Re-render HTML
  const htmlPath = jsonPath.replace('.json', '.html');
  try {
    const html = renderHTML(data.briefing, data.date, data.issue);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`  ✓ Re-rendered ${path.basename(htmlPath)}`);

    // If this is the latest issue (issue-17.json), also update index.html
    if (jsonPath.includes(`issue-17.json`)) {
      fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), html, 'utf-8');
      console.log(`  ✓ Updated index.html (latest issue)`);
    }
  } catch (e) {
    console.warn(`  Failed to re-render HTML: ${e.message}`);
  }

  return true;
}

async function main() {
  console.log('[Retroactive Enrich] Starting HN comment enrichment for all issues...\n');

  // Get all issue JSON files (skip date-based ones like 2026-03-06.json)
  const files = fs.readdirSync(archiveDir)
    .filter(f => f.match(/^issue-\d+\.json$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0]);
      const nb = parseInt(b.match(/\d+/)[0]);
      return na - nb;
    });

  console.log(`Found ${files.length} issue files: ${files.join(', ')}\n`);

  let enrichedTotal = 0;
  for (const file of files) {
    const jsonPath = path.join(archiveDir, file);
    console.log(`Processing ${file}...`);
    const changed = await enrichIssue(jsonPath);
    if (changed) enrichedTotal++;

    // Small delay to avoid rate limiting HN API
    await new Promise(r => setTimeout(r, 500));
  }

  // Also update the date-based files (symlink targets) if they exist
  // The 2026-03-06.json might point to the latest issue
  const dateJsonPath = path.join(archiveDir, '2026-03-06.json');
  if (fs.existsSync(dateJsonPath)) {
    console.log('\nUpdating date-based issue file...');
    const issueData = JSON.parse(fs.readFileSync(path.join(archiveDir, 'issue-17.json'), 'utf-8'));
    fs.writeFileSync(dateJsonPath, JSON.stringify(issueData, null, 2), 'utf-8');
    const dateHtmlPath = dateJsonPath.replace('.json', '.html');
    const html = renderHTML(issueData.briefing, issueData.date, issueData.issue);
    fs.writeFileSync(dateHtmlPath, html, 'utf-8');
    console.log('✓ Updated 2026-03-06.json and .html');
  }

  console.log(`\n[Retroactive Enrich] Done. Enriched ${enrichedTotal} issues.`);
}

main().catch(console.error);
