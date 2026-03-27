import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, StrategicPlaybookItem } from "../types";
import { GEMINI_MODELS } from "../config/models";

// Initialize with Runtime env (from server.js) or Vite env (built-in)
const apiKey = (window as any).env?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey });

const getSystemInstruction = (lang: string, customRegion?: string, targetEcosystem?: string) => {
  const commonRole = `
Role: Senior Hard Tech GEO (Generative Engine Optimization) Strategic Analyst.
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
1. marketPulse: First line MUST explicitly state: "Simulated Models: [List of Models]". 
   - For Global: GPT-4o, Claude 3.5, Gemini.
   - For CN: 百度文心一言 (Ernie), DeepSeek, Kimi, 豆包 (Doubao), 元宝 (Yuanbao), 千问 (Qwen).
   - For JP: Yahoo/Line, Claude 3, GPT-4o.
   - For KR: Naver CUE:, GPT-4o.
   If grounding reveals similar biases across the ecosystem's models, explicitly declare it as a "Cross-Model Consensus (多模型交叉共识)". Describe the current AI perception accurately.
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

Step 3: Deep Insight Analysis (Intent Clustering)
Group your findings into 3-5 high-level "Intent Clusters".
For each cluster:
- **Core Proposition**: The main strategic argument for this cluster.
- **AI Perception Bias**: Explain WHY this gap exists.
- **Evidence Logic**: Provide the reasoning chain.
- **Simulated Questions**: Generate 3-5 questions engineers would ask. **NO KEYWORDS**.

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
          intentTitle: { type: Type.STRING },
          coreProposition: { type: Type.STRING },
          aiPerceptionBias: { type: Type.STRING },
          evidenceLogic: { type: Type.STRING },
          painPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                searchTerm: { type: Type.STRING },
                intentCategory: { type: Type.STRING },
                userPainPoint: { type: Type.STRING },
                aiKnowledgeGap: { type: Type.STRING },
                strategicContent: { type: Type.STRING }
              },
              required: ["searchTerm", "intentCategory", "userPainPoint", "aiKnowledgeGap", "strategicContent"]
            }
          },
          simulatedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["intentTitle", "coreProposition", "aiPerceptionBias", "evidenceLogic", "painPoints", "simulatedQuestions"]
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

  try {
    const gResult = await genAI.models.generateContent({
      model: GEMINI_MODELS.grounding,
      contents: [{ role: 'user', parts: [{ text: `CRITICAL IMPERATIVE: The current year is 2026. Perform a real-time Google Search grounding for: "${textInput}". You MUST actively search and return the absolute latest technical discussions, market gaps, and competitor news from 2025 and 2026. STRIPPED OUT outdated data from 2024 or earlier. Provide a dense summary of the current 2026 landscape for this technology.` }] }],
      config: {
        tools: [{ googleSearch: {} } as any]
      }
    });
    groundingContext = gResult.text || '';
    // Grounding URLs extraction in new SDK
    if ((gResult as any).groundingMetadata?.groundingChunks) {
       groundingUrls = (gResult as any).groundingMetadata.groundingChunks
        .map((c: any) => c.web).filter(Boolean).map((w: any) => ({ title: w.title, uri: w.uri }));
    }
  } catch (err) { console.warn(err); }

  const finalPrompt = groundingContext ? `${textInput}\n\nRESEARCH:\n${groundingContext}` : textInput;
  const parts: any[] = [{ text: finalPrompt }];
  images.forEach(img => parts.push({ data: img.data, mime_type: img.mimeType }));

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

export const generateContentStream = async (platform: string, format: string, playbooks: StrategicPlaybookItem[], customPrompt: string, sourceContext: string, uiLang: string) => {
  const hasPlaybooks = playbooks && playbooks.length > 0;
  const playbookBlock = hasPlaybooks 
    ? `INSPIRATION POOL (Strategic Context):
The following tactical playbooks have been selected. Draw inspiration, logic angles, or arguments from them. *You do NOT need to artificially jam all of them into a single piece if it disrupts the narrative flow.* Use them to inform your phrasing and perspective:
${JSON.stringify(playbooks, null, 2)}`
    : `FREEFORM MODE: No strategic playbooks were selected. Generate content purely based on the Human Directive and RAG Grounding Materials below. Focus on providing maximum technical value and GEO-optimal structure.`;

  const prompt = `CRITICAL ASSIGNMENT:
Write high-converting, deeply technical content tailored for deployment on the platform/ecosystem: [${platform}]. 
CRUCIAL FORMAT REQUIREMENT: You MUST strictly adhere to the structure and length of this specific Format Type: [${format}].

LANGUAGE STRICTNESS: The entire output MUST be written exclusively in: [${uiLang}]. Do NOT mix languages, regardless of the platform.

${playbookBlock}

${customPrompt ? `\n🔥 HUMAN DIRECTIVE / OVERRIDE:\nThe user has provided explicit instructions for the exact angle or theme they want for this specific iteration. YOU MUST PRIORITIZE THIS DIRECTIVE ABOVE ALL ELSE:\n"""${customPrompt}"""\n` : ''}

Grounding Materials (Fact Base): 
${sourceContext}

---

## OUTPUT FORMAT INSTRUCTIONS:

**PART 1: THE ARTICLE CONTENT**
Write the full article content first.

**PART 2: SEPARATOR**
After the article, output a separator line exactly as: ===GEO_ANALYSIS===

**PART 3: MANDATORY ANALYTICAL APPENDIX**
After the separator, you MUST output the following structured analysis IN THE SAME LANGUAGE (${uiLang}):

### 🔍 Optimization Breakdown
- **Strategy Selected**: ${hasPlaybooks ? '[Name the strategies from the Inspiration Pool that you actually used]' : '[Freeform / RAG-Only]'}
- **Vectorization Strategy / 矢量化策略**:
  - **Semantic Enrichment**: [List high-weight industry terms you added to improve relevance.]
  - **Synonym Expansion**: [List synonyms added to improve retrieval recall.]
- **Structural Changes / 结构调整**:
  - **Lead with Answers**: [Explain how you restructured paragraphs for 'Answer Engines'.]
  - **Ambiguity Removal**: [Explain how you replaced pronouns like "It/They" with specific nouns for better Chunking.]
- **Intent Alignment / 意图对齐**: [How the content fits the specific user scenario.]

### 📈 GEO Performance Forecast
- **RAG Citation Potential / RAG 引用潜力**: **[High/Medium/Low]**
- **Reasoning**:
  - **Data Granularity**: [Mention specific hard data points retained/added]
  - **Context Independence**: [Mention how self-contained chunks reduce hallucinations]

===END===`;

  const response = await genAI.models.generateContentStream({
    model: GEMINI_MODELS.contentGen,
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  
  async function* stream() {
    for await (const chunk of response) {
      yield chunk.text;
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
  // Strip markdown wrappers if the model hallucinates them
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

export const fetchUrlContent = async (url: string) => {
  const res = await fetch(`https://r.jina.ai/${url}`);
  const text = await res.text();
  return { title: url, content: text, wordCount: text.split(/\s+/).length };
};