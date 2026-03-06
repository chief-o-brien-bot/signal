#!/usr/bin/env node
/**
 * Signal: Telegram notification
 * Posts today's briefing summary to the group chat.
 * Can be run standalone: node telegram_notify.js
 * Or imported: import { notifyTelegram } from './telegram_notify.js'
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIGNAL_URL = 'http://178.104.13.79:8080';
const signalEmoji = { high: '🟢', medium: '🟡', low: '⚪' };

async function sendTelegramMessage(text, botToken, chatId) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data;
}

const SENT_FLAG_PATH = path.join(__dirname, 'public', '.last_telegram_sent');

function alreadySentToday() {
  try {
    const lastSent = fs.readFileSync(SENT_FLAG_PATH, 'utf-8').trim();
    return lastSent === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

function markSentToday() {
  fs.mkdirSync(path.dirname(SENT_FLAG_PATH), { recursive: true });
  fs.writeFileSync(SENT_FLAG_PATH, new Date().toISOString().slice(0, 10), 'utf-8');
}

/**
 * Build and send a Telegram briefing message.
 * Sends at most once per day — safe to call multiple times.
 * @param {object} summary - from latest.json
 * @param {object} [briefing] - full briefing object (optional, for richer messages)
 */
export async function notifyTelegram(summary, briefing) {
  if (alreadySentToday()) {
    console.log('[Signal/Telegram] Already sent today — skipping.');
    return;
  }
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.GROUP_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or GROUP_CHAT_ID not set');
  }

  // If briefing not passed in, try to load from archive
  if (!briefing) {
    const archivePath = path.join(__dirname, 'public', 'archive', `${summary.date}.json`);
    if (fs.existsSync(archivePath)) {
      const full = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
      briefing = full.briefing;
    }
  }

  const stories = briefing?.top_stories?.slice(0, 3) || [];
  const githubSpotlight = briefing?.github_spotlight || null;
  const arxivPick = briefing?.arxiv_pick || null;
  const buildIdea = briefing?.build_idea || null;

  // Format top stories
  const storiesText = stories.map(s =>
    `${signalEmoji[s.signal_strength] || '⚪'} <b>${escapeHtml(s.title)}</b>\n   <i>${escapeHtml(s.why_it_matters)}</i>`
  ).join('\n\n');

  const lines = [
    `◈ <b>SIGNAL — Issue #${summary.issue}</b>`,
    `"${escapeHtml(summary.headline)}"`,
    ``,
    `<code>THEME: ${escapeHtml(summary.theme)} · ${summary.date}</code>`,
    ``,
  ];

  if (storiesText) {
    lines.push(`<b>TOP STORIES</b>`);
    lines.push(storiesText);
    lines.push(``);
  }

  if (githubSpotlight) {
    lines.push(`🔭 <b>GITHUB:</b> ${escapeHtml(githubSpotlight.name)}`);
    lines.push(`   ${escapeHtml(githubSpotlight.why_interesting)}`);
    lines.push(``);
  }

  if (arxivPick) {
    lines.push(`🔬 <b>RESEARCH:</b> <a href="${escapeHtml(arxivPick.url)}">${escapeHtml(arxivPick.title?.slice(0, 80))}</a>`);
    lines.push(`   ${escapeHtml(arxivPick.why_it_matters?.slice(0, 120))}`);
    lines.push(``);
  }

  if (buildIdea) {
    lines.push(`💡 <b>BUILD THIS:</b> ${escapeHtml(buildIdea)}`);
    lines.push(``);
  }

  lines.push(`<a href="${SIGNAL_URL}">→ Read full briefing at ${SIGNAL_URL}</a>`);
  lines.push(`<i>Autonomously generated. No human editors.</i>`);

  const message = lines.join('\n');
  await sendTelegramMessage(message, BOT_TOKEN, CHAT_ID);
  markSentToday();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Standalone runner
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const latestPath = path.join(__dirname, 'latest.json');
  if (!fs.existsSync(latestPath)) {
    console.error('[Signal/Telegram] No latest.json found — run generate.js first');
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
  console.log('[Signal/Telegram] Sending briefing to group...');
  notifyTelegram(summary)
    .then(() => console.log('[Signal/Telegram] Sent successfully.'))
    .catch(err => { console.error('[Signal/Telegram] ERROR:', err.message); process.exit(1); });
}
