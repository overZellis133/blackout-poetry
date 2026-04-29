import {
  Fragment,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import './App.css';

const DEFAULT_AI_PROMPT =
  'Find a striking, emotionally resonant poem hidden inside this text. Choose words that read beautifully in the order they appear. Aim for about 10–25 kept words. Let it be evocative, mysterious, and condensed.';

const SAMPLES = [
  {
    title: 'Frankenstein — Mary Shelley',
    text: `You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.

I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight. Do you understand this feeling? This breeze, which has travelled from the regions towards which I am advancing, gives me a foretaste of those icy climes.

Inspirited by this wind of promise, my daydreams become more fervent and vivid. I try in vain to be persuaded that the pole is the seat of frost and desolation; it ever presents itself to my imagination as the region of beauty and delight. There, Margaret, the sun is forever visible, its broad disk just skirting the horizon and diffusing a perpetual splendour.`,
  },
  {
    title: 'Walden — Henry David Thoreau',
    text: `I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.

I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms.`,
  },
  {
    title: 'Pride and Prejudice — Jane Austen',
    text: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"`,
  },
  {
    title: 'Ozymandias — Percy Bysshe Shelley',
    text: `I met a traveller from an antique land,
Who said—"Two vast and trunkless legs of stone
Stand in the desert. Near them, on the sand,
Half sunk a shattered visage lies, whose frown,
And wrinkled lip, and sneer of cold command,
Tell that its sculptor well those passions read
Which yet survive, stamped on these lifeless things,
The hand that mocked them, and the heart that fed;
And on the pedestal, these words appear:
My name is Ozymandias, King of Kings;
Look on my Works, ye Mighty, and despair!
Nothing beside remains. Round the decay
Of that colossal Wreck, boundless and bare
The lone and level sands stretch far away."`,
  },
  {
    title: 'Moby-Dick — Herman Melville',
    text: `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.

It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can.`,
  },
];

function tokenize(text) {
  const lines = text.split('\n');
  return lines.map((rawLine, lineIdx) => {
    if (rawLine.length === 0) return [];
    const parts = rawLine
      .split(/(\s+|—|–|--+)/)
      .filter((p) => p.length > 0);
    return parts.map((p, partIdx) => {
      const isSpace = /^\s+$/.test(p);
      const seed =
        lineIdx * 31 + partIdx * 7 + (p.charCodeAt(0) || 0) + (p.length * 13);
      return {
        id: `${lineIdx}-${partIdx}`,
        type: isSpace ? 'space' : 'word',
        value: p,
        rot: ((seed % 11) - 5) * 0.32,
        overL: 2 + (seed % 4),
        overR: 2 + ((seed * 13) % 4),
        vshift: ((seed * 17) % 5) - 2,
        opacity: 0.9 + ((seed % 9) * 0.011),
        riseDelay: (lineIdx * 55 + partIdx * 14) % 700,
        wobble: ((seed * 19) % 4) - 1.5,
      };
    });
  });
}

function renderAIPoem(aiPoem) {
  let counter = 0;
  return (
    <>
      <h2 className="poem-title">{aiPoem.title}</h2>
      {aiPoem.lines.map((line, lineIdx) => (
        <div key={lineIdx} className="poem-line">
          {line.map((tok, j) => {
            const delay = 240 + (counter++ * 40) % 800;
            return (
              <Fragment key={tok.id}>
                {j > 0 && ' '}
                <span
                  className="word"
                  style={{
                    '--rise-delay': `${delay}ms`,
                    '--wobble': `${tok.wobble}deg`,
                  }}
                >
                  <span className="word-text">{tok.value}</span>
                </span>
              </Fragment>
            );
          })}
        </div>
      ))}
    </>
  );
}

function renderPoem(lines, blacked) {
  const items = [];
  let pendingBlank = false;
  let hasEmitted = false;

  lines.forEach((line, lineIdx) => {
    if (line.length === 0) {
      if (hasEmitted) pendingBlank = true;
      return;
    }
    const kept = line.filter((t) => t.type === 'word' && !blacked[t.id]);
    if (kept.length === 0) return;
    if (pendingBlank) {
      items.push({ kind: 'blank', key: `b-${lineIdx}` });
      pendingBlank = false;
    }
    items.push({ kind: 'line', key: `l-${lineIdx}`, words: kept });
    hasEmitted = true;
  });

  if (items.length === 0) {
    return (
      <div className="poem-empty">an empty page is a kind of poem too</div>
    );
  }

  let wordCounter = 0;
  return items.map((item) => {
    if (item.kind === 'blank') {
      return (
        <div
          key={item.key}
          className="poem-stanza-break"
          aria-hidden="true"
        />
      );
    }
    return (
      <div key={item.key} className="poem-line">
        {item.words.map((tok, i) => {
          const delay = (wordCounter++ * 35) % 800;
          return (
            <Fragment key={tok.id}>
              {i > 0 && ' '}
              <span
                className="word"
                style={{
                  '--rise-delay': `${delay}ms`,
                  '--wobble': `${tok.wobble}deg`,
                }}
              >
                <span className="word-text">{tok.value}</span>
              </span>
            </Fragment>
          );
        })}
      </div>
    );
  });
}

function App() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [blacked, setBlacked] = useState({});
  const [view, setView] = useState('redact');
  const [revealKey, setRevealKey] = useState(0);
  const [surprising, setSurprising] = useState(false);
  const [dragMode, setDragMode] = useState(null); // null | 'black' | 'unblack'
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiPoem, setAiPoem] = useState(null); // {title, lines: [[token, ...], ...]}
  const canvasRef = useRef(null);

  const lines = useMemo(() => tokenize(text), [text]);

  const applyMode = useCallback((id, mode) => {
    setBlacked((prev) => {
      const isBlack = !!prev[id];
      if (mode === 'black') {
        if (isBlack) return prev;
        return { ...prev, [id]: true };
      }
      if (!isBlack) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAiPoem(null);
  }, []);

  const onWordPointerDown = (e, id, currentlyBlacked) => {
    if (view !== 'redact') return;
    e.preventDefault();
    const mode = currentlyBlacked ? 'unblack' : 'black';
    setDragMode(mode);
    applyMode(id, mode);
  };

  useEffect(() => {
    if (!dragMode) return;
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const wordEl = el.closest('[data-word-id]');
      if (!wordEl) return;
      applyMode(wordEl.getAttribute('data-word-id'), dragMode);
    };
    const onEnd = () => setDragMode(null);
    document.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragMode, applyMode]);

  const surpriseMe = () => {
    const next = {};
    const allWords = [];
    lines.forEach((line) =>
      line.forEach((t) => {
        if (t.type === 'word') allWords.push(t);
      }),
    );
    // Keep ~18% of words, weighted toward shorter / more poetic words
    allWords.forEach((t) => {
      const len = t.value.replace(/[^A-Za-z]/g, '').length;
      const keepBias = len <= 6 ? 0.22 : len <= 10 ? 0.16 : 0.08;
      if (Math.random() > keepBias) next[t.id] = true;
    });
    setSurprising(true);
    setBlacked({});
    setAiPoem(null);
    setTimeout(() => setBlacked(next), 40);
    setTimeout(() => setSurprising(false), 1100);
  };

  const clearMarks = () => {
    setBlacked({});
    setAiPoem(null);
  };

  const generateAIPoem = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const indexed = [];
      lines.forEach((line) => {
        line.forEach((tok) => {
          if (tok.type === 'word') indexed.push(tok);
        });
      });
      if (indexed.length === 0) {
        throw new Error('No words to work with — paste some text first.');
      }
      const numbered = indexed.map((w, i) => `[${i}] ${w.value}`).join(' ');

      const res = await fetch('/api/blackout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          words: numbered,
          count: indexed.length,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const keptSet = new Set(data.kept || []);
      const next = {};
      indexed.forEach((w, i) => {
        if (!keptSet.has(i)) next[w.id] = true;
      });

      const aiLines = (Array.isArray(data.lines) ? data.lines : [])
        .map((line) =>
          line
            .map((i) => indexed[i])
            .filter((tok) => tok && !next[tok.id]),
        )
        .filter((line) => line.length > 0);

      setBlacked(next);
      setAiPoem(
        aiLines.length > 0
          ? { title: data.title || 'Found poem', lines: aiLines }
          : null,
      );
      setSurprising(true);
      setTimeout(() => setSurprising(false), 1100);
    } catch (e) {
      setAiError(e && e.message ? e.message : 'Something went wrong');
    } finally {
      setAiLoading(false);
    }
  };

  const getPoemText = useCallback(() => {
    return lines
      .map((line) =>
        line
          .filter((t) => t.type === 'word' && !blacked[t.id])
          .map((t) => t.value)
          .join(' ')
          .trim(),
      )
      .filter((l) => l.length > 0)
      .join('\n');
  }, [lines, blacked]);

  const renderPoemToCanvas = useCallback(() => {
    const W = 900;
    const H = 1200;
    const scale = 2;
    const padX = 88;
    const padY = 110;
    const fontSize = 22;
    const lineH = 38;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const grad = ctx.createRadialGradient(W / 2, H / 3, 80, W / 2, H / 2, W);
    grad.addColorStop(0, '#fffaf0');
    grad.addColorStop(1, '#ece2c8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.font = `500 ${fontSize}px Georgia, "Iowan Old Style", serif`;
    ctx.textBaseline = 'top';
    const spaceWidth = ctx.measureText(' ').width;

    let y = padY;
    outer: for (const line of lines) {
      let x = padX;
      if (line.length === 0) {
        y += lineH;
        if (y > H - padY - 40) break;
        continue;
      }
      for (const tok of line) {
        if (tok.type === 'space') {
          x += spaceWidth * tok.value.length;
          continue;
        }
        const w = ctx.measureText(tok.value).width;
        if (x + w > W - padX && x > padX) {
          x = padX;
          y += lineH;
          if (y > H - padY - 40) break outer;
        }
        const isBlack = !!blacked[tok.id];
        if (isBlack) {
          ctx.save();
          const cx = x + w / 2;
          const cy = y + fontSize / 2 + 2;
          ctx.translate(cx, cy);
          ctx.rotate(((tok.rot || 0) * Math.PI) / 180);
          const overL = tok.overL || 3;
          const overR = tok.overR || 3;
          ctx.fillStyle = 'rgba(20,17,10,0.28)';
          ctx.fillRect(
            -w / 2 - overL - 2,
            -fontSize / 2 - 6,
            w + overL + overR + 4,
            fontSize + 12,
          );
          ctx.fillStyle = '#0a0905';
          ctx.fillRect(
            -w / 2 - overL,
            -fontSize / 2 - 4,
            w + overL + overR,
            fontSize + 8,
          );
          ctx.restore();
        } else {
          ctx.fillStyle = '#15110a';
          ctx.fillText(tok.value, x, y);
        }
        x += w;
      }
      y += lineH;
      if (y > H - padY - 40) break;
    }

    ctx.fillStyle = 'rgba(20,17,10,0.42)';
    ctx.font = '11px -apple-system, "Helvetica Neue", sans-serif';
    ctx.fillText('blackout.poetry', padX, H - 38);

    return canvas;
  }, [lines, blacked]);

  const downloadPNG = () => {
    const canvas = renderPoemToCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blackout-poem.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const printPoem = () => {
    const canvas = renderPoemToCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) return;
    w.document.write(
      `<!doctype html><html><head><title>Blackout Poem</title>
        <style>
          @page { size: auto; margin: 0.4in; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          img { display: block; width: 100%; max-width: 720px; }
          @media print { body { min-height: 0; } img { max-width: 100%; } }
        </style>
      </head><body>
        <img src="${dataUrl}" alt="Blackout poem" onload="setTimeout(function(){window.focus();window.print();}, 200)"/>
      </body></html>`,
    );
    w.document.close();
  };

  const sharePoem = async () => {
    const text = getPoemText();
    const shareText = text + '\n\n— made with blackout.poetry';
    try {
      const canvas = renderPoemToCanvas();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (blob && navigator.canShare) {
        const file = new File([blob], 'blackout-poem.png', {
          type: 'image/png',
        });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Blackout Poem',
            text: shareText,
            files: [file],
          });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: 'Blackout Poem', text: shareText });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    window.location.href = `sms:?&body=${encodeURIComponent(shareText)}`;
  };

  const loadSample = (idx) => {
    setText(SAMPLES[idx].text);
    setBlacked({});
    setAiPoem(null);
    setView('redact');
  };

  const handleViewChange = (next) => {
    if (next === view) return;
    setView(next);
    if (next === 'poem') setRevealKey((k) => k + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        setView((prev) => {
          const next = prev === 'redact' ? 'poem' : 'redact';
          if (next === 'poem') setRevealKey((k) => k + 1);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const wordCount = useMemo(
    () =>
      lines.reduce(
        (acc, l) => acc + l.filter((t) => t.type === 'word').length,
        0,
      ),
    [lines],
  );
  const blackedCount = Object.keys(blacked).length;
  const keptCount = Math.max(0, wordCount - blackedCount);

  return (
    <div
      className={`app ${surprising ? 'is-surprising' : ''} ${
        dragMode ? `is-dragging is-dragging-${dragMode}` : ''
      }`}
    >
      <header className="header">
        <h1 className="title">
          Blackout<span className="title-dot">.</span>
          <span className="title-soft">poetry</span>
        </h1>
        <div className="toolbar">
          <select
            className="sample-picker"
            onChange={(e) => {
              if (e.target.value === '') return;
              loadSample(parseInt(e.target.value, 10));
              e.target.value = '';
            }}
            defaultValue=""
            aria-label="Load sample text"
          >
            <option value="">Load sample…</option>
            {SAMPLES.map((s, i) => (
              <option key={i} value={i}>
                {s.title}
              </option>
            ))}
          </select>
          <button
            className="btn btn-accent"
            onClick={surpriseMe}
            title="Generate a found poem (random)"
          >
            ✦ Surprise me
          </button>
          <button
            className={`btn btn-ai ${aiOpen ? 'active' : ''}`}
            onClick={() => setAiOpen((v) => !v)}
            title="Have Claude pick the poem"
          >
            ✦ AI poem
          </button>
          <button className="btn" onClick={clearMarks} title="Remove all marks">
            Clear marks
          </button>
          <span className="toolbar-sep" aria-hidden="true" />
          <button
            className="btn"
            onClick={downloadPNG}
            disabled={keptCount === 0}
            title="Download poem as PNG"
          >
            PNG
          </button>
          <button
            className="btn"
            onClick={printPoem}
            disabled={keptCount === 0}
            title="Open print dialog (Save as PDF)"
          >
            PDF
          </button>
          <button
            className="btn"
            onClick={sharePoem}
            disabled={keptCount === 0}
            title="Share poem (SMS, message apps)"
          >
            Share
          </button>
          <span className="toolbar-sep" aria-hidden="true" />
          <div className="view-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={view === 'redact'}
              className={`tog ${view === 'redact' ? 'active' : ''}`}
              onClick={() => handleViewChange('redact')}
            >
              Redact
            </button>
            <button
              role="tab"
              aria-selected={view === 'poem'}
              className={`tog ${view === 'poem' ? 'active' : ''}`}
              onClick={() => handleViewChange('poem')}
            >
              Poem
            </button>
          </div>
        </div>
      </header>

      {aiOpen && (
        <div className="ai-panel">
          <label className="ai-label">
            Tell Claude what kind of poem to find
          </label>
          <textarea
            className="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., A melancholy poem about loss in three short lines…"
            rows={2}
            disabled={aiLoading}
            spellCheck={false}
          />
          <div className="ai-actions">
            <button
              className="btn btn-small"
              onClick={() => setAiPrompt(DEFAULT_AI_PROMPT)}
              disabled={aiLoading}
              type="button"
            >
              Reset prompt
            </button>
            <span className="ai-spacer" />
            {aiError && <span className="ai-error">{aiError}</span>}
            <button
              className="btn btn-accent"
              onClick={generateAIPoem}
              disabled={aiLoading || !aiPrompt.trim()}
              type="button"
            >
              {aiLoading ? 'Reading…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      <main className={`workspace view-${view}`}>
        <section className="pane source-pane">
          <label className="pane-label">Source</label>
          <textarea
            className="source-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setAiPoem(null);
            }}
            spellCheck={false}
            placeholder="Paste any text here…"
            aria-label="Source text"
          />
        </section>

        <section className="pane canvas-pane">
          <label className="pane-label">
            {view === 'redact' ? (
              <span>
                Click words to black them out
                {blackedCount > 0 && (
                  <span className="label-dim"> · click again to undo</span>
                )}
              </span>
            ) : (
              <span>
                {keptCount === 0
                  ? 'an empty page is a kind of poem too'
                  : `${keptCount} ${
                      keptCount === 1 ? 'word survives' : 'words survive'
                    }`}
              </span>
            )}
          </label>
          <div
            className={`canvas canvas-${view}`}
            ref={canvasRef}
            key={view === 'poem' ? `poem-${revealKey}` : 'redact'}
          >
            {view === 'poem'
              ? aiPoem
                ? renderAIPoem(aiPoem)
                : renderPoem(lines, blacked)
              : lines.map((line, lineIdx) => (
              <div key={lineIdx} className="line">
                {line.length === 0
                  ? ' '
                  : line.map((token) => {
                      if (token.type === 'space') {
                        return (
                          <span key={token.id} className="space">
                            {token.value}
                          </span>
                        );
                      }
                      const isBlack = !!blacked[token.id];
                      return (
                        <span
                          key={token.id}
                          data-word-id={token.id}
                          className={`word ${isBlack ? 'blacked' : ''}`}
                          onPointerDown={
                            view === 'redact'
                              ? (e) =>
                                  onWordPointerDown(e, token.id, isBlack)
                              : undefined
                          }
                          style={{
                            '--rot': `${token.rot}deg`,
                            '--overL': `${token.overL}px`,
                            '--overR': `${token.overR}px`,
                            '--vshift': `${token.vshift}px`,
                            '--ink-opacity': token.opacity,
                            '--rise-delay': `${token.riseDelay}ms`,
                            '--wobble': `${token.wobble}deg`,
                          }}
                        >
                          <span className="word-text">{token.value}</span>
                        </span>
                      );
                    })}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="hint">
          Press <kbd>Tab</kbd> to toggle view
        </span>
        <span className="counts">
          {blackedCount} redacted · {keptCount} kept
        </span>
      </footer>
    </div>
  );
}

export default App;
