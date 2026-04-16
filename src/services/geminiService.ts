import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, MonitoringQuestion, MarketStrategy, PlaybookAnchorBundle, ModelVerificationResult, ModelClaimVerification, ScoredEvidenceSource, EvidenceAuthority, EvidenceRecency, AnchorVerificationResult } from "../types";
import { buildContentPrompt } from "./promptBuilder";
import { buildMethodDirectives } from "./geoMethods";
import type { GeoMethodId } from "./geoMethods";
import { GEMINI_MODELS } from "../config/models";

// Initialize with Runtime env (from server.js) or Vite env (built-in)
const apiKey = (window as any).env?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey });

// ─── Universal Retry Utility ──────────────────────────────────────────────────
// Parses the retryDelay from a 429 Gemini API error (supports nested JSON)
export const parseRetrySeconds = (err: any): number | null => {
  try {
    const raw = typeof err?.message === 'string' ? JSON.parse(err.message) : err;
    // Check details[].retryDelay
    const details = raw?.error?.details || [];
    for (const d of details) {
      if (d?.retryDelay) {
        const match = String(d.retryDelay).match(/([\d.]+)/);
        if (match) return Math.ceil(parseFloat(match[1]));
      }
    }
    // Fallback: parse "retry in Xs" from message string
    const inner = raw?.error?.message || raw?.message || '';
    const match = inner.match(/retry in ([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]));
  } catch { /* intentional: parse failure is non-fatal */ }
  return null;
};

const is429 = (err: any): boolean => {
  try {
    const raw = typeof err?.message === 'string' ? JSON.parse(err.message) : err;
    return raw?.error?.code === 429 || raw?.error?.status === 'RESOURCE_EXHAUSTED';
  } catch { return false; }
};

