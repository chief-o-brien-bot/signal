/**
 * Signal: HN Comment Fetcher
 * Fetches top comments from HN discussions for enrichment.
 * AI distillation is now handled in analyze.js as part of the single prompt.
 */

import axios from 'axios';

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const MAX_COMMENTS = 6;
const MAX_COMMENT_LEN = 400;

// Extract HN item ID from URL
function extractHNId(url) {
  if (!url) return null;
  const match = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Fetch top-level comments for an HN item
async function fetchHNComments(itemId, count = MAX_COMMENTS) {
  try {
    const item = await axios.get(`${HN_API}/item/${itemId}.json`, { timeout: 5000 });
    const story = item.data;
    if (!story || !story.kids || story.kids.length === 0) return [];

    const commentIds = story.kids.slice(0, Math.min(count, story.kids.length));
    const comments = await Promise.all(
      commentIds.map(id =>
        axios.get(`${HN_API}/item/${id}.json`, { timeout: 4000 })
          .then(r => r.data)
          .catch(() => null)
      )
    );

    return comments
      .filter(c => c && c.type === 'comment' && c.text && !c.deleted && !c.dead)
      .map(c => ({
        by: c.by || 'anon',
        text: c.text
          .replace(/<[^>]*>/g, ' ')
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&')
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_COMMENT_LEN),
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Fetch HN comments for all HN stories (by matching discussion URLs).
 * Returns a map of { hn_item_id: [comments] } for stories that have comments.
 */
export async function fetchAllHNComments(hnStories) {
  const commentMap = {};

  const tasks = hnStories.slice(0, 15).map(async (story) => {
    const id = story.id || extractHNId(story.hn_url);
    if (!id) return;

    const comments = await fetchHNComments(id);
    if (comments.length > 0) {
      commentMap[id] = { title: story.title, comments };
      console.log(`[EnrichHN] Got ${comments.length} comments for HN:${id}`);
    }
  });

  await Promise.all(tasks);
  return commentMap;
}
