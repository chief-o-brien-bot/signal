/**
 * Signal: Search Index Builder
 * Reads all issue JSON files and builds a search index for client-side search
 * Output: public/search-index.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archiveDir = path.join(__dirname, 'public', 'archive');
const outputPath = path.join(__dirname, 'public', 'search-index.json');

export function buildSearchIndex() {
  const files = fs.readdirSync(archiveDir)
    .filter(f => f.startsWith('issue-') && f.endsWith('.json'))
    .sort((a, b) => {
      const na = parseInt(a.match(/issue-(\d+)/)?.[1] || 0);
      const nb = parseInt(b.match(/issue-(\d+)/)?.[1] || 0);
      return nb - na; // newest first
    });

  const index = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
      const b = data.briefing || {};

      const entry = {
        issue: data.issue,
        date: data.date,
        url: `archive/issue-${data.issue}.html`,
        theme: b.theme || '',
        headline: b.headline || '',
        one_liner: b.one_liner || '',
        top_stories: (b.top_stories || []).map(s => ({
          title: s.title || '',
          why: s.why_it_matters || '',
          source: s.source || '',
          url: s.url || '',
          discussion_url: s.discussion_url || '',
          signal_strength: s.signal_strength || 'medium',
        })),
        github: b.github_spotlight ? {
          name: b.github_spotlight.name || '',
          why: b.github_spotlight.why_interesting || '',
          url: b.github_spotlight.url || '',
        } : null,
        arxiv: b.arxiv_pick ? {
          title: b.arxiv_pick.title || '',
          why: b.arxiv_pick.why_it_matters || '',
          url: b.arxiv_pick.url || '',
          category: b.arxiv_pick.category || '',
        } : null,
        build_idea: b.build_idea || '',
        // Full text for search matching
        _text: [
          b.theme,
          b.headline,
          b.one_liner,
          b.build_idea,
          ...(b.top_stories || []).map(s => `${s.title} ${s.why_it_matters}`),
          b.github_spotlight?.name,
          b.github_spotlight?.why_interesting,
          b.arxiv_pick?.title,
          b.arxiv_pick?.why_it_matters,
        ].filter(Boolean).join(' ').toLowerCase(),
      };

      index.push(entry);
    } catch (err) {
      console.error(`[search] Error reading ${file}:`, err.message);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[search] Built index with ${index.length} issues → public/search-index.json`);
  return index;
}

// Run standalone (only when executed directly, not when imported)
import { fileURLToPath as _ftu } from 'url';
if (process.argv[1] === _ftu(import.meta.url)) {
  buildSearchIndex();
}
