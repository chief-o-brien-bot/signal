/**
 * Signal: Data fetcher
 * Pulls from HN API and GitHub trending
 */

import axios from 'axios';

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
  // We'll use the GitHub REST API to find recently popular repos
  const response = await axios.get(
    'https://api.github.com/search/repositories?q=stars:>100+pushed:>2026-03-01&sort=stars&order=desc&per_page=10',
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
