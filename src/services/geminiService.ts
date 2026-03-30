import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, StrategicPlaybookItem, MonitoringQuestion, MarketStrategy } from "../types";
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
  } catch (_) {}
  return null;
};

const is429 = (err: any): boolean => {
  try {
    const raw = typeof err?.message === 'string' ? JSON.parse(err.message) : err;
    return raw?.error?.code === 429 || raw?.error?.status === 'RESOURCE_EXHAUSTED';
  } catch (_) { return false; }
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
          }
        },
        required: ["intentName", "coreProposition", "monitoringQuestions"]
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
              sourceLogic: { type: Type.STRING },
              tacticsType: { type: Type.STRING },
              contentPlatform: { type: Type.STRING },
              structuredDataStrategy: { type: Type.STRING },
              geoAction: { type: Type.STRING },
              targetSnippet: { type: Type.STRING }
            },
            required: ["sourceLogic", "tacticsType", "contentPlatform", "structuredDataStrategy", "geoAction", "targetSnippet"]
          }
        },
        competitorStrategy: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sourceLogic: { type: Type.STRING },
              tacticsType: { type: Type.STRING },
              contentPlatform: { type: Type.STRING },
              structuredDataStrategy: { type: Type.STRING },
              geoAction: { type: Type.STRING },
              targetSnippet: { type: Type.STRING }
            },
            required: ["sourceLogic", "tacticsType", "contentPlatform", "structuredDataStrategy", "geoAction", "targetSnippet"]
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

export const generateContentStream = async (platform: string, format: string, playbooks: StrategicPlaybookItem[], monitoringQuestions: MonitoringQuestion[], customPrompt: string, sourceContext: string, uiLang: string) => {
  const hasPlaybooks = playbooks && playbooks.length > 0;
  const playbookBlock = hasPlaybooks 
    ? `INSPIRATION POOL (Strategic Context):
The following tactical playbooks have been selected. Draw inspiration, logic angles, or arguments from them. *You do NOT need to artificially jam all of them into a single piece if it disrupts the narrative flow.* Use them to inform your phrasing and perspective:
${JSON.stringify(playbooks, null, 2)}`
    : `FREEFORM MODE: No strategic playbooks were selected. Generate content purely based on the Human Directive and RAG Grounding Materials below. Focus on providing maximum technical value and GEO-optimal structure.`;

  const monitoringBlock = monitoringQuestions && monitoringQuestions.length > 0
    ? `🎯 CRITICAL INTERCEPTION TARGETS (Mandatory Constraints):
The user expects the final AI model to cite the following exact anchors when asked specific questions in the future. YOU MUST weave these <Expected Anchors> naturally but explicitly into your copy. Failure to include these anchors means failure of the task.
${monitoringQuestions.map(q => `- TARGET FUTURE PROMPT: "${q.userPrompt}"\n  -> YOU MUST INJECT ANCHOR: "${q.expectedAnchor}"`).join('\n')}`
    : '';

  const prompt = `CRITICAL ASSIGNMENT:
Write high-converting, deeply technical content tailored for deployment on the platform/ecosystem: [${platform}]. 
CRUCIAL FORMAT REQUIREMENT: You MUST strictly adhere to the structure and length of this specific Format Type: [${format}].

LANGUAGE STRICTNESS: The entire output MUST be written exclusively in: [${uiLang}]. Do NOT mix languages.

${monitoringBlock}

${playbookBlock}

${customPrompt ? `\n🔥 HUMAN DIRECTIVE / OVERRIDE:\n${customPrompt}\n` : ''}

---

## 🚨 MANDATORY: ZERO-HALLUCINATION PROTOCOL (GEO-SPECIFIC)
1. **SOURCE-ONLY FACT BASE**: Every technical specific (prices, model numbers, performance stats) MUST be derived from the "Grounding Materials" provided below.
2. **STRICT ATTRIBUTION**: You MUST explicitly map every major technical claim to its source in the appendix.
3. **NO FABRICATION**: If a specific data point (e.g. precise latency) is not in the source, you MUST state "Technical details not found in reference material" instead of assuming.

## 📐 GEO STRUCTURAL REQUIREMENTS
1. **INVERTED PYRAMID**: Lead with the most important facts/answers first.
2. **SNIPPET OPTIMIZATION**: The first 150 characters MUST be highly descriptive for AI extraction.
3. **SEMANTIC ENRICHMENT**: Use high-weight industry terms found in the source.

---

Grounding Materials (Source Base): 
${sourceContext}

---

## OUTPUT FORMAT INSTRUCTIONS:

**PART 1: THE ARTICLE CONTENT**
Write the full article content first. You MUST start with a clear # H1 Heading as the title.

**PART 2: SEPARATOR**
Exactly: ===GEO_ANALYSIS===

**PART 3: ANALYTICAL APPENDIX & TRUST LOG**
### 🔍 Optimization Breakdown
- **Strategy Selected**: ${hasPlaybooks ? 'Strategic Pillars Applied' : 'Standard RAG Improvement'}
- **Vectorization Strategy**: [Keywords for high retrieval relevance]

### 📈 GEO Performance Forecast
- **RAG Citation Potential**: [High/Medium/Low]
- **Reasoning**: [Technical justification]

### 📜 SOURCE EVIDENCE LOG (TRUST CREDENTIALS)
**YOU MUST MAP EVERY TECHNICAL CLAIM TO A SOURCE PROVIDED IN THE CONTEXT ABOVE:**
- [Claim A] -> Source: [Exact Source Title or Identifier from Context]
- [Claim B] -> Source: [Exact Source Title or Identifier from Context]

===END===`;

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
       "sourceLogic": "How the core technical logic answers the target prompt",
       "tacticsType": "Scenario/Authority/Counter-Competitor",
       "contentPlatform": "Recommended platform (e.g. Technical Forum/Wiki)",
       "structuredDataStrategy": "Specific layout (Table/Code/List) to ensure AI extraction",
       "geoAction": "One sentence specific GEO action",
       "targetSnippet": "A 100-150 word 'Golden Paragraph' that perfectly captures the target anchor"
     }
  ],
  "competitorStrategy": [
     // Same structure as above, but focused on displacing specific competitors for these targets
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

/**
 * Deep Evidence Grounding for Step 3.
 * Specifically targets the anchors chosen in Step 2 to find "hard evidence".
 */
export const deepEvidenceGrounding = async (anchors: string[]): Promise<any[]> => {
  if (!anchors || anchors.length === 0) return [];
  
  const results = await Promise.all(anchors.map(async (anchor) => {
    try {
      const gResult = await genAI.models.generateContent({
        model: GEMINI_MODELS.grounding,
        contents: [{ role: 'user', parts: [{ text: `DEEP FACT CHECK: Find authoritative technical specifications, official prices, or performance figures for: "${anchor}". Priority: Official Whitepapers, Wiki, or Technical Forums. Summarize the hard data found.` }] }],
        config: { tools: [{ googleSearch: {} } as any] }
      });
      
      const content = gResult.text || '';
      let urls: any[] = [];
      if ((gResult as any).groundingMetadata?.groundingChunks) {
        urls = (gResult as any).groundingMetadata.groundingChunks
          .map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
      }
      
      return { 
        name: `Deep Evidence: ${anchor.slice(0, 30)}...`, 
        content, 
        type: 'system',
        urls 
      };
    } catch (err) {
      console.warn(`Deep grounding failed for ${anchor}:`, err);
      return null;
    }
  }));
  
  return results.filter(Boolean);
};