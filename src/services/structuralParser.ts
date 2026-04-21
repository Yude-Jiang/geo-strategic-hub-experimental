/**
 * Structural Parser for RAG Sources
 *
 * Inspired by AgentGEO's StructuralHtmlParser — adds semantic type labels to
 * document chunks so the LLM knows what kind of content each block is and can
 * prioritise high-value citable data (spec tables, dense facts) over prose.
 *
 * Design principle: heuristic pattern matching only — no ML dependency.
 * Each chunk gets a geoWeight (0–1); high-weight chunks are surfaced first
 * in the annotated context (BLUF approach from RAID G-SEO paper).
 */

export type ChunkType =
  | 'spec_table'    // Specification data: voltage, freq, temp range, memory sizes…
  | 'code_example'  // Code snippets — highly citable for developer-focused AI queries
  | 'comparison'    // Comparative content: vs competitor, alternative, better than
  | 'headline'      // Section headers — structural anchors for the LLM
  | 'dense_fact'    // Short factual sentences with model numbers, prices, percentages
  | 'narrative';    // General descriptive prose — lowest GEO value

export interface StructuredChunk {
  type: ChunkType;
  content: string;
  geoWeight: number;   // 0–1 composite score; drives sort order in annotated output
  charOffset: number;  // byte offset in original text — useful for debugging
}

// ─── Heuristic Classifier ────────────────────────────────────────────────────

const SPEC_UNIT_RE = /\d+\s*(V|mV|MHz|GHz|kHz|mA|μA|nA|°C|KB|MB|GB|dBm|ms|μs|ns|bps|Mbps|Kbps|W|mW|mm|μm|Ω|kΩ|pF|nF)\b/;

function classifyChunk(text: string): { type: ChunkType; geoWeight: number } {
  const t = text.trim();

  // Code blocks: fenced or indented, or contains common programming tokens
  if (/```[\s\S]|^\s{4}[\w#<]/.test(t) || /\b(void|int|uint|#include|import|def |function |class |const |return )\b/.test(t))
    return { type: 'code_example', geoWeight: 0.85 };

  // Spec tables: markdown pipe tables OR lines dense with measurement units
  if (/\|.+\|/.test(t) || SPEC_UNIT_RE.test(t))
    return { type: 'spec_table', geoWeight: 0.95 };

  // Comparison language
  if (/\b(vs\.?|versus|compared to|alternative to|instead of|better than|unlike|replaces|equivalent to)\b/i.test(t))
    return { type: 'comparison', geoWeight: 0.80 };

  // Headlines: markdown H1-H4 or ALL-CAPS short lines (PDF section headers after extraction)
  if (/^#{1,4}\s/.test(t) || (t.length < 80 && t === t.toUpperCase() && /[A-Z]/.test(t)))
    return { type: 'headline', geoWeight: 0.60 };

  // Dense facts: short text with prices, part numbers, or percentages
  if (t.length < 200 && /\$[\d.]+|\b[A-Z]{2,4}\d{3,}[A-Z0-9]*|\d+(\.\d+)?\s*%/.test(t))
    return { type: 'dense_fact', geoWeight: 0.90 };

  return { type: 'narrative', geoWeight: 0.40 };
}

// ─── Chunker ─────────────────────────────────────────────────────────────────

export function parseIntoChunks(rawText: string): StructuredChunk[] {
  // Split on blank lines or markdown heading starts; discard tiny fragments
  const segments = rawText
    .split(/\n{2,}|(?=^#{1,4}\s)/m)
    .filter(s => s.trim().length > 20);

  let offset = 0;
  return segments.map(seg => {
    const { type, geoWeight } = classifyChunk(seg);
    const chunk: StructuredChunk = {
      type,
      content: seg.trim(),
      geoWeight,
      charOffset: offset,
    };
    offset += seg.length + 2; // +2 for the \n\n separator
    return chunk;
  });
}

// ─── Annotated Context Builder ────────────────────────────────────────────────
//
// Produces a string like:
//
//   [SPEC_TABLE]
//   | Parameter | Value |
//   | VDDA      | 1.8V  |
//
//   ---
//
//   [DENSE_FACT]
//   STM32C5 entry price: $0.64 at 10K units
//
//   ---
//
//   [NARRATIVE]
//   The device is designed for IoT applications…
//
// High-weight chunks are placed first (BLUF — bottom-line up front) so LLMs
// reading the context under token limits encounter the most citable data first.

export function buildAnnotatedContext(
  rawText: string,
  maxChars = 12000
): string {
  if (!rawText || !rawText.trim()) return '*(no source content provided)*';

  const chunks = parseIntoChunks(rawText);

  // Sort descending by geoWeight — spec data surfaces before narrative
  const sorted = [...chunks].sort((a, b) => b.geoWeight - a.geoWeight);

  const lines: string[] = [];
  let used = 0;

  for (const chunk of sorted) {
    const block = `[${chunk.type.toUpperCase()}]\n${chunk.content}`;
    if (used + block.length > maxChars) break;
    lines.push(block);
    used += block.length;
  }

  return lines.join('\n\n---\n\n');
}

// ─── GEO Signal Audit ────────────────────────────────────────────────────────
//
// Computes measurable content-quality proxies that correlate with AI citation
// frequency (per GEO 2311.09735 Table 1). All computation is local — no API.
// Used for before/after comparison in Step 3 production output.

export interface GeoSignals {
  /** Numeric values with measurement units (e.g. "2.1μA", "$0.64", "40%") */
  quantifiedClaims: number;
  /** Hedged/uncertain language tokens that weaken authority */
  hedgeWords: number;
  /** Recognised semiconductor/tech term occurrences */
  techTerms: number;
  /** SPEC_TABLE + DENSE_FACT + CODE_EXAMPLE + COMPARISON chunk count */
  citableChunks: number;
  /** True if a quantified claim appears within the first 150 characters (倒金字塔) */
  blufCompliance: boolean;
  /** Total word count */
  wordCount: number;
}

const QUANT_RE = /\d+\.?\d*\s*(μA|mA|A|MHz|GHz|kHz|kB|KB|MB|GB|ms|μs|ns|°C|V|mV|W|mW|dBm|bps|Mbps|%|\$|USD|RMB|元)/gi;
const HEDGE_RE = /\b(might|could|may|perhaps|possibly|some argue|it is believed|generally|typically|usually|often|sometimes|can be|tends to)\b/gi;
const TECH_RE  = /\b(Cortex-M\d+\+?|TrustZone|TEE|BLE\s*\d|Matter\s*\d|Thread|Zigbee|PSA\s*Certified|CC\s*EAL\d|SESIP\d|AEC-Q\d+|JEDEC|secure\s*boot|Root\s*of\s*Trust|datasheet|application\s*note|AN\d{4}|STM32\w+|nRF\d+|ESP\d+|RP\d+)\b/gi;
const HIGH_WEIGHT_TYPES: ChunkType[] = ['spec_table', 'dense_fact', 'code_example', 'comparison'];

export function computeGeoSignals(text: string): GeoSignals {
  if (!text || !text.trim()) {
    return { quantifiedClaims: 0, hedgeWords: 0, techTerms: 0, citableChunks: 0, blufCompliance: false, wordCount: 0 };
  }
  const chunks = parseIntoChunks(text);
  const first150 = text.slice(0, 150);
  return {
    quantifiedClaims: (text.match(QUANT_RE) || []).length,
    hedgeWords:       (text.match(HEDGE_RE) || []).length,
    techTerms:        (text.match(TECH_RE)  || []).length,
    citableChunks:    chunks.filter(c => HIGH_WEIGHT_TYPES.includes(c.type)).length,
    blufCompliance:   QUANT_RE.test(first150),
    wordCount:        text.trim().split(/\s+/).length,
  };
}

// ─── Stats helper (used for UI diagnostics) ──────────────────────────────────

export interface ParseStats {
  total: number;
  byType: Record<ChunkType, number>;
  topWeightChunks: number; // count of chunks with geoWeight >= 0.85
}

export function getParseStats(rawText: string): ParseStats {
  const chunks = parseIntoChunks(rawText);
  const byType = {
    spec_table: 0, code_example: 0, comparison: 0,
    headline: 0, dense_fact: 0, narrative: 0,
  } as Record<ChunkType, number>;
  for (const c of chunks) byType[c.type]++;
  return {
    total: chunks.length,
    byType,
    topWeightChunks: chunks.filter(c => c.geoWeight >= 0.85).length,
  };
}
