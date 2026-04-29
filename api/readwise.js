function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    token,
    text,
    title,
    author,
    source_type: sourceType,
    category,
    note,
    highlight_url: highlightUrl,
  } = readBody(req);

  if (typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ error: 'Readwise token is required.' });
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Highlight text is required.' });
  }

  const highlight = {
    text,
    title: title || 'Blackout Poetry',
    author: author || 'via blackout.poetry',
    source_type: sourceType || 'blackout-poetry',
    category: category || 'supplementals',
  };
  if (note) highlight.note = note;
  if (highlightUrl) highlight.highlight_url = highlightUrl;

  try {
    const upstream = await fetch('https://readwise.io/api/v2/highlights/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token.trim()}`,
      },
      body: JSON.stringify({ highlights: [highlight] }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message =
        (data && (data.detail || data.error)) ||
        `${upstream.status} ${upstream.statusText}`;
      return res.status(upstream.status).json({ error: message, data });
    }
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[blackout-poetry] Readwise error:', err);
    res
      .status(500)
      .json({ error: (err && err.message) || 'Readwise request failed' });
  }
};