// Wraps any async API call with automatic 429 retry + countdown callback
export const withRetry = async <T>(
  fn: () => Promise<T>,
  onCountdown?: (secondsLeft: number) => void,
  maxRetries = 3
): Promise<T> => {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (is429(err) && attempt < maxRetries) {
        const seconds = parseRetrySeconds(err) || 60;
        // Countdown tick every second
        for (let s = seconds; s > 0; s--) {
          onCountdown?.(s);
          await new Promise(r => setTimeout(r, 1000));
        }
        onCountdown?.(0);
        // Continue to next attempt
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
};
// ─────────────────────────────────────────────────────────────────────────────


const getSystemInstruction = (lang: string, customRegion?: string, targetEcosystem?: string) => {
  const now = new Date();
  const currentDateTime = now.toLocaleString();
  const nineMonthsAgo = new Date(now.setMonth(now.getMonth() - 9)).toLocaleDateString();
  
  const commonRole = `
Role: Senior Hard Tech GEO (Generative Engine Optimization) Strategic Analyst.
Current System Date: ${currentDateTime} (Reference for Recency)
Task: Analyze user content, map implicit intent, and create a "Cognitive Sovereignty" strategy for Generative AI.
Constraint: **STRICTLY FORBIDDEN**: Do NOT use the word "SEO". Use "GEO" or "AEO" exclusively.
Method: Deep Chain of Thought (CoT).
`;

  let ecosystemContext = "";
  if (targetEcosystem) {
    let models = "Global models (ChatGPT, Claude, Gemini, Perplexity)";
    if (targetEcosystem === "cn") models = "Chinese models (Doubao/豆包, Kimi, DeepSeek, Qwen/通义千问, ERNIE/文心一言, Yuanbao/腾讯元宝)";
    else if (targetEcosystem === "jp") models = "Japanese ecosystem (Yahoo/Line AI, local tailored models, plus global ones)";
    else if (targetEcosystem === "kr") models = "Korean ecosystem (Naver CUE:, local tailored models)";

    ecosystemContext = `
**AI ECOSYSTEM FOCUS**: The user has selected the "${targetEcosystem}" ecosystem. 
You MUST analyze the cognitive gaps, AI perception, and competitor threats specifically from the perspective of the dominant AI models in this ecosystem: ${models}.
Tailor all your generated content, snippets, and strategies to rank high and be easily absorbed by these specific models.
`;
  }

  let regionContext = "";
  if (customRegion && customRegion.trim() !== "") {
    regionContext = `
**CRITICAL CONTEXT OVERRIDE**: The user has explicitly defined the Target Region as: "${customRegion}".
You MUST pivot the entire analysis to fit this specific local market. Focus on "Offensive Market Adaptation" rather than just "Defensive Compliance".
`;
  }

  const commonSteps = `
${ecosystemContext}
${regionContext}
Step 1: Executive Summary (The 4-Dimensional Matrix)
Must return:
1. marketPulse: First line MUST explicitly state: "Simulated Models: [List of Models] (Analysis Date: ${currentDateTime})". 
   - REQUENCY REQUIREMENT: You MUST prioritize information and perception from the last 9 months (since ${nineMonthsAgo}). If the AI ecosystem's view has shifted recently, highlight that shift.
   - For CN: 百度文心一言 (Ernie), DeepSeek, Kimi, 豆包 (Doubao), 元宝 (Yuanbao), 千问 (Qwen).
   - For JP: Yahoo/Line, Claude 3, GPT-4o.
   - For KR: Naver CUE:, GPT-4o.
   Describe the current AI perception accurately. Report "Cross-Model Consensus (多模型交叉共识)" if all models agree. However, if individual models show unique results or preferences for specific product features/competitors, you MUST explicitly detail these differences (e.g., DeepSeek prefers X, Kimi highlights Y).
2. coreRoadblocks: Why are we currently not cited by AI? Is the competitor winning via GitHub repos, whitepapers, or forums?
3. strategicPivot: The explicit shift from SEO to GEO.
4. keyInsight: One highly counter-intuitive but commercially valuable GEO discovery.

CRITICAL LANGUAGE OVERRIDE: YOUR ENTIRE JSON RESPONSE MUST BE RETURNED EXACTLY AND FLUENTLY IN: [${lang}]. NO EXCEPTIONS. Do NOT mix English into the JSON values if [${lang}] is not English.

Step 2: Competitor & Corpus Threat Detection
Identify 3-5 top technical competitors in this exact ecosystem/region.
For each:
- aiPerception: How AI currently describes them.
- corpusAdvantage: Why does AI favor them? (e.g., "They dominate CSDN tutorials" or "High density of StackOverflow accepted answers").
- threatLevel: Low/Medium/High/Critical.
- strategicOpening: The exact cognitive gap we must exploit to unseat them.

Step 3: GEO Interception Matrix Engineering
You MUST extract 4-6 specific "Strategic Pillars" (Intent Clusters) based on 6 Mandatory Interrogation Dimensions:
1. Cost vs Performance Elimination
2. Cognitive Bias Arbitrage
3. Legacy Migration Friction
4. Extreme Environment Compromise
5. Compute Democratization
6. Ecosystem Hidden Tax

For each Pillar, generate 4-6 specific "Monitoring Questions".
A Monitoring Question is the exact complex prompt an engineer types into an LLM (e.g., "Can I swap M0+ for M33 without increasing BOM cost?").
For EACH Monitoring Question, you MUST provide an "Expected Semantic Anchor" (e.g., "$0.64 entry price cited"). Generating generic 'pain points' is STRICTLY FORBIDDEN.

=== FEW-SHOT MENTAL MODEL FOR STEP 3 ===
Pillar: "Intent 1: BOM-Neutral M0+ to M33 Migration"
Core Proposition: "At $0.64 entry price, the M33 is expensive anchor no longer holds."
Monitoring Question 1: "What performance gains do I actually get by migrating from Cortex-M0+ to M33?"
Expected AI Anchor 1: "STM32C5 named; CoreMark figure cited"
Monitoring Question 2: "Can I swap M0+ for M33 without increasing my BOM cost?"
Expected AI Anchor 2: "STM32C5 or $0.64 entry price cited"
=== END FEW-SHOT ===

Step 3b: GEO Failure Diagnosis (FOR EACH INTENT CLUSTER — mandatory)
After defining each Intent Cluster's monitoringQuestions, you MUST also output a failureDiagnosis object.
Diagnose WHY the product currently fails to get cited by AI for this cluster's queries.

Choose EXACTLY ONE primaryFailure from this taxonomy:

CORPUS_ABSENCE      → AI draws a blank or hallucinates; this product/feature simply has no training signal.
                      (Maps to: DATA_INTEGRITY + LOW_INFO_DENSITY in AgentGEO taxonomy)
ATTRIBUTE_MISMATCH  → AI knows the product name but cites wrong spec/price/positioning (e.g. old datasheet values).
BURIED_ANSWER       → The correct data exists in PDFs or datasheets but is not in crawlable/structured form.
COMPETITOR_DOMINANCE→ Competing products have 10× higher corpus density on this exact query type.
SEMANTIC_IRRELEVANCE→ Content uses "wireless MCU" but users ask "BLE SoC" — keyword semantic gap.
OUTDATED_CONTENT    → AI retrieves 2+ year old pricing, EOL status, or superseded product positioning.
TRUST_CREDIBILITY   → No GitHub stars, arXiv citations, official documentation, or community validation.
STRUCTURAL_WEAKNESS → Content exists and is accurate but is buried in verbose paragraphs; no BLUF/snippet structure.
UNKNOWN             → Cannot determine root cause from available signals.

Also output:
- severity: critical (AI actively misleads) / high (AI ignores) / medium (AI underranks) / low (marginal gap)
- explanation: ONE concrete sentence specific to this cluster — name the exact symptom observed
- repairUrgency: integer 1–10 where 10 = fix this immediately before any content production

Step 4: Tactical Matrix (The Playbooks)
- Tactics: [🛡️ Authority], [⚡ Scenario], [⚔️ Competitor].
`;

  switch (lang) {
    case 'en':
      return `${commonRole} Target: Global. Lang: English. ${commonSteps}`;
    case 'jp':
      return `${commonRole} Target: Japan. Lang: Japanese. ${commonSteps}`;
    case 'kr':
      return `${commonRole} Target: Korea. Lang: Korean. ${commonSteps}`;
    case 'zh':
    default:
      return `${commonRole} Target: China. Lang: Chinese. ${commonSteps}`;
  }
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    strategyReport: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { 
          type: Type.OBJECT,
          properties: {
            marketPulse: { type: Type.STRING },
            coreRoadblocks: { type: Type.STRING },
            strategicPivot: { type: Type.STRING },
            keyInsight: { type: Type.STRING }
          },
          required: ["marketPulse", "coreRoadblocks", "strategicPivot", "keyInsight"]
        },
        actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["executiveSummary", "actionPlan"]
    },
    intentClusters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          intentName: { type: Type.STRING },
          coreProposition: { type: Type.STRING },
          monitoringQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                userPrompt: { type: Type.STRING },
                expectedAnchor: { type: Type.STRING }
              },
              required: ["id", "userPrompt", "expectedAnchor"]
            }
          },
          failureDiagnosis: {
            type: Type.OBJECT,
            properties: {
              primaryFailure: { type: Type.STRING },
              severity: { type: Type.STRING },
              explanation: { type: Type.STRING },
              repairUrgency: { type: Type.NUMBER }
            },
            required: ["primaryFailure", "severity", "explanation", "repairUrgency"]
          }
        },
        required: ["intentName", "coreProposition", "monitoringQuestions", "failureDiagnosis"]
      }
    },
    competitorAnalysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          competitorName: { type: Type.STRING },
          aiPerception: { type: Type.STRING },
          corpusAdvantage: { type: Type.STRING },
          threatLevel: { type: Type.STRING },
          strategicOpening: { type: Type.STRING }
        },
        required: ["competitorName", "aiPerception", "corpusAdvantage", "threatLevel", "strategicOpening"]
      }
    },
    marketStrategy: {
      type: Type.OBJECT,
      properties: {
        comprehensiveInsight: {
          type: Type.OBJECT,
          properties: {
            aiPerception: { type: Type.STRING },
            marketGapAnalysis: { type: Type.STRING }
          },
          required: ["aiPerception", "marketGapAnalysis"]
        },
        implicitIntentStrategy: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              anchorIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              sourceLogic: { type: Type.STRING },
              tacticsType: { type: Type.STRING },
              contentPlatform: { type: Type.STRING },
              structuredDataStrategy: { type: Type.STRING },
              geoAction: { type: Type.STRING },
              targetSnippet: { type: Type.STRING }
            },
            required: ["anchorIds", "sourceLogic", "tacticsType", "contentPlatform", "structuredDataStrategy", "geoAction", "targetSnippet"]
          }
        },
        competitorStrategy: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              anchorIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              sourceLogic: { type: Type.STRING },
              tacticsType: { type: Type.STRING },
              contentPlatform: { type: Type.STRING },
              structuredDataStrategy: { type: Type.STRING },
              geoAction: { type: Type.STRING },
              targetSnippet: { type: Type.STRING }
            },
            required: ["anchorIds", "sourceLogic", "tacticsType", "contentPlatform", "structuredDataStrategy", "geoAction", "targetSnippet"]
          }
        },
        roleSpecificSops: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              roleName: { type: Type.STRING },
              coreFocus: { type: Type.STRING },
              sopTitle: { type: Type.STRING },
              actionableGuide: { type: Type.STRING },
              badExample: { type: Type.STRING },
              goodExample: { type: Type.STRING },
              checklist: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["roleName", "coreFocus", "sopTitle", "actionableGuide", "badExample", "goodExample", "checklist"]
          }
        }
      },
      required: ["comprehensiveInsight", "implicitIntentStrategy", "competitorStrategy", "roleSpecificSops"]
    }
  },
  required: ["strategyReport", "competitorAnalysis", "intentClusters", "marketStrategy"]
};

