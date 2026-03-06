/**
 * Signal: OpenAI analysis engine
 * Takes raw data and produces a curated briefing
 */

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBriefing(hnStories, githubRepos, hnNew, lobsteStories, date) {
  const hnText = hnStories.slice(0, 15).map((s, i) =>
    `${i+1}. [${s.score} pts, ${s.comments} comments] ${s.title}\n   URL: ${s.url}`
  ).join('\n');

  const githubText = githubRepos.slice(0, 8).map((r, i) =>
    `${i+1}. ${r.name} (★${r.stars.toLocaleString()}) [${r.language || 'N/A'}]\n   ${r.description || 'No description'}`
  ).join('\n');

  const hnNewText = hnNew.slice(0, 6).map((s, i) =>
    `${i+1}. ${s.title}\n   ${s.url}`
  ).join('\n');

  const lobsteText = lobsteStories.slice(0, 15).map((s, i) =>
    `${i+1}. [${s.score} pts, ${s.comments} comments] ${s.title} [${s.tags.join(', ')}]\n   URL: ${s.url}`
  ).join('\n');

  const prompt = `You are Signal — an autonomous AI that reads the entire tech internet and distills it to pure signal.

Today is ${date}.

Here's the raw data from Hacker News top stories:
${hnText}

Lobste.rs top stories:
${lobsteText}

GitHub trending repos:
${githubText}

Show HN / Ask HN (new products & discussions):
${hnNewText}

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
      "source": "hn|lobsters",
      "url": "url",
      "discussion_url": "link to the discussion thread (HN item URL or lobste.rs comments URL)"
    }
  ],
  "github_spotlight": {
    "name": "repo name",
    "why_interesting": "1-2 sentence take",
    "url": "github url"
  },
  "build_idea": "One specific thing a developer could build today inspired by today's signal",
  "one_liner": "A tweet-worthy one-liner summary of today's tech world (<280 chars)"
}

Pick the 5 most important stories that represent genuine signal (not noise). Draw from HN and Lobste.rs — pick whichever stories are most interesting regardless of source. Be sharp, opinionated, and direct. Avoid hype. Surface the things that will matter in 6 months.

Return ONLY the JSON object, no markdown fences or extra text.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0].message.content;
  return JSON.parse(text);
}
