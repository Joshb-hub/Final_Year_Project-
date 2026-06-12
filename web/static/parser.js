/**
 * AegisRAG — Markdown + LaTeX renderer
 * Converts the mixed Markdown/LaTeX output from Gemini into clean, readable HTML.
 *
 * Handles:
 *   Markdown : **bold**, *italic*, ***bold-italic***, `code`, ```blocks```,
 *              # headings, - / * / + bullet lists, 1. ordered lists,
 *              > blockquotes, --- horizontal rules, | tables |
 *   LaTeX    : \textbf{}, \textit{}, \emph{}, \underline{},
 *              \frac{a}{b}, x^{n}, x_{n}, $inline$, $$display$$,
 *              Greek letters, math operators, arrows, set symbols, …
 */

// ── Greek & math symbol map ───────────────────────────────────
const SYM = {
  // Lowercase Greek
  '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε',
  '\\varepsilon':'ε','\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\vartheta':'ϑ',
  '\\iota':'ι','\\kappa':'κ','\\lambda':'λ','\\mu':'μ','\\nu':'ν',
  '\\xi':'ξ','\\pi':'π','\\varpi':'ϖ','\\rho':'ρ','\\varrho':'ϱ',
  '\\sigma':'σ','\\varsigma':'ς','\\tau':'τ','\\upsilon':'υ',
  '\\phi':'φ','\\varphi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω',
  // Uppercase Greek
  '\\Alpha':'Α','\\Beta':'Β','\\Gamma':'Γ','\\Delta':'Δ','\\Epsilon':'Ε',
  '\\Zeta':'Ζ','\\Eta':'Η','\\Theta':'Θ','\\Iota':'Ι','\\Kappa':'Κ',
  '\\Lambda':'Λ','\\Mu':'Μ','\\Nu':'Ν','\\Xi':'Ξ','\\Pi':'Π',
  '\\Rho':'Ρ','\\Sigma':'Σ','\\Tau':'Τ','\\Upsilon':'Υ',
  '\\Phi':'Φ','\\Chi':'Χ','\\Psi':'Ψ','\\Omega':'Ω',
  // Operators
  '\\times':'×','\\div':'÷','\\cdot':'·','\\pm':'±','\\mp':'∓',
  '\\leq':'≤','\\le':'≤','\\geq':'≥','\\ge':'≥','\\neq':'≠','\\ne':'≠',
  '\\approx':'≈','\\equiv':'≡','\\sim':'∼','\\simeq':'≃','\\cong':'≅',
  '\\propto':'∝','\\ll':'≪','\\gg':'≫',
  // Set & logic
  '\\in':'∈','\\notin':'∉','\\subset':'⊂','\\subseteq':'⊆',
  '\\supset':'⊃','\\supseteq':'⊇','\\cup':'∪','\\cap':'∩',
  '\\emptyset':'∅','\\varnothing':'∅','\\forall':'∀','\\exists':'∃',
  '\\nexists':'∄','\\neg':'¬','\\land':'∧','\\lor':'∨','\\oplus':'⊕',
  // Arrows
  '\\to':'→','\\gets':'←','\\rightarrow':'→','\\leftarrow':'←',
  '\\leftrightarrow':'↔','\\Rightarrow':'⇒','\\Leftarrow':'⇐',
  '\\Leftrightarrow':'⇔','\\uparrow':'↑','\\downarrow':'↓',
  '\\nearrow':'↗','\\searrow':'↘','\\mapsto':'↦',
  // Calculus / analysis
  '\\infty':'∞','\\partial':'∂','\\nabla':'∇','\\int':'∫',
  '\\iint':'∬','\\iiint':'∭','\\oint':'∮','\\sum':'∑','\\prod':'∏',
  '\\sqrt':'√','\\therefore':'∴','\\because':'∵',
  // Dots
  '\\ldots':'…','\\cdots':'⋯','\\vdots':'⋮','\\ddots':'⋱',
  // Misc
  '\\hbar':'ℏ','\\ell':'ℓ','\\Re':'ℜ','\\Im':'ℑ','\\wp':'℘',
  '\\aleph':'ℵ','\\prime':'′','\\dagger':'†','\\ddagger':'‡',
  '\\bullet':'•','\\circ':'∘','\\star':'★','\\diamond':'◇',
  '\\triangle':'△','\\angle':'∠','\\perp':'⊥','\\parallel':'∥',
  '\\langle':'⟨','\\rangle':'⟩','\\lceil':'⌈','\\rceil':'⌉',
  '\\lfloor':'⌊','\\rfloor':'⌋',
  // Formatting aliases
  '\\quad':' ','\\qquad':'  ','\\,':' ','\\;':' ','\\!':'',
  '\\text{':'', // handled separately
};

// Superscript & subscript unicode maps (for common chars)
const SUP_MAP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ',
  'j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ',
  't':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','*':'*','T':'ᵀ','n':'ⁿ',
};
const SUB_MAP = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','o':'ₒ','u':'ᵤ','r':'ᵣ','v':'ᵥ','x':'ₓ','n':'ₙ',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};

function toSup(s) { return [...s].map(c => SUP_MAP[c] || `<sup>${escHtml(c)}</sup>`).join(''); }
function toSub(s) { return [...s].map(c => SUB_MAP[c] || `<sub>${escHtml(c)}</sub>`).join(''); }

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Balance braces: extract {content} starting after opening brace ──
function extractBraced(str, start) {
  let depth = 0, i = start;
  for (; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') { depth--; if (depth === 0) return [str.slice(start + 1, i), i]; }
  }
  return [str.slice(start + 1), str.length];
}

// ── Math expression renderer ───────────────────────────────────
function renderMath(expr) {
  let s = expr.trim();

  // \frac{a}{b}
  s = s.replace(/\\frac\s*\{/g, (_, pos, full) => {
    // handled below iteratively
    return '\\frac{';
  });

  // Iteratively replace \frac{num}{den}
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\frac\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,
      (_, num, den) => `<span class="math-frac"><sup>${renderMath(num)}</sup><span class="frac-slash">/</span><sub>${renderMath(den)}</sub></span>`
    );
  }

  // \sqrt{x}
  s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, (_, x) => `√<span class="math-sqrt-body">${renderMath(x)}</span>`);
  s = s.replace(/\\sqrt\s+(\S+)/g, (_, x) => `√${renderMath(x)}`);

  // \text{...}
  s = s.replace(/\\text\{([^{}]+)\}/g, (_, t) => escHtml(t));
  s = s.replace(/\\mathrm\{([^{}]+)\}/g, (_, t) => `<span class="math-rm">${escHtml(t)}</span>`);
  s = s.replace(/\\mathbf\{([^{}]+)\}/g, (_, t) => `<strong>${renderMath(t)}</strong>`);
  s = s.replace(/\\mathit\{([^{}]+)\}/g, (_, t) => `<em>${renderMath(t)}</em>`);

  // Superscripts: x^{abc} or x^a
  s = s.replace(/\^\{([^{}]+)\}/g, (_, exp) => {
    const inner = renderMath(exp);
    // If single chars, try unicode
    if ([...exp].length === 1 && SUP_MAP[exp]) return toSup(exp);
    return `<sup>${inner}</sup>`;
  });
  s = s.replace(/\^([a-zA-Z0-9])/g, (_, c) => SUP_MAP[c] ? toSup(c) : `<sup>${escHtml(c)}</sup>`);

  // Subscripts: x_{abc} or x_a
  s = s.replace(/\_\{([^{}]+)\}/g, (_, sub) => {
    const inner = renderMath(sub);
    if ([...sub].length === 1 && SUB_MAP[sub]) return toSub(sub);
    return `<sub>${inner}</sub>`;
  });
  s = s.replace(/\_([a-zA-Z0-9])/g, (_, c) => SUB_MAP[c] ? toSub(c) : `<sub>${escHtml(c)}</sub>`);

  // Symbol replacements (sorted longest first to avoid partial matches)
  const symKeys = Object.keys(SYM).sort((a, b) => b.length - a.length);
  for (const key of symKeys) {
    // Escape for regex; handle keys without special regex meaning
    const escaped = key.replace(/\\/g, '\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}');
    try {
      s = s.replace(new RegExp(escaped, 'g'), SYM[key]);
    } catch {}
  }

  // Remove stray braces left over
  s = s.replace(/\{|\}/g, '');

  return s;
}

// ── Inline math $...$ ─────────────────────────────────────────
function processInlineMath(s) {
  // Protect $$ first
  const display = [];
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    display.push(expr);
    return `\x00DISPLAY${display.length - 1}\x00`;
  });

  // Inline $...$
  s = s.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    return `<span class="math-inline">${renderMath(expr)}</span>`;
  });

  // Restore display math
  s = s.replace(/\x00DISPLAY(\d+)\x00/g, (_, i) => {
    return `<div class="math-block">${renderMath(display[+i])}</div>`;
  });

  return s;
}

// ── LaTeX text commands ───────────────────────────────────────
function processLatexCommands(s) {
  // \textbf{...}
  s = s.replace(/\\textbf\{([^{}]+)\}/g, (_, t) => `<strong>${t}</strong>`);
  s = s.replace(/\\mathbf\{([^{}]+)\}/g, (_, t) => `<strong>${t}</strong>`);
  // \textit{...} / \emph{...}
  s = s.replace(/\\textit\{([^{}]+)\}/g, (_, t) => `<em>${t}</em>`);
  s = s.replace(/\\emph\{([^{}]+)\}/g,   (_, t) => `<em>${t}</em>`);
  // \underline{...}
  s = s.replace(/\\underline\{([^{}]+)\}/g, (_, t) => `<u>${t}</u>`);
  // \texttt{...}
  s = s.replace(/\\texttt\{([^{}]+)\}/g, (_, t) => `<code>${escHtml(t)}</code>`);
  // \section{}, \subsection{}, \subsubsection{}
  s = s.replace(/\\subsubsection\*?\{([^{}]+)\}/g, (_, t) => `<h4 class="latex-h4">${t}</h4>`);
  s = s.replace(/\\subsection\*?\{([^{}]+)\}/g,    (_, t) => `<h3 class="latex-h3">${t}</h3>`);
  s = s.replace(/\\section\*?\{([^{}]+)\}/g,       (_, t) => `<h2 class="latex-h2">${t}</h2>`);
  // \paragraph{...}
  s = s.replace(/\\paragraph\*?\{([^{}]+)\}/g, (_, t) => `<p><strong>${t}</strong></p>`);
  // \item inside itemize/enumerate (strip env tags first)
  s = s.replace(/\\begin\{(itemize|enumerate|description)\}/g, (_, env) =>
    env === 'enumerate' ? '<ol class="latex-ol">' : '<ul class="latex-ul">'
  );
  s = s.replace(/\\end\{(itemize|enumerate|description)\}/g, (_, env) =>
    env === 'enumerate' ? '</ol>' : '</ul>'
  );
  s = s.replace(/\\item\s*/g, '<li>');
  // \newline or \\
  s = s.replace(/\\\\(\s*)/g, '<br>');
  s = s.replace(/\\newline\s*/g, '<br>');
  // \hline (table rule) → ignored
  s = s.replace(/\\hline/g, '');
  // \noindent, \centering, etc.
  s = s.replace(/\\(noindent|centering|raggedright|raggedleft|normalfont|normalsize)\b\s*/g, '');
  // \cite{...} → [ref]
  s = s.replace(/\\cite\{([^{}]+)\}/g, (_, r) => `<cite>[${r}]</cite>`);
  // \label{}, \ref{...}
  s = s.replace(/\\label\{([^{}]+)\}/g, '');
  s = s.replace(/\\ref\{([^{}]+)\}/g, (_, r) => `[${r}]`);
  // Remove remaining unknown \command (but keep content)
  s = s.replace(/\\[a-zA-Z]+\*?\s*/g, '');

  return s;
}

// ── Markdown block-level elements ─────────────────────────────
function processBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const raw  = line.trimEnd();

    // Fenced code block ```
    if (/^```/.test(raw)) {
      const lang  = raw.slice(3).trim();
      const code  = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(escHtml(lines[i])); i++; }
      out.push(`<pre class="code-block"><code${lang ? ` class="lang-${escHtml(lang)}"` : ''}>${code.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // Headings
    const hm = raw.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      const lvl = Math.min(hm[1].length + 1, 6); // h2–h6 to avoid competing with page h1
      out.push(`<h${lvl} class="md-h${lvl}">${processInline(hm[2])}</h${lvl}>`);
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(raw)) {
      out.push('<hr class="md-hr">');
      i++; continue;
    }

    // Blockquote
    if (/^>\s?/.test(raw)) {
      const bqLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote class="md-bq">${processBlocks(bqLines)}</blockquote>`);
      continue;
    }

    // Table (line contains |)
    if (/\|/.test(raw) && i + 1 < lines.length && /^\|?[\s\-:]+\|/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && /\|/.test(lines[i])) { tableLines.push(lines[i]); i++; }
      out.push(renderTable(tableLines));
      continue;
    }

    // Unordered list
    if (/^(\s*)[-*+]\s+/.test(raw)) {
      const items = [];
      while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${processInline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul class="md-ul">${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(raw)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${processInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol class="md-ol">${items.join('')}</ol>`);
      continue;
    }

    // Blank line → paragraph separator
    if (raw.trim() === '') {
      out.push('<div class="md-spacer"></div>');
      i++; continue;
    }

    // Paragraph line
    out.push(`<p class="md-p">${processInline(raw)}</p>`);
    i++;
  }

  return out.join('\n');
}

// ── Table renderer ────────────────────────────────────────────
function renderTable(lines) {
  const rows = lines.map(l =>
    l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  );
  const sep = rows.findIndex(r => r.every(c => /^[-:]+$/.test(c)));
  const head = sep > 0 ? rows.slice(0, sep) : [];
  const body = sep >= 0 ? rows.slice(sep + 1) : rows;

  let html = '<div class="table-wrap"><table class="md-table">';
  if (head.length) {
    html += '<thead>';
    head.forEach(row => {
      html += '<tr>' + row.map(c => `<th>${processInline(c)}</th>`).join('') + '</tr>';
    });
    html += '</thead>';
  }
  html += '<tbody>';
  body.forEach(row => {
    html += '<tr>' + row.map(c => `<td>${processInline(c)}</td>`).join('') + '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// ── Inline element processor ──────────────────────────────────
function processInline(s) {
  // Protect inline code first
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\x01CODE${codes.length - 1}\x01`;
  });

  // Process math
  s = processInlineMath(s);

  // LaTeX text commands
  s = processLatexCommands(s);

  // Inline symbols (outside math) — apply common ones
  for (const [k, v] of Object.entries(SYM)) {
    if (s.includes(k)) {
      try {
        const re = new RegExp(k.replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}'), 'g');
        s = s.replace(re, v);
      } catch {}
    }
  }

  // Bold-italic ***text***
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold **text** or __text__
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic *text* or _text_ (not inside words)
  s = s.replace(/(^|[\s(])\*([^*\n]+?)\*([\s).,;!?]|$)/g, '$1<em>$2</em>$3');
  s = s.replace(/(^|[\s(])_([^_\n]+?)_([\s).,;!?]|$)/g, '$1<em>$2</em>$3');
  // ~~strikethrough~~
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Em-dash and en-dash
  s = s.replace(/---/g, '—');
  s = s.replace(/--/g, '–');

  // Restore inline code
  s = s.replace(/\x01CODE(\d+)\x01/g, (_, i) => `<code class="inline-code">${escHtml(codes[+i])}</code>`);

  return s;
}

// ── Main entry point ──────────────────────────────────────────
export function renderContent(text) {
  if (!text) return '';

  // Protect fenced code blocks from all processing
  const fenced = [];
  let s = text.replace(/```([\s\S]*?)```/g, (m) => {
    fenced.push(m);
    return `\x02FENCED${fenced.length - 1}\x02`;
  });

  // Split into lines and process blocks
  const lines = s.split('\n');
  let html = processBlocks(lines);

  // Restore fenced code blocks (they were stringified as placeholder in lines)
  // Actually they appear as single lines; processBlocks handles them already.
  // But if any are still left as tokens:
  html = html.replace(/\x02FENCED(\d+)\x02/g, (_, i) => {
    const raw = fenced[+i];
    const match = raw.match(/^```(\w*)\n([\s\S]*?)\n?```$/);
    if (match) {
      const [, lang, code] = match;
      return `<pre class="code-block"><code${lang ? ` class="lang-${escHtml(lang)}"` : ''}>${escHtml(code)}</code></pre>`;
    }
    return `<pre class="code-block"><code>${escHtml(raw.replace(/^```|```$/g, ''))}</code></pre>`;
  });

  // Collapse excessive spacers
  html = html.replace(/(<div class="md-spacer"><\/div>){3,}/g,
    '<div class="md-spacer"></div><div class="md-spacer"></div>');

  return html;
}