export const analyzeContent = async (textInput: string, images: any[] = [], targetLang: string = 'en', customRegion: string = '', targetEcosystem: string = 'global'): Promise<AnalysisResult> => {
  const systemInstruction = getSystemInstruction(targetLang, customRegion, targetEcosystem);
  
  let groundingContext = '';
  let groundingUrls: any[] = [];

  const now = new Date();
  const nineMonthsAgo = new Date(now.setMonth(now.getMonth() - 9)).toLocaleDateString();

  try {
    const gResult = await genAI.models.generateContent({
      model: GEMINI_MODELS.grounding,
      contents: [{ role: 'user', parts: [{ text: `CRITICAL IMPERATIVE: The current date is ${new Date().toLocaleDateString()}. Perform a real-time Google Search grounding for: "${textInput}". You MUST actively search and return the absolute latest technical discussions, market gaps, and competitor news SPECIFICALLY from the last 9 months (since ${nineMonthsAgo}). STRIP OUT all outdated data from before ${nineMonthsAgo}. Provide a dense summary of the ACTUAL current landscape as of today.` }] }],
      config: {
        tools: [{ googleSearch: {} } as any]
      }
    });
    groundingContext = gResult.text || '';
    if ((gResult as any).groundingMetadata?.groundingChunks) {
       groundingUrls = (gResult as any).groundingMetadata.groundingChunks
        .map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
    }
  } catch (err) { console.warn(err); }

  const finalPrompt = groundingContext ? `${textInput}\n\nRESEARCH:\n${groundingContext}` : textInput;
  const parts: any[] = [{ text: finalPrompt }];
  images.forEach(img => parts.push({ 
    inlineData: { data: img.data, mimeType: img.mimeType } 
  }));

  const resultBy = await genAI.models.generateContent({
    model: GEMINI_MODELS.analysis,
    contents: [{ role: 'user', parts: parts }],
    config: {
      systemInstruction: systemInstruction + `\n\nCRITICAL LANGUAGE STRICTNESS: Regardless of the target ecosystem or region, the Final JSON Output MUST be written entirely in the following language code: [${targetLang}]. Do not output mixed languages. Ensure your "marketPulse", "coreRoadblocks", "strategicPivot" and "keyInsight" are fluently translated to [${targetLang}].`,
      responseMimeType: "application/json",
      responseSchema: responseSchema as any,
    }
  });

  const resText = resultBy.text || '';
  const rawJson = resText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1').trim();
  const parsed = JSON.parse(rawJson) as AnalysisResult;
  if (groundingUrls.length > 0) parsed.groundingUrls = groundingUrls;
  return parsed;
};

export const generateContentStream = async (
  platform: string,
  format: string,
  bundles: PlaybookAnchorBundle[],
  orphanAnchors: MonitoringQuestion[],
  customPrompt: string,
  sourceContext: string,
  uiLang: string,
  focusedMode: boolean = false,
  selectedMethods: import('./geoMethods').GeoMethodId[] = []
) => {
  const prompt = buildContentPrompt({
    platform, format, bundles, orphanAnchors, customPrompt, sourceContext, uiLang, focusedMode, selectedMethods,
  });

  const response = await genAI.models.generateContentStream({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  
  async function* stream() {
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }
  return stream();
};

export const chatWithAssistant = async (message: string, history: any[], contextData: any, uiLang: string) => {
  const response = await genAI.models.generateContent({
    model: GEMINI_MODELS.chat,
    contents: [
      ...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction: `Expert GEO Assistant. UI Lang: ${uiLang}. Context: ${JSON.stringify(contextData)}`
    }
  });
  return response.text;
};

export const generateJsonLdSchema = async (content: string, uiLang: string, platform: string) => {
  const res = await genAI.models.generateContent({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: `You are a Schema.org expert. Based on the following content, generate a VALID JSON-LD structured data block (application/ld+json). The schema should include @context, @type (Article, TechArticle, or HowTo as appropriate), headline, description, author, datePublished, and any relevant properties. Platform: ${platform}. Language: ${uiLang}.

Content to schema-ify:
${content.slice(0, 4000)}

RESPOND WITH ONLY THE JSON OBJECT. Do NOT wrap in markdown code fences. Do NOT add explanatory text.` }] }],
    config: {
      responseMimeType: "application/json"
    }
  });
  let text = res.text || '';
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
};

export const humanizeContent = async (content: string, uiLang: string = 'en') => {
  const isZh = uiLang === 'zh' || uiLang.startsWith('zh');
  
  const zhHumanizerPrompt = `你是一位顶尖的中文深度资深编辑，专门识别并剔除文本中的“AI 味”。
你的目标是让以下文本听起来更自然、更像真实的人类专家书写，同时保留所有核心技术点和数据。

### 🚨 必须剔除的“AI 痕迹”：
1. **宏大叙事与虚假意义**：删掉“标志着关键时刻”、“见证了历史”、“体现了核心价值”等空洞表述。
2. **公式化连接词**：大量删减“此外”、“然而”、“总之”、“至关重要”、“不仅...而且”等机械连词。
3. **分词式浅薄总结**：删除“彰显了...”、“确保了...”、“为...奠定了基础”等句末尾缀。
4. **宣传辞令**：剔除“充满活力的”、“开创性的”、“令人叹为观止的”等过度赞美的广告词。
5. **打破死板节奏**：混合长短句，避免每个句子长度都一样。
6. **信任读者**：直接说事实，不要像保姆一样解释“这意味着...”。

### ✅ 创作要求：
- **语调**：专业但有锋芒，允许适度的观点表达，甚至可以带点“人味”的思考（如“我一直在关注这个趋势...”）。
- **结构**：打破 AI 喜欢的三段式列表，合并信息，或者用更随意的段落结构。
- **语言**：严禁中英混杂（除非是必要的专业术语），确保流畅、地道。

待处理文本：
"""
${content.slice(0, 6000)}
"""`;

  const genericHumanizerPrompt = `You are an expert technical editor specialized in "humanizing" AI-generated text based on the WikiProject AI Cleanup standards. 
Your goal is to strip away the robotic, overly-structured, and hyperbolic patterns of LLM output.

### 🚨 ELIMINATE THESE AI PATTERNS:
1. **Fabricated Significance**: Remove phrases like "marks a pivotal moment", "testament to", "underscores the importance of".
2. **Superficial "-ing" Analysis**: Delete ending phrases like ", ensuring that..." or ", highlighting the...".
3. **AI Connectives**: Heavily reduce use of "Additionally", "Moreover", "Furthermore", "In conclusion", "Crucial".
4. **Formulaic "Not only... but also"**: Replace with direct statements.
5. **Robotic Symmetry**: Vary sentence length. AI loves 3-item lists; break them into 2 or 4 items to sound human.
6. **Hedge Phrases**: Remove "It is important to note," or "It appears that." Just state the facts.

### ✅ EXECUTION:
- **Tone**: Professional, direct, and authoritative. 
- **Voice**: Injects a sense of individual agency. Use "I/We found" instead of "It was observed" where appropriate.
- **Rhythm**: Mix punchy short sentences with occasional complex ones.

Content to humanize:
"""
${content.slice(0, 6000)}
"""`;

  const finalPrompt = isZh ? zhHumanizerPrompt : genericHumanizerPrompt;

  const res = await genAI.models.generateContent({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: finalPrompt }] }]
  });
  return res.text;
};

export const translateContent = async (content: string, targetLang: string) => {
  const langNames: Record<string, string> = { zh: 'Chinese (Mandarin)', en: 'English', jp: 'Japanese', kr: 'Korean' };
  const res = await genAI.models.generateContent({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: `You are a professional translator. Translate the following content into ${langNames[targetLang] || targetLang}. Maintain all formatting, markdown structure, technical terminology accuracy, and data integrity. Ensure the translation sounds fluent and native, NOT robotic. DO NOT add any extra commentary or explanation.

Content:
${content.slice(0, 6000)}` }] }]
  });
  return res.text;
};

export const refineStrategy = async (selectedTargets: MonitoringQuestion[], uiLang: string = 'en'): Promise<MarketStrategy> => {
  const prompt = `
ROLE: Elite GEO Tactical Engine.
TASK: Generate a high-precision Narrative Strategy Playbook [Step 2] based on the specific INTERCEPTION TARGETS [Step 1] provided below.

### 🛡️ THE GEO FRAMEWORK CONSTRAINTS:
1. **Targeted Infiltration**: Your playbooks must specifically address how to embed the "Expected Anchors" into a narrative that AI models will prefer.
2. **Cognitive Gaps**: Identify why these specific questions are currently "Knowledge Vacuums" and how our content will fill them.
3. **Semantic Triggers**: Use the platform-specific language that the AI ecosystem (Zhihu/Reddit/etc.) weighs most heavily.
4. **Structured Data Precision**: Suggest the EXACT schema or table format (e.g., "A 3-column performance-to-cost table comparing M0+ and M33") rather than generic advice.

### 🎯 SELECTED INTERCEPTION TARGETS (FROM STEP 1):
${selectedTargets.map((t, i) => `Target ${i+1}:
 - ID: "${t.id}"
 - User Prompt: "${t.userPrompt}"
 - Mandatory Anchor: "${t.expectedAnchor}"`).join('\n')}

### 📝 REQUIRED OUTPUT (JSON FORMAT):
You must return a VALID JSON object matching this structure:
{
  "comprehensiveInsight": {
    "aiPerception": "Summary of current AI bias against these specific targets",
    "marketGapAnalysis": "The exact cognitive arbitrage opportunity for these targets"
  },
  "implicitIntentStrategy": [
     {
       "anchorIds": ["<id of the target(s) this playbook directly addresses, from the list above>"],
       "sourceLogic": "How the core technical logic answers the target prompt",
       "tacticsType": "Scenario/Authority/Counter-Competitor",
       "contentPlatform": "Recommended platform (e.g. Technical Forum/Wiki)",
       "structuredDataStrategy": "Specific layout (Table/Code/List) to ensure AI extraction",
       "geoAction": "One sentence specific GEO action",
       "targetSnippet": "A 100-150 word 'Golden Paragraph' that perfectly captures the target anchor"
     }
  ],
  "competitorStrategy": [
     // Same structure as above (including anchorIds), but focused on displacing specific competitors for these targets
  ],
  "roleSpecificSops": [
     {
       "roleName": "SOP for Developer/Marketer",
       "coreFocus": "What they must prioritize",
       "sopTitle": "Actionable Title",
       "actionableGuide": "Step-by-step specific to these targets",
       "badExample": "Common mistake (e.g., being too promotional)",
       "goodExample": "Expert execution",
       "checklist": ["Task 1", "Task 2"]
     }
  ]
}

CRITICAL: Return ONLY the JSON. No markdown fences. Ensure ALL text is in [${uiLang}].
`;

  const res = await genAI.models.generateContent({
    model: GEMINI_MODELS.analysis,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json"
    }
  });

  const text = res.text || '';
  const rawJson = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1').trim();
  return JSON.parse(rawJson) as MarketStrategy;
};

export const fetchUrlContent = async (url: string) => {
  const res = await fetch(`https://r.jina.ai/${url}`);
  const text = await res.text();
  return { title: url, content: text, wordCount: text.split(/\s+/).length };
};

// ─── Evidence Quality Scoring Helpers ────────────────────────────────────────

const HIGH_AUTHORITY_DOMAINS = [
  'github.com', 'arxiv.org', 'ieee.org', 'acm.org', 'nature.com',
  'st.com', 'nxp.com', 'ti.com', 'arm.com', 'mouser.com', 'digikey.com',
  'developer.android.com', 'docs.microsoft.com', 'developer.apple.com',
  'npmjs.com', 'pypi.org', 'crates.io', 'docs.rs',
];
const MEDIUM_AUTHORITY_DOMAINS = [
  'stackoverflow.com', 'reddit.com', 'hackernews.com', 'medium.com',
  'dev.to', 'csdn.net', 'zhihu.com', 'qiita.com',
];

function scoreAuthority(uris: string[]): EvidenceAuthority {
  for (const uri of uris) {
    try {
      const host = new URL(uri).hostname.replace('www.', '');
      if (HIGH_AUTHORITY_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return 'high';
    } catch { /* invalid URL */ }
  }
  for (const uri of uris) {
    try {
      const host = new URL(uri).hostname.replace('www.', '');
      if (MEDIUM_AUTHORITY_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return 'medium';
    } catch { /* invalid URL */ }
  }
  return uris.length > 0 ? 'medium' : 'low';
}

function scoreRecency(uris: string[]): EvidenceRecency {
  const currentYear = new Date().getFullYear();
  for (const uri of uris) {
    // Look for year patterns in URL path: /2024/, /2025/, ?year=2024, etc.
    const yearMatch = uri.match(/[/=_-](20\d{2})[/=_-]/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      return year >= currentYear - 1 ? 'fresh' : 'stale';
    }
  }
  return 'unknown';
}

function scoreAnchorMatch(content: string, anchor: string): boolean {
  // Check if the key terms from the anchor appear in the returned content
  const anchorTerms = anchor.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const contentLower = content.toLowerCase();
  const matchCount = anchorTerms.filter(term => contentLower.includes(term)).length;
  return anchorTerms.length > 0 && matchCount / anchorTerms.length >= 0.5;
}

function computeScore(authority: EvidenceAuthority, recency: EvidenceRecency, anchorMatch: boolean): number {
  const a = authority === 'high' ? 0.5 : authority === 'medium' ? 0.3 : 0.1;
  const r = recency === 'fresh' ? 0.3 : recency === 'unknown' ? 0.15 : 0.0;
  const m = anchorMatch ? 0.2 : 0.0;
  return Math.round((a + r + m) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deep Evidence Grounding for Step 3.
 * Finds hard evidence for each anchor and scores each source by
 * authority, recency, and anchor-keyword match.
 * Results are sorted by score (highest first) so the prompt builder
 * injects the most credible sources at the top.
 */
export const deepEvidenceGrounding = async (anchors: string[]): Promise<ScoredEvidenceSource[]> => {
  if (!anchors || anchors.length === 0) return [];

  const results = await Promise.all(anchors.map(async (anchor): Promise<ScoredEvidenceSource | null> => {
    try {
      const gResult = await genAI.models.generateContent({
        model: GEMINI_MODELS.grounding,
        contents: [{ role: 'user', parts: [{ text: `DEEP FACT CHECK: Find authoritative technical specifications, official prices, or performance figures for: "${anchor}". Priority: Official Whitepapers, Wiki, or Technical Forums. Summarize the hard data found.` }] }],
        config: { tools: [{ googleSearch: {} } as any] }
      });

      const content = gResult.text || '';
      const urls: { title: string; uri: string }[] = [];
      if ((gResult as any).groundingMetadata?.groundingChunks) {
        (gResult as any).groundingMetadata.groundingChunks
          .map((c: any) => c.web).filter(Boolean)
          .forEach((w: any) => urls.push({ title: w.title || '', uri: w.uri || '' }));
      }

      const uris = urls.map(u => u.uri);
      const authority  = scoreAuthority(uris);
      const recency    = scoreRecency(uris);
      const anchorMatch = scoreAnchorMatch(content, anchor);
      const score      = computeScore(authority, recency, anchorMatch);

      return {
        name: `Deep Evidence: ${anchor.slice(0, 40)}`,
        content,
        type: 'system',
        urls,
        quality: { authority, recency, anchorMatch, score },
      };
    } catch (err) {
      console.warn(`Deep grounding failed for "${anchor}":`, err);
      return null;
    }
  }));

  return (results.filter(Boolean) as ScoredEvidenceSource[])
    .sort((a, b) => b.quality.score - a.quality.score); // best sources first
};

/**
 * Multi-Model Verification Layer.
 *
 * The main analysis uses a single Gemini model to *simulate* how other AI models
 * (DeepSeek, Kimi, 百度, etc.) perceive a product. This function runs a secondary
 * Google Search grounding pass to find real-world evidence for those simulated
 * claims, producing a confidence score and source attribution.
 *
 * Does NOT call third-party model APIs — verifies whether claimed model preferences
 * are reflected in public discourse (forums, tech articles, official docs), which
 * is a realistic proxy for what those models were actually trained on.
 */
/**
 * Anchor Verification — validates that each expectedAnchor actually exists in
 * public sources, using Google Search grounding.
 *
 * Status logic:
 *   verified  → search returned ≥1 URL and anchor keywords found in content
 *   partial   → URLs found but anchor keywords not clearly present in content
 *   unverified → no URLs returned (anchor may be fabricated or too obscure)
 *
 * Results are stored in diagnosisResult.anchorVerifications and shown in
 * StepDiagnosis so the user can demote unverified anchors before proceeding.
 */
export const verifyAnchors = async (
  questions: MonitoringQuestion[]
): Promise<AnchorVerificationResult[]> => {
  if (!questions || questions.length === 0) return [];

  const results = await Promise.all(
    questions.map(async (q): Promise<AnchorVerificationResult> => {
      try {
        const gResult = await genAI.models.generateContent({
          model: GEMINI_MODELS.grounding,
          contents: [{ role: 'user', parts: [{ text: `Search for real-world evidence of this specific technical fact or entity: "${q.expectedAnchor}". Return any authoritative sources (official docs, datasheets, whitepapers, forum posts) that confirm it exists. Be direct — only state what the sources say.` }] }],
          config: { tools: [{ googleSearch: {} } as any] }
        });

        const content = gResult.text || '';
        const urls: string[] = [];
        if ((gResult as any).groundingMetadata?.groundingChunks) {
          (gResult as any).groundingMetadata.groundingChunks
            .map((c: any) => c.web?.uri).filter(Boolean)
            .forEach((uri: string) => urls.push(uri));
        }

        const anchorMatch = scoreAnchorMatch(content, q.expectedAnchor);
        const hasUrls = urls.length > 0;

        const status: AnchorVerificationResult['status'] =
          hasUrls && anchorMatch ? 'verified'
          : hasUrls              ? 'partial'
          :                        'unverified';

        const confidence =
          status === 'verified'   ? 0.85 + Math.min(urls.length * 0.03, 0.15)
          : status === 'partial'  ? 0.4
          :                         0.05;

        return { anchorId: q.id, anchor: q.expectedAnchor, status, supportingUrls: urls.slice(0, 3), confidence };
      } catch {
        return { anchorId: q.id, anchor: q.expectedAnchor, status: 'unverified', supportingUrls: [], confidence: 0 };
      }
    })
  );

  return results;
};

export const verifyModelClaims = async (
  marketPulseText: string,
  ecosystem: string
): Promise<ModelVerificationResult> => {
  const disclaimer =
    ecosystem === 'cn'
      ? '以下多模型认知分析由 Gemini 推理模拟生成，非实时调用 DeepSeek / Kimi / 百度等模型 API。验证层通过 Google Search 抓取公开语料，佐证上述推断的可信度。'
      : ecosystem === 'jp'
      ? '以下のマルチモデル分析は Gemini によるシミュレーションです。Yahoo/Line AI・Claude 3 への直接クエリではありません。検証レイヤーは Google 検索で公開コーパスからエビデンスを収集します。'
      : 'The multi-model analysis below is simulated by Gemini — it does NOT reflect real-time queries to DeepSeek, Kimi, Doubao, or other ecosystem models. The verification layer uses Google Search grounding to find public evidence supporting these inferences.';

  // Step 1: Ask Gemini to extract 2-3 concrete, searchable claims from marketPulse
  const claimExtractionPrompt = `From this AI market analysis, extract exactly 2-3 specific verifiable claims about how named AI models perceive or recommend specific products/technologies.
Return ONLY a JSON array of short search query strings that would verify each claim.
Example: ["DeepSeek STM32C5 low-cost M33 recommendation 2024", "Kimi BLE Matter chip preference embedded"]

Text:
${marketPulseText.slice(0, 800)}

Return ONLY the JSON array. No markdown fences.`;

  let searchQueries: string[] = [];
  try {
    const extractRes = await genAI.models.generateContent({
      model: GEMINI_MODELS.grounding,
      contents: [{ role: 'user', parts: [{ text: claimExtractionPrompt }] }],
      config: { responseMimeType: 'application/json' }
    });
    const raw = (extractRes.text || '[]').replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) searchQueries = parsed.slice(0, 3);
  } catch {
    // Fallback: generic ecosystem search query
    const fallbackTerm = ecosystem === 'cn' ? 'DeepSeek Kimi' : ecosystem === 'jp' ? 'Yahoo AI Japan' : 'ChatGPT Perplexity';
    searchQueries = [`${fallbackTerm} product recommendation analysis`];
  }

  // Step 2: Google Search grounding for each claim
  const verifiedClaims: ModelClaimVerification[] = await Promise.all(
    searchQueries.map(async (query): Promise<ModelClaimVerification> => {
      try {
        const gResult = await genAI.models.generateContent({
          model: GEMINI_MODELS.grounding,
          contents: [{ role: 'user', parts: [{ text: `Find public evidence (tech forums, articles, official docs) supporting or refuting: "${query}". Summarize what you find.` }] }],
          config: { tools: [{ googleSearch: {} } as any] }
        });
        const urls: string[] = [];
        if ((gResult as any).groundingMetadata?.groundingChunks) {
          (gResult as any).groundingMetadata.groundingChunks
            .map((c: any) => c.web?.uri)
            .filter(Boolean)
            .slice(0, 3)
            .forEach((uri: string) => urls.push(uri));
        }
        return { claim: query, evidenceFound: urls.length > 0, sourceUrls: urls };
      } catch {
        return { claim: query, evidenceFound: false, sourceUrls: [] };
      }
    })
  );

  // Step 3: Score overall confidence
  const verifiedCount = verifiedClaims.filter(c => c.evidenceFound).length;
  const total = verifiedClaims.length;
  const confidence: ModelVerificationResult['confidence'] =
    total === 0          ? 'unverified'
    : verifiedCount === total ? 'high'
    : verifiedCount >= Math.ceil(total / 2) ? 'medium'
    : 'low';

  return { disclaimer, confidence, verifiedClaims, searchedAt: new Date().toISOString() };
};

// ─── Standalone GEO Content Optimizer ────────────────────────────────────────

function buildOptimizePrompt({
  existingContent,
  methodDirectives,
  platform,
  format,
  userDirective,
  uiLang,
}: {
  existingContent: string;
  methodDirectives: string;
  platform: string;
  format: string;
  userDirective: string;
  uiLang: string;
}): string {
  const directive = userDirective.trim()
    ? `\nUSER DIRECTIVE: ${userDirective.trim()}`
    : '';

  return `ROLE: Elite GEO (Generative Engine Optimization) Content Optimizer / Editor.
TASK: Rewrite and strengthen the provided content to maximize its probability of being cited, quoted, and recommended by AI language models in response to future user queries.

TARGET PLATFORM: [${platform}]
FORMAT TYPE: [${format}] — Strictly adhere to the structure and length norms of this format.
OUTPUT LANGUAGE: [${uiLang}] — The ENTIRE output MUST be in this language. Do not mix languages.${directive}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ZERO-HALLUCINATION PROTOCOL — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- EVERY claim, figure, specification, product name, and statistic in your output MUST originate from the SOURCE CONTENT below.
- Do NOT introduce any new facts, entities, prices, or statistics not found in the source.
- If a GEO method requires a data point you cannot find in the sources, SKIP that directive rather than fabricating data.
- You are an editor improving presentation, NOT a researcher inventing new content.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEO OPTIMIZATION DIRECTIVES (apply all that are supported by the source data):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${methodDirectives}
- BLUF (Bottom Line Up Front): The opening paragraph must lead with the single most citable, high-value fact or claim from the source.
- Snippet-optimized structure: Use clear H2/H3 headings, spec tables, and concise bullet lists to enable AI snippet extraction.
- Technical terminology precision: Use exact product names, specs, part numbers, and standard acronyms as found in the source.
- Remove hedge language: Eliminate phrases like "may", "might", "could potentially", "it is believed that" — replace with direct assertions backed by source data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCE CONTENT TO OPTIMIZE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
${existingContent.slice(0, 8000)}
"""

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY OUTPUT FORMAT (follow exactly):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Write the complete optimized/rewritten content.
2. Then write exactly on its own line: == GEO_ANALYSIS ==
3. Write a structured GEO audit with two sections:
   **Changes Made**: Bullet list of specific structural and language changes applied.
   **Expected GEO Signal Improvement**: Quantified estimates (e.g., "quantified claims: +3 → from 2 to 5", "hedge words removed: -4").
4. Then write exactly on its own line: == END ==`;
}

/**
 * Streaming GEO content optimizer for the Standalone Mode.
 * Takes existing content and rewrites it to maximize AI citation probability,
 * applying the selected GEO methods while maintaining strict zero-hallucination.
 */
export async function* optimizeContentForGeoStream(
  existingContent: string,
  selectedMethods: GeoMethodId[],
  platform: string,
  format: string,
  userDirective: string,
  uiLang: string
): AsyncGenerator<string> {
  const methodDirectives = buildMethodDirectives(selectedMethods.slice(0, 3));
  const prompt = buildOptimizePrompt({
    existingContent,
    methodDirectives,
    platform,
    format,
    userDirective,
    uiLang,
  });

  const response = await genAI.models.generateContentStream({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  for await (const chunk of response) {
    if (chunk.text) yield chunk.text;
  }
}