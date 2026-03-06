/**
 * Signal OG Image Generator
 * Creates 1200x630 social preview images for each issue
 * Uses @napi-rs/canvas for server-side rendering
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register fonts once at module load
const fontsDir = path.join(__dirname, 'fonts');
try {
  GlobalFonts.register(fs.readFileSync(path.join(fontsDir, 'Roboto-Regular.ttf')), 'Roboto');
  GlobalFonts.register(fs.readFileSync(path.join(fontsDir, 'Roboto-Bold.ttf')), 'RobotoBold');
  GlobalFonts.register(fs.readFileSync(path.join(fontsDir, 'RobotoMono-Regular.woff2')), 'RobotoMono');
} catch (e) {
  // Fonts may not be available in all environments
  console.warn('[OG] Font registration failed:', e.message);
}

// Colors
const BG = '#0d1117';
const ACCENT = '#00ff88';
const ACCENT2 = '#00cc6a';
const WHITE = '#ffffff';
const DIM = '#8b949e';
const CARD_BG = '#161b22';
const BORDER = '#21262d';

/**
 * Wrap text to fit within a given width
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate OG image for a Signal issue
 * @param {number} issueNumber
 * @param {string} headline
 * @param {string} theme
 * @param {string} date
 * @param {Array} topStories - [{title, signal_strength}]
 * @param {string} outputPath - where to save the PNG
 */
export async function generateOgImage(issueNumber, headline, theme, date, topStories = [], outputPath) {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // === Background ===
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // === Subtle grid pattern ===
  ctx.strokeStyle = 'rgba(33,38,45,0.8)';
  ctx.lineWidth = 1;
  const GRID = 60;
  for (let x = 0; x < W; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // === Green accent top bar ===
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, ACCENT);
  grad.addColorStop(0.5, ACCENT2);
  grad.addColorStop(1, 'rgba(0,255,136,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 4);

  // === SIGNAL logo top-left ===
  ctx.font = 'bold 30px RobotoMono';
  ctx.fillStyle = ACCENT;
  ctx.fillText('// SIGNAL', 60, 65);

  // === Issue number badge top-right ===
  const badgeText = `#${issueNumber}`;
  ctx.font = 'bold 22px RobotoMono';
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeX = W - 60 - badgeW;
  // Badge bg
  ctx.fillStyle = CARD_BG;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  roundRect(ctx, badgeX, 40, badgeW, 36, 8);
  ctx.fill();
  ctx.stroke();
  // Badge text
  ctx.fillStyle = ACCENT;
  ctx.fillText(badgeText, badgeX + 14, 64);

  // === Theme pill ===
  if (theme) {
    ctx.font = '16px RobotoMono';
    const themeText = theme.toUpperCase();
    const themeW = ctx.measureText(themeText).width + 24;
    ctx.fillStyle = 'rgba(0,255,136,0.1)';
    ctx.strokeStyle = 'rgba(0,255,136,0.3)';
    ctx.lineWidth = 1;
    roundRect(ctx, 60, 92, themeW, 28, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.fillText(themeText, 72, 111);
  }

  // === Main headline ===
  const headlineY = 160;
  const headlineMaxW = W - 120;
  ctx.font = 'bold 40px Roboto';
  ctx.fillStyle = WHITE;
  const lines = wrapText(ctx, headline, headlineMaxW);
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, 60, headlineY + i * 56);
  });

  // === Divider ===
  const dividerY = headlineY + Math.min(lines.length, 3) * 56 + 20;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, dividerY);
  ctx.lineTo(W - 60, dividerY);
  ctx.stroke();

  // === Top stories mini-list ===
  const storiesY = dividerY + 30;
  const signalColors = { high: ACCENT, medium: '#ffcc00', low: '#555' };
  const signalIcons = { high: '▲', medium: '◆', low: '◇' };

  const displayStories = topStories.slice(0, 3);
  displayStories.forEach((story, i) => {
    const y = storiesY + i * 50;
    const color = signalColors[story.signal_strength] || DIM;

    // Signal dot indicator (colored circle)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(72, y - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    // Story title
    ctx.font = '18px Roboto';
    ctx.fillStyle = '#c9d1d9';
    const title = story.title?.length > 82 ? story.title.slice(0, 80) + '…' : (story.title || '');
    ctx.fillText(title, 88, y);
  });

  // === Bottom bar ===
  const bottomY = H - 70;
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, bottomY, W, 70);
  // Bottom border top
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bottomY);
  ctx.lineTo(W, bottomY);
  ctx.stroke();

  // Date
  ctx.font = '16px RobotoMono';
  ctx.fillStyle = DIM;
  ctx.fillText(date, 60, bottomY + 40);

  // Tagline center
  const tagline = 'AI-curated daily tech briefing';
  ctx.font = '16px RobotoMono';
  ctx.fillStyle = DIM;
  const taglineW = ctx.measureText(tagline).width;
  ctx.fillText(tagline, (W - taglineW) / 2, bottomY + 40);

  // URL right
  const url = 'chief-o-brien-bot.github.io/signal';
  ctx.font = '14px RobotoMono';
  ctx.fillStyle = ACCENT;
  const urlW = ctx.measureText(url).width;
  ctx.fillText(url, W - 60 - urlW, bottomY + 40);

  // === Export ===
  const buffer = canvas.toBuffer('image/png');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Helper: draw rounded rectangle path
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
