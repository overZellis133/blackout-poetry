const Anthropic = require('@anthropic-ai/sdk').default;

const SYSTEM_PROMPT = `You are a poet practicing the art of "blackout poetry," where you find a poem hidden inside an existing passage by selecting a small subset of its words to keep — in their original order — and blacking out everything else.

You will be given:
1. A creative direction from the user describing the kind of poem they want.
2. A passage of source text where each token is preceded by its index in square brackets, e.g. "[0] You [1] will [2] rejoice ...". Tokens include words, punctuation attached to words, and stand-alone marks like em-dashes.

Your task — return three things in JSON:

1. A TITLE for the poem (1–7 words). The title should arise from considering the kept words as a single unified idea — the emotional or thematic center the poem orbits around. The title should NOT just repeat words from the poem verbatim; it should name the *idea*. Avoid generic titles like "Untitled" or "A Poem."

2. The poem's LINES, as an array of arrays of indices. Each inner array is one line of the poem; each integer is a token index from the source. Indices must be strictly ascending within a line AND across lines (kept words always appear in their original order). Each index appears in exactly one line.

3. The line breaks themselves are the craft. Choose them deliberately:
   - Short lines for emphasis, breath, a held silence.
   - Longer lines for flow and forward motion.
   - Group words that belong together rhythmically; break where the reader should pause.
   - Vary line lengths — uniformity is dull. Aim for 3–8 lines unless the direction asks otherwise.

Other guidelines:
- Default kept-word target: about 10–25 total words across all lines.
- Be artistic and surprising. Choose words that resonate, juxtapose interestingly, and flow when read together.
- Trust silence. A spare, condensed poem is often stronger than a dense one.
- Kept words don't need to form perfect grammar; evocative fragments are great.

Return ONLY the JSON object matching the schema. No prose, no commentary, no code fences.`;

const POEM_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description:
        'An evocative title (1–7 words) drawn from the unified idea behind the kept words. Names the theme rather than just echoing the words.',
    },
    lines: {
      type: 'array',
      description:
        'The poem, broken into lines. Each item is an array of token indices for one line. Indices must be strictly ascending within and across lines.',
      items: {
        type: 'array',
        items: { type: 'integer' },
      },
    },
  },
  required: ['title', 'lines'],
  additionalProperties: false,
};

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error:
        'ANTHROPIC_API_KEY is not set. Configure it as an environment variable on the server.',
    });
  }

  const { prompt, words, count } = readBody(req);
  if (typeof words !== 'string' || typeof count !== 'number' || count <= 0) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const direction =
    (typeof prompt === 'string' ? prompt.trim() : '') ||
    'Find a striking, evocative poem hidden in the text.';

  const userMessage = `Direction:\n${direction}\n\nSource passage (each word preceded by its index):\n${words}\n\nThere are ${count} words total (indices 0 through ${count - 1}). Return JSON with the indices to keep.`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        format: { type: 'json_schema', schema: POEM_SCHEMA },
        effort: 'medium',
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const textOut = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed;
    try {
      parsed = JSON.parse(textOut);
    } catch (e) {
      const match = textOut.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Model did not return JSON: ' + textOut.slice(0, 200));
      }
      parsed = JSON.parse(match[0]);
    }

    const title =
      typeof parsed?.title === 'string' && parsed.title.trim().length > 0
        ? parsed.title.trim()
        : 'Found poem';

    const seen = new Set();
    const rawLines = Array.isArray(parsed?.lines) ? parsed.lines : [];
    const lines = [];
    for (const rawLine of rawLines) {
      if (!Array.isArray(rawLine)) continue;
      const cleaned = [];
      for (const v of rawLine) {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n >= count) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        cleaned.push(n);
      }
      cleaned.sort((a, b) => a - b);
      if (cleaned.length > 0) lines.push(cleaned);
    }

    const kept = Array.from(seen);

    res.json({
      title,
      lines,
      kept,
      usage: response.usage,
      stop_reason: response.stop_reason,
    });
  } catch (err) {
    console.error('[blackout-poetry] AI error:', err);
    const status = err && err.status ? err.status : 500;
    const message = err && err.message ? err.message : 'Server error';
    res.status(status).json({ error: message });
  }
};
