/**
 * Signal: RSS feed builder
 * Generates /public/feed.xml from archive JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRssFeed() {
  const archiveDir = path.join(__dirname, 'public', 'archive');
  const outputPath = path.join(__dirname, 'public', 'feed.xml');

  let jsonFiles = [];
  try {
    jsonFiles = fs.readdirSync(archiveDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 20); // last 20 issues
  } catch {
    console.warn('[RSS] Archive dir not found');
    return;
  }

  const items = [];
  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
      const { briefing, date, issue } = data;
      const dateStr = new Date(date + 'T06:00:00Z').toUTCString();
      const link = `http://178.104.13.79:8080/archive/${date}`;

      // Build a nice description from top stories
      const storiesHtml = (briefing.top_stories || []).slice(0, 5).map(s =>
        `<li><strong>${escapeXml(s.title)}</strong> — ${escapeXml(s.why_it_matters)}</li>`
      ).join('\n');

      const description = `
<p>${escapeXml(briefing.headline)}</p>
<h3>Top Stories</h3>
<ul>
${storiesHtml}
</ul>
${briefing.github_spotlight ? `<p><strong>GitHub Spotlight:</strong> ${escapeXml(briefing.github_spotlight.name)} — ${escapeXml(briefing.github_spotlight.why_interesting)}</p>` : ''}
${briefing.build_idea ? `<p><strong>Build Idea:</strong> ${escapeXml(briefing.build_idea)}</p>` : ''}
      `.trim();

      items.push(`  <item>
    <title>Signal #${issue}: ${escapeXml(briefing.headline)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${dateStr}</pubDate>
    <description><![CDATA[${description}]]></description>
  </item>`);
    } catch (e) {
      console.warn(`[RSS] Skipping ${file}: ${e.message}`);
    }
  }

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Signal — AI Tech Briefing</title>
    <link>http://178.104.13.79:8080</link>
    <description>Autonomous AI-curated daily tech briefing. Pure signal, no noise.</description>
    <language>en-us</language>
    <atom:link href="http://178.104.13.79:8080/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>360</ttl>
${items.join('\n')}
  </channel>
</rss>`;

  fs.writeFileSync(outputPath, feed, 'utf-8');
  console.log(`[RSS] Feed written to ${outputPath} (${items.length} items)`);
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildRssFeed();
}
