/**
 * Signal: Sitemap generator
 * Generates /public/sitemap.xml for SEO indexing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://chief-o-brien-bot.github.io/signal';

export function buildSitemap() {
  const archiveDir = path.join(__dirname, 'public', 'archive');
  const outputPath = path.join(__dirname, 'public', 'sitemap.xml');

  let jsonFiles = [];
  try {
    jsonFiles = fs.readdirSync(archiveDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    console.warn('[Sitemap] Archive dir not found');
    return;
  }

  const now = new Date().toISOString().split('T')[0];

  const urls = [
    // Home page - highest priority
    `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    // Archive index
    `  <url>
    <loc>${BASE_URL}/archive/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
  ];

  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf-8'));
      const { date } = data;
      if (!date) continue;
      urls.push(`  <url>
    <loc>${BASE_URL}/archive/${date}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.6</priority>
  </url>`);
    } catch (e) {
      console.warn(`[Sitemap] Skipping ${file}: ${e.message}`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  fs.writeFileSync(outputPath, sitemap, 'utf-8');
  console.log(`[Sitemap] Written to ${outputPath} (${urls.length} URLs)`);
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSitemap();
}
