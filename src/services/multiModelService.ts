/**
 * Multi-Model Verification Service
 *
 * Calls DeepSeek, Alibaba Qwen (百炼) and Doubao (豆包/火山引擎) APIs in
 * parallel using their OpenAI-compatible endpoints.
 *
 * Purpose: provide REAL cross-model cognitive snapshots to validate (or
 * refute) the Gemini-simulated "cross-model consensus" in marketPulse.
 */

export type ModelId = 'deepseek' | 'qwen' | 'doubao' | 'kimi';

export interface ModelSnapshot {
  modelId: ModelId;
  modelName: string;         // human-readable display name
  rawResponse: string;       // full text from the model
  keyEntities: string[];     // extracted brand / product mentions
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  latencyMs: number;
  error?: string;            // set if the call failed
}

export interface MultiModelVerificationResult {
  snapshots: ModelSnapshot[];
  consensusLevel: 'full' | 'partial' | 'divergent' | 'insufficient';
  consensusSummary: string;  // short human-readable diff/agreement summary
  verifiedAt: string;        // ISO timestamp
}

// ─── OpenAI-compatible fetch helper ──────────────────────────────────────────

interface OAIMessage { role: 'user' | 'system'; content: string; }

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: OAIMessage[],
  maxTokens = 512
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

// ─── Entity extraction (lightweight, no extra API call) ────────────────────

function extractKeyEntities(text: string): string[] {
  // Pull out capitalised proper nouns, model numbers, and quoted terms
  const patterns = [
    /["「『]([^"」』]{2,40})["」』]/g,           // quoted/bracketed terms
    /\b([A-Z][A-Za-z0-9]{2,}(?:[-_][A-Za-z0-9]+)*)\b/g, // CamelCase / model numbers
    /\b([\u4e00-\u9fa5]{2,8}(?:公司|科技|芯片|模型|大模型))\b/g, // Chinese org names
  ];
  const found = new Set<string>();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const e = m[1].trim();
      if (e.length >= 2 && e.length <= 40) found.add(e);
    }
  }
  return [...found].slice(0, 12);
}

function inferSentiment(text: string): ModelSnapshot['sentiment'] {
  const pos = (text.match(/推荐|优秀|领先|首选|最佳|recommend|excellent|leading|prefer|best/gi) || []).length;
  const neg = (text.match(/不推荐|落后|较差|avoid|inferior|outdated|not recommend/gi) || []).length;
  if (pos > 0 && neg > 0) return 'mixed';
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// ─── Per-model callers ────────────────────────────────────────────────────

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const QWEN_BASE     = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DOUBAO_BASE   = 'https://ark.cn-beijing.volces.com/api/v3';
const KIMI_BASE     = 'https://api.moonshot.cn/v1';

async function queryDeepSeek(prompt: string, apiKey: string): Promise<ModelSnapshot> {
  const t0 = Date.now();
  try {
    const raw = await callOpenAICompatible(
      DEEPSEEK_BASE, apiKey, 'deepseek-chat',
      [{ role: 'user', content: prompt }]
    );
    return {
      modelId: 'deepseek',
      modelName: 'DeepSeek Chat',
      rawResponse: raw,
      keyEntities: extractKeyEntities(raw),
      sentiment: inferSentiment(raw),
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      modelId: 'deepseek',
      modelName: 'DeepSeek Chat',
      rawResponse: '',
      keyEntities: [],
      sentiment: 'neutral',
      latencyMs: Date.now() - t0,
      error: err?.message || 'Unknown error',
    };
  }
}

async function queryQwen(prompt: string, apiKey: string): Promise<ModelSnapshot> {
  const t0 = Date.now();
  try {
    const raw = await callOpenAICompatible(
      QWEN_BASE, apiKey, 'qwen-plus',
      [{ role: 'user', content: prompt }]
    );
    return {
      modelId: 'qwen',
      modelName: '通义千问 Qwen-Plus',
      rawResponse: raw,
      keyEntities: extractKeyEntities(raw),
      sentiment: inferSentiment(raw),
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      modelId: 'qwen',
      modelName: '通义千问 Qwen-Plus',
      rawResponse: '',
      keyEntities: [],
      sentiment: 'neutral',
      latencyMs: Date.now() - t0,
      error: err?.message || 'Unknown error',
    };
  }
}

async function queryDoubao(prompt: string, apiKey: string): Promise<ModelSnapshot> {
  const t0 = Date.now();
  // 火山引擎豆包使用 endpoint ID 作为 model 名（格式 ep-xxxxxxxx-xxxxx）
  // 若 apiKey 包含 "|" 则视为 "apiKey|endpointId" 的组合，否则使用默认模型名
  const [key, endpointId = 'doubao-pro-32k'] = apiKey.split('|');
  try {
    const raw = await callOpenAICompatible(
      DOUBAO_BASE, key, endpointId,
      [{ role: 'user', content: prompt }]
    );
    return {
      modelId: 'doubao',
      modelName: '豆包 Doubao',
      rawResponse: raw,
      keyEntities: extractKeyEntities(raw),
      sentiment: inferSentiment(raw),
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      modelId: 'doubao',
      modelName: '豆包 Doubao',
      rawResponse: '',
      keyEntities: [],
      sentiment: 'neutral',
      latencyMs: Date.now() - t0,
      error: err?.message || 'Unknown error',
    };
  }
}

async function queryKimi(prompt: string, apiKey: string): Promise<ModelSnapshot> {
  const t0 = Date.now();
  try {
    const raw = await callOpenAICompatible(
      KIMI_BASE, apiKey, 'moonshot-v1-8k',
      [{ role: 'user', content: prompt }]
    );
    return {
      modelId: 'kimi',
      modelName: 'Kimi (Moonshot)',
      rawResponse: raw,
      keyEntities: extractKeyEntities(raw),
      sentiment: inferSentiment(raw),
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      modelId: 'kimi',
      modelName: 'Kimi (Moonshot)',
      rawResponse: '',
      keyEntities: [],
      sentiment: 'neutral',
      latencyMs: Date.now() - t0,
      error: err?.message || 'Unknown error',
    };
  }
}

// ─── Consensus analysis ───────────────────────────────────────────────────

function analyseConsensus(snapshots: ModelSnapshot[]): {
  level: MultiModelVerificationResult['consensusLevel'];
  summary: string;
} {
  const successful = snapshots.filter(s => !s.error);
  if (successful.length < 2) {
    return {
      level: 'insufficient',
      summary: `Only ${successful.length} model(s) responded successfully — cannot determine consensus.`,
    };
  }

  // Compare entity overlap
  const entitySets = successful.map(s => new Set(s.keyEntities));
  const allEntities = [...new Set(successful.flatMap(s => s.keyEntities))];
  const sharedEntities = allEntities.filter(e => entitySets.every(set => set.has(e)));

  const overlapRatio = allEntities.length > 0 ? sharedEntities.length / allEntities.length : 0;
  const sentiments = successful.map(s => s.sentiment);
  const sentimentAgreed = sentiments.every(s => s === sentiments[0]);

  let level: MultiModelVerificationResult['consensusLevel'];
  let summary: string;

  if (overlapRatio >= 0.5 && sentimentAgreed) {
    level = 'full';
    summary = `All models agree — shared entities: ${sharedEntities.slice(0, 5).join(', ') || 'none detected'}. Sentiment: ${sentiments[0]}.`;
  } else if (overlapRatio >= 0.25 || sentimentAgreed) {
    level = 'partial';
    const diffs = successful.map(s => {
      const unique = s.keyEntities.filter(e => !sharedEntities.includes(e));
      return `${s.modelName}: ${unique.slice(0, 3).join(', ') || '–'}`;
    });
    summary = `Partial consensus. Shared: [${sharedEntities.slice(0, 4).join(', ')}]. Diverging: ${diffs.join(' | ')}.`;
  } else {
    level = 'divergent';
    const perModel = successful.map(s => `${s.modelName} → ${s.keyEntities.slice(0, 3).join(', ')}`);
    summary = `Models diverge significantly. ${perModel.join(' | ')}.`;
  }

  return { level, summary };
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Runs the same probe query against DeepSeek and Qwen in parallel,
 * then analyses consensus between the real responses.
 *
 * @param seedText   The product/technology keywords from Step 1
 * @param uiLang     Output language for the probe prompt
 */
export async function runMultiModelVerification(
  seedText: string,
  uiLang: string
): Promise<MultiModelVerificationResult> {
  const deepseekKey = (window as any).env?.VITE_DEEPSEEK_API_KEY || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  const qwenKey     = (window as any).env?.VITE_QWEN_API_KEY     || import.meta.env.VITE_QWEN_API_KEY     || '';
  // 豆包：支持 "apiKey|endpointId" 格式，也可单独填 API Key（使用默认模型）
  const doubaoKey   = (window as any).env?.VITE_DOUBAO_API_KEY   || import.meta.env.VITE_DOUBAO_API_KEY   || '';
  const kimiKey     = (window as any).env?.VITE_Kimi_API_KEY     || import.meta.env.VITE_Kimi_API_KEY     || '';

  const langHint = uiLang === 'zh' ? '请用中文回答。' : uiLang === 'jp' ? '日本語で答えてください。' : 'Please answer in English.';

  const probe = `${langHint}
You are an AI assistant with knowledge of the technology market.
Based on your training data, answer these questions about the following product/technology area:
"${seedText.slice(0, 300)}"

1. Which brands or specific products do you most commonly recommend or associate with this area?
2. What is your general perception of this technology space?
3. Are there any well-known competitors or alternatives you typically mention?

Be direct and concise (max 200 words). Mention specific product names, model numbers, or brand names where possible.`;

  const unconfigured = (id: ModelId, name: string): ModelSnapshot => ({
    modelId: id, modelName: name, rawResponse: '',
    keyEntities: [], sentiment: 'neutral', latencyMs: 0,
    error: 'API key not configured',
  });

  const isConfigured = (key: string) => key && !key.includes('your_');

  const [deepseekSnapshot, qwenSnapshot, doubaoSnapshot, kimiSnapshot] = await Promise.all([
    isConfigured(deepseekKey)
      ? queryDeepSeek(probe, deepseekKey)
      : Promise.resolve(unconfigured('deepseek', 'DeepSeek Chat')),
    isConfigured(qwenKey)
      ? queryQwen(probe, qwenKey)
      : Promise.resolve(unconfigured('qwen', '通义千问 Qwen-Plus')),
    isConfigured(doubaoKey)
      ? queryDoubao(probe, doubaoKey)
      : Promise.resolve(unconfigured('doubao', '豆包 Doubao')),
    isConfigured(kimiKey)
      ? queryKimi(probe, kimiKey)
      : Promise.resolve(unconfigured('kimi', 'Kimi (Moonshot)')),
  ]);

  const snapshots = [deepseekSnapshot, qwenSnapshot, doubaoSnapshot, kimiSnapshot];
  const { level, summary } = analyseConsensus(snapshots);

  return {
    snapshots,
    consensusLevel: level,
    consensusSummary: summary,
    verifiedAt: new Date().toISOString(),
  };
}
