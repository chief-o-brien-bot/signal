/**
 * Signal: Data fetcher
 * Pulls from HN API, GitHub trending, arXiv, Dev.to
 */

import axios from 'axios';
import { parseStringPromise } from 'xml2js';

// Fetch top HN stories with details
export async function fetchHackerNews(count = 20) {
  const topRes = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
  const ids = topRes.data.slice(0, count);

  const stories = await Promise.all(
    ids.map(id =>
      axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.data)
        .catch(() => null)
    )
  );

  return stories
    .filter(s => s && s.type === 'story' && s.title)
    .map(s => ({
      id: s.id,
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score || 0,
      comments: s.descendants || 0,
      by: s.by,
      hn_url: `https://news.ycombinator.com/item?id=${s.id}`,
    }))
    .sort((a, b) => b.score - a.score);
}

// Fetch GitHub trending repos (today)
export async function fetchGitHubTrending() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; Signal-Agent/1.0)',
    'Accept': 'text/html,application/xhtml+xml',
  };

  // Use GitHub search API as fallback since trending page needs scraping
  // We'll use the GitHub REST API to find recently popular repos (rolling 7-day window)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const response = await axios.get(
    `https://api.github.com/search/repositories?q=stars:>100+pushed:>${sevenDaysAgo}&sort=stars&order=desc&per_page=10`,
    { headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } }
  );

  return response.data.items.slice(0, 10).map(repo => ({
    name: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    stars: repo.stargazers_count,
    language: repo.language,
    topics: repo.topics?.slice(0, 3) || [],
  }));
}

// Fetch Lobste.rs hottest stories
export async function fetchLobsters(count = 20) {
  const response = await axios.get('https://lobste.rs/hottest.json', {
    headers: { 'User-Agent': 'Signal-Agent/1.0' },
  });

  return response.data.slice(0, count).map(s => ({
    title: s.title,
    url: s.url || s.comments_url,
    score: s.score || 0,
    comments: s.comment_count || 0,
    tags: s.tags || [],
    lobste_url: s.comments_url,
  }));
}

// Fetch HN Ask HN / Show HN for product launches
export async function fetchHNNew(count = 10) {
  const newRes = await axios.get('https://hacker-news.firebaseio.com/v0/newstories.json');
  const ids = newRes.data.slice(0, 100);

  const stories = await Promise.all(
    ids.slice(0, 30).map(id =>
      axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.data)
        .catch(() => null)
    )
  );

  return stories
    .filter(s => s && (s.title?.includes('Show HN') || s.title?.includes('Ask HN')))
    .slice(0, count)
    .map(s => ({
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score || 0,
      hn_url: `https://news.ycombinator.com/item?id=${s.id}`,
    }));
}

// Fetch arXiv recent CS papers (cs.AI, cs.LG, cs.SE)
export async function fetchArXiv(count = 10) {
  const categories = ['cs.AI', 'cs.LG', 'cs.SE'];
  const results = [];

  for (const cat of categories) {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&sortBy=submittedDate&sortOrder=descending&max_results=5`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Signal-Agent/1.0' },
        timeout: 10000,
      });

      const parsed = await parseStringPromise(response.data);
      const entries = parsed?.feed?.entry || [];

      for (const entry of entries) {
        const title = entry.title?.[0]?.replace(/\s+/g, ' ').trim();
        const summary = entry.summary?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 200);
        const id = entry.id?.[0];
        const authors = entry.author?.slice(0, 3).map(a => a.name?.[0]).join(', ');
        const arxivUrl = id?.replace('http://', 'https://').replace('/abs/', '/abs/');

        if (title && arxivUrl) {
          results.push({ title, summary, url: arxivUrl, category: cat, authors });
        }
      }
    } catch (err) {
      // Skip failing categories
    }
  }

  return results.slice(0, count);
}

// Fetch ProductHunt top posts (via RSS)
export async function fetchProductHunt(count = 10) {
  try {
    const response = await axios.get(
      'https://www.producthunt.com/feed',
      { headers: { 'User-Agent': 'Signal-Agent/1.0' }, timeout: 10000 }
    );

    const parsed = await parseStringPromise(response.data);
    const items = parsed?.rss?.channel?.[0]?.item || [];

    return items.slice(0, count).map(item => ({
      title: item.title?.[0]?.replace(/\s+/g, ' ').trim(),
      url: item.link?.[0],
      description: item.description?.[0]?.replace(/<[^>]*>/g, '').slice(0, 200).trim(),
      pubDate: item.pubDate?.[0],
    })).filter(i => i.title && i.url);
  } catch (err) {
    return [];
  }
}

// Fetch Dev.to top articles (last 7 days)
export async function fetchDevTo(count = 15) {
  try {
    const response = await axios.get(
      `https://dev.to/api/articles?top=7&per_page=${count}`,
      { headers: { 'User-Agent': 'Signal-Agent/1.0' }, timeout: 10000 }
    );

    return response.data.map(a => ({
      title: a.title,
      url: a.url,
      reactions: a.public_reactions_count || 0,
      comments: a.comments_count || 0,
      tags: a.tag_list || [],
      description: a.description?.slice(0, 150),
    }));
  } catch (err) {
    return [];
  }
}
