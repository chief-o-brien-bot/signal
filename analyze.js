/**
 * Signal: AI analysis engine
 * Takes raw data and produces a curated briefing
 * Uses Anthropic Claude via claude-agent-sdk
 */

import { complete } from './claude.js';

export async function generateBriefing(hnStories, githubRepos, hnNew, lobsteStories, date, arxivPapers = [], devtoArticles = [], phPosts = [], recentThemes = [], recentStoryTitles = [], techNews = [], redditPosts = [], hnCommentMap = {}) {
  const hnText = hnStories.slice(0, 15).map((s, i) =>
    `${i+1}. [${s.score} pts, ${s.comments} comments] ${s.title}\n   URL: ${s.url}\n   HN Discussion: ${s.hn_url || `https://news.ycombinator.com/item?id=${s.id}`}`
  ).join('\n');

  const githubText = githubRepos.slice(0, 8).map((r, i) =>
    `${i+1}. ${r.name} (★${r.stars.toLocaleString()}) [${r.language || 'N/A'}]\n   ${r.description || 'No description'}`
  ).join('\n');

  const hnNewText = hnNew.slice(0, 6).map((s, i) =>
    `${i+1}. ${s.title}\n   URL: ${s.url}\n   HN Discussion: ${s.hn_url || `https://news.ycombinator.com/item?id=${s.id}`}`
  ).join('\n');

  const lobsteText = lobsteStories.slice(0, 15).map((s, i) =>
    `${i+1}. [${s.score} pts, ${s.comments} comments] ${s.title} [${s.tags.join(', ')}]\n   URL: ${s.url}\n   Lobste.rs Discussion: ${s.lobste_url || s.url}`
  ).join('\n');

  const arxivText = arxivPapers.length > 0
    ? arxivPapers.slice(0, 8).map((p, i) =>
        `${i+1}. [${p.category}] ${p.title}\n   ${p.summary?.slice(0, 120) || ''}\n   URL: ${p.url}`
      ).join('\n')
    : '(no papers fetched)';

  const devtoText = devtoArticles.length > 0
    ? devtoArticles.slice(0, 10).map((a, i) =>
        `${i+1}. [❤${a.reactions}] ${a.title} [${a.tags.join(', ')}]\n   URL: ${a.url}`
      ).join('\n')
    : '(no articles fetched)';

  const phText = phPosts.length > 0
    ? phPosts.slice(0, 8).map((p, i) =>
        `${i+1}. ${p.title}\n   ${p.description || ''}\n   URL: ${p.url}`
      ).join('\n')
    : '(no posts fetched)';

  const techNewsText = techNews.length > 0
    ? techNews.slice(0, 12).map((a, i) =>
        `${i+1}. [${a.source}] ${a.title}\n   ${a.description?.slice(0, 100) || ''}\n   URL: ${a.url}`
      ).join('\n')
    : '(no tech news fetched)';

  const redditText = redditPosts.length > 0
    ? redditPosts.slice(0, 12).map((p, i) =>
        `${i+1}. [${p.subreddit}, ↑${p.score}] ${p.title}\n   URL: ${p.url}`
      ).join('\n')
    : '(no reddit posts fetched)';


  const hnCommentsText = Object.keys(hnCommentMap).length > 0
    ? Object.entries(hnCommentMap).map(([id, data]) =>
        `Story: "${data.title}" (HN:${id})\n` +
        data.comments.map((c, i) => `  Comment ${i+1} (${c.by}): "${c.text}"`).join('\n')
      ).join('\n\n')
    : '(no HN comments fetched)';

  const themeAvoidance = recentThemes.length > 0
    ? `\n⚠️ THEME DIVERSITY: The last ${recentThemes.length} issues used these themes: [${recentThemes.join(', ')}]. DO NOT repeat these themes. Choose a genuinely different angle from today's data.\n`
    : '';

  const storyAvoidance = recentStoryTitles.length > 0
    ? `\n⚠️ STORY FRESHNESS: These stories have already appeared in recent issues — DO NOT use them as top stories again (find different angles or different stories entirely):\n${recentStoryTitles.map(t => `  - "${t}"`).join('\n')}\n`
    : '';

  const prompt = `You are Signal — an autonomous AI that reads the entire tech internet and distills it to pure signal.

Today is ${date}.
${themeAvoidance}${storyAvoidance}

Here's the raw data from Hacker News top stories:
${hnText}

Lobste.rs top stories:
${lobsteText}

GitHub trending repos:
${githubText}

Show HN / Ask HN (new products & discussions):
${hnNewText}

arXiv recent papers (cs.AI, cs.LG, cs.SE):
${arxivText}

Dev.to top articles (past week):
${devtoText}

ProductHunt top launches (today):
${phText}

Mainstream tech media (TechCrunch, Ars Technica, The Verge, Wired, MIT Tech Review):
${techNewsText}

Reddit top posts (r/programming, r/MachineLearning, r/technology — sorted by upvotes today):
${redditText}

HN Discussion Comments (top comments from active HN stories — use these to write community_take for HN-sourced stories):
${hnCommentsText}

Produce a JSON response with this exact structure:
{
  "headline": "One punchy sentence that captures the most important thing happening in tech today",
  "theme": "The overarching theme of today's tech world (2-3 words)",
  "top_stories": [
    {
      "rank": 1,
      "title": "story title",
      "why_it_matters": "1-2 sentence sharp take on why this is important",
      "signal_strength": "high|medium|low",
      "source": "hn|lobsters|devto",
      "url": "url",
      "discussion_url": "link to the discussion thread (HN item URL, lobste.rs comments URL, or dev.to article URL)",
      "community_take": "For HN-sourced stories with comments above: 1-2 sharp sentences distilling what the HN community thinks. Capture consensus, insightful technical points, or notable skepticism. null for non-HN stories or if no comments available."
    }
  ],
  "github_spotlight": {
    "name": "repo name",
    "why_interesting": "1-2 sentence take",
    "url": "github url"
  },
  "arxiv_pick": {
    "title": "most interesting paper title",
    "why_it_matters": "1-2 sentence take on why this research matters for practitioners",
    "category": "cs.AI|cs.LG|cs.SE",
    "url": "arxiv url"
  },
  "build_idea": "One specific thing a developer could build today inspired by today's signal",
  "one_liner": "A tweet-worthy one-liner summary of today's tech world (<280 chars)"
}

Pick the 5 most important stories that represent genuine signal (not noise). Draw from HN, Lobste.rs, Dev.to, ProductHunt, mainstream tech media, and Reddit — pick whichever stories are most interesting regardless of source. For the "source" field use: "hn", "lobsters", "devto", "producthunt", "technews", "reddit". For arxiv_pick, choose the paper most relevant to what practitioners are building today. Be sharp, opinionated, and direct. Avoid hype. Surface the things that will matter in 6 months. Mainstream tech media and Reddit posts can be excellent signal if they cover genuinely important developments.

For any HN-sourced story, if HN discussion comments are provided above, include a community_take that distills the HN hive mind's reaction. Be specific about what commenters actually said — don't be generic.

Return ONLY the JSON object, no markdown fences or extra text.`;

  const text = await complete(prompt, { model: 'claude-sonnet-4-6' });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]);
}
