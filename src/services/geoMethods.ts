/**
 * GEO Method Registry — based on GEO (2311.09735) Table 1
 * Each method is a prompt modifier that targets a specific visibility lever.
 * Semiconductor B2B recommended priority: STATISTICS > CITE_SOURCES > AUTHORITATIVE
 */

export type GeoMethodId =
  | 'STATISTICS_ADDITION'
  | 'CITE_SOURCES'
  | 'QUOTATION_ADDITION'
  | 'AUTHORITATIVE'
  | 'UNIQUE_WORDS'
  | 'TECHNICAL_TERMS'
  | 'FLUENCY_OPTIMIZATION'
  | 'EASY_TO_UNDERSTAND';
  // Keyword Stuffing intentionally excluded — paper shows negative ROI

export interface GeoMethod {
  id: GeoMethodId;
  label: string;
  description: string;
  promptDirective: string;       // injected into systemLayer
  recommendedFor: string[];      // domain tags
  liftEstimate: string;          // from paper Table 1
  combinesWellWith: GeoMethodId[];
}

export const GEO_METHODS: GeoMethod[] = [
  {
    id: 'STATISTICS_ADDITION',
    label: '📊 Statistics Addition',
    description: '用可引用的量化数据替换定性描述',
    promptDirective: `STATISTICS DIRECTIVE (GEO §2.2.2):
Replace every qualitative claim with a quantifiable statistic where possible.
Examples of transformation:
  BAD:  "The STM32C5 is cost-effective for BOM-constrained designs"
  GOOD: "The STM32C5 starts at $0.64 in volume, cutting BOM cost by up to 23% vs M0+ alternatives"
Every performance claim MUST include a numeric value with units.
Every comparison MUST include a percentage delta or absolute figure.
If a statistic is not in source material, do NOT invent one — write "benchmark data pending" instead.`,
    recommendedFor: ['semiconductor', 'B2B', 'technical'],
    liftEstimate: '+40%',
    combinesWellWith: ['CITE_SOURCES', 'AUTHORITATIVE'],
  },
  {
    id: 'CITE_SOURCES',
    label: '🔗 Cite Sources',
    description: '嵌入可验证的权威引用（datasheet、arXiv、官方文档）',
    promptDirective: `CITATION DIRECTIVE (GEO §2.2.2):
Embed verifiable authority citations throughout the content.
For semiconductor B2B content, cite in this priority order:
  1. Official datasheet / product brief (e.g., "per STM32C5 datasheet DS14153")
  2. Application note number (e.g., "AN5512 §3.2")
  3. Certification body reference (e.g., "PSA Certified Level 3 — cert #CC-23-001")
  4. GitHub repository (e.g., "github.com/STMicroelectronics/STM32CubeC5")
  5. arXiv / academic paper if benchmarking data
Format inline as: [Source: <reference>] immediately after the claim it supports.
Do NOT fabricate citation identifiers — use only sources present in grounding materials.`,
    recommendedFor: ['semiconductor', 'B2B', 'technical'],
    liftEstimate: '+40%',
    combinesWellWith: ['STATISTICS_ADDITION', 'QUOTATION_ADDITION'],
  },
  {
    id: 'QUOTATION_ADDITION',
    label: '💬 Quotation Addition',
    description: '引用权威来源的原话或官方声明',
    promptDirective: `QUOTATION DIRECTIVE (GEO §2.2.2):
Add direct quotations from authoritative voices to increase credibility signals.
Acceptable quotation sources for semiconductor content:
  - Product manager statements from official press releases
  - Certification body evaluator quotes
  - Standards body (Bluetooth SIG, Wi-Fi Alliance, PSA) official language
  - Direct spec language from datasheets (exact wording, not paraphrase)
Format: Use blockquote or inline quote with attribution.
Do NOT fabricate quotes. If no real quote is available from source material, skip this directive for that section.`,
    recommendedFor: ['semiconductor', 'B2B'],
    liftEstimate: '+35%',
    combinesWellWith: ['CITE_SOURCES'],
  },
  {
    id: 'AUTHORITATIVE',
    label: '🛡️ Authoritative Tone',
    description: '将语气改写为明确、权威、无歧义',
    promptDirective: `AUTHORITATIVE TONE DIRECTIVE (GEO §2.2.2):
Rewrite hedged or passive language into direct, authoritative assertions.
Transformations:
  BAD:  "This chip might be suitable for IoT applications"
  GOOD: "This chip is certified for IoT deployments requiring PSA Level 3 security"
  BAD:  "Users may want to consider the power consumption"
  GOOD: "At 2.1μA in Stop mode, the device meets EN 303 645 power budgets without external regulators"
Remove: "might", "could", "may", "some argue", "it is believed"
Replace with: definitive statements backed by spec data from grounding materials.`,
    recommendedFor: ['semiconductor', 'B2B', 'technical'],
    liftEstimate: '+28%',
    combinesWellWith: ['STATISTICS_ADDITION', 'TECHNICAL_TERMS'],
  },
  {
    id: 'UNIQUE_WORDS',
    label: '✨ Unique Words',
    description: '增加词汇多样性，减少重复词，提升语义覆盖广度',
    promptDirective: `UNIQUE WORDS DIRECTIVE (GEO §2.2.2):
Maximise lexical diversity to broaden the query surface this content matches.
- Avoid repeating the same noun phrase more than twice per paragraph; use domain synonyms
- Use varied technical synonyms: "microcontroller" / "MCU" / "embedded processor" / "SoC"
- Include acronym expansions and contractions in alternate paragraphs
- Introduce adjacent vocabulary the target user persona also searches: if writing about security, include "firmware integrity", "attestation", "chain of trust"
This increases the number of distinct queries the content can rank for without keyword stuffing.`,
    recommendedFor: ['semiconductor', 'technical', 'general'],
    liftEstimate: '+20%',
    combinesWellWith: ['TECHNICAL_TERMS', 'FLUENCY_OPTIMIZATION'],
  },
  {
    id: 'TECHNICAL_TERMS',
    label: '⚙️ Technical Terms',
    description: '增加领域专业术语密度，提升对技术类查询的语义匹配',
    promptDirective: `TECHNICAL TERMS DIRECTIVE (GEO §2.2.2):
Increase semantic density with precise technical terminology.
For semiconductor B2B, prioritize terms that appear in real engineer queries:
  Architecture: Cortex-M0+, M33, M55, RISC-V, TrustZone, TEE
  Connectivity: BLE 5.4, Matter 1.3, Thread, Zigbee 3.0, Sub-GHz
  Security: PSA Certified, CC EAL5+, SESIP3, Root of Trust, secure boot
  Power: Stop mode, Standby, VDD range, LDO, DCDC
  Manufacturing: AEC-Q100, automotive grade, JEDEC, MSL rating
Use the precise standard designation (e.g., "BLE 5.4" not "Bluetooth Low Energy") as AI engines
pattern-match against exact nomenclature used in datasheet queries.`,
    recommendedFor: ['semiconductor', 'technical'],
    liftEstimate: '+18%',
    combinesWellWith: ['STATISTICS_ADDITION', 'AUTHORITATIVE'],
  },
  {
    id: 'FLUENCY_OPTIMIZATION',
    label: '🌊 Fluency Optimization',
    description: '提升语言流畅性与可读性（适合生态系统/应用内容）',
    promptDirective: `FLUENCY DIRECTIVE (GEO §2.2.2):
Improve sentence-level fluency without changing technical content.
- Break sentences longer than 25 words into two
- Remove redundant subordinate clauses
- Ensure each paragraph has a clear topic sentence
- Use active voice for process descriptions
- Preserve all technical terms and numeric values exactly`,
    recommendedFor: ['ecosystem', 'application', 'general'],
    liftEstimate: '+15%',
    combinesWellWith: ['EASY_TO_UNDERSTAND'],
  },
  {
    id: 'EASY_TO_UNDERSTAND',
    label: '📖 Easy to Understand',
    description: '简化语言，适合跨角色受众（采购、管理层）',
    promptDirective: `SIMPLIFICATION DIRECTIVE (GEO §2.2.2):
Simplify language for non-specialist readers (procurement, management) without losing precision.
- Add a one-sentence plain-language summary before every technical paragraph
- Replace acronyms with full form on first use: "PSA (Platform Security Architecture)"
- Add analogy for abstract specs: "2.1μA Stop mode — comparable to a wristwatch battery lasting 10 years"
Do NOT simplify numeric values or specification designations themselves.`,
    recommendedFor: ['general', 'executive', 'procurement'],
    liftEstimate: '+10%',
    combinesWellWith: ['FLUENCY_OPTIMIZATION', 'QUOTATION_ADDITION'],
  },
];

// Paper finding: combining more than 3 methods shows diminishing returns
// Recommended combos for semiconductor B2B (from domain-specific analysis §5.1):
export const RECOMMENDED_COMBOS: Record<string, { label: string; ids: GeoMethodId[] }> = {
  semiconductor_technical: {
    label: '半导体技术文档',
    ids: ['STATISTICS_ADDITION', 'CITE_SOURCES', 'AUTHORITATIVE'],
  },
  semiconductor_ecosystem: {
    label: '半导体生态内容',
    ids: ['STATISTICS_ADDITION', 'CITE_SOURCES', 'TECHNICAL_TERMS'],
  },
  procurement_facing: {
    label: '采购决策内容',
    ids: ['STATISTICS_ADDITION', 'AUTHORITATIVE', 'EASY_TO_UNDERSTAND'],
  },
  certification_focused: {
    label: '认证/合规内容',
    ids: ['CITE_SOURCES', 'QUOTATION_ADDITION', 'AUTHORITATIVE'],
  },
};

// Build the combined prompt directive for selected methods
export function buildMethodDirectives(selectedIds: GeoMethodId[]): string {
  if (!selectedIds || selectedIds.length === 0) return '';

  // Cap at 3 per paper's diminishing returns finding
  const capped = selectedIds.slice(0, 3);
  const methods = capped.map(id => GEO_METHODS.find(m => m.id === id)!).filter(Boolean);

  return `## ⚙️ ACTIVE GEO OPTIMIZATION METHODS (GEO KDD2024 §2.2.2)
The following ${methods.length} method(s) are active. Apply ALL directives simultaneously.
Combined visibility lift estimate: ${estimateCombinedLift(capped)}

${methods.map((m, i) => `### Method ${i + 1}: ${m.label} (est. ${m.liftEstimate} lift)
${m.promptDirective}`).join('\n\n')}`;
}

function estimateCombinedLift(ids: GeoMethodId[]): string {
  // Paper shows subadditive combination effects — approximate with sqrt
  const lifts = ids.map(id => {
    const m = GEO_METHODS.find(g => g.id === id);
    return parseInt(m?.liftEstimate || '10');
  });
  const combined = lifts.reduce((acc, l) => acc + Math.sqrt(l * 10), 0);
  return `~${Math.round(combined)}%`;
}
