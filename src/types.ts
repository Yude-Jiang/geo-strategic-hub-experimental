
export interface MonitoringQuestion {
  id: string; // unique ID for selection
  userPrompt: string; // The specific complex question an engineer asks AI (e.g. "Can I swap M0+ for M33 without increasing my BOM cost?")
  expectedAnchor: string; // The exact entity/data AI MUST cite (e.g. "STM32C5 or $0.64 entry price cited")
}

export interface StrategicPlaybookItem {
  sourceLogic: string; // Core contradiction & entities
  tacticsType: string; // Authority / Scenario / Counter-Competitor
  contentPlatform: string; // Where & What (e.g., Zhihu, Reddit, Naver Blog)
  structuredDataStrategy: string; // How to Format (e.g., Listicle, Table, Code Block)
  geoAction: string; // Specific GEO Action
  targetSnippet: string; // The "Gold" Target Snippet for AI Answer Box
}

export interface RoleSpecificSop {
  roleName: string;
  coreFocus: string;
  sopTitle: string;
  actionableGuide: string;
  badExample: string;
  goodExample: string;
  checklist: string[];
}

export interface MarketStrategy {
  comprehensiveInsight: {
    aiPerception: string; // Current perception in local AI platforms
    marketGapAnalysis: string; // Market gap for Cognitive Sovereignty
  };
  
  // GEO Playbooks based on the 3-Step Workflow
  implicitIntentStrategy: StrategicPlaybookItem[]; // Based on Table D
  competitorStrategy: StrategicPlaybookItem[]; // Based on Table E

  roleSpecificSops: RoleSpecificSop[];
}

export interface ExecutiveSummaryDimensions {
  marketPulse: string;    // 数据时效与认知现状 (Market Status)
  coreRoadblocks: string; // 核心阻碍 (Why AI doesn't pick us)
  strategicPivot: string; // 战略转向 (SEO -> GEO)
  keyInsight: string;     // 关键洞察 (Counter-intuitive finding)
}

export interface StrategyReport {
  executiveSummary: ExecutiveSummaryDimensions;
  actionPlan: string[]; // Step-by-step GEO tasks
}

export interface CompetitorInsight {
  competitorName: string; 
  aiPerception: string;      // Current AI bias/preference
  corpusAdvantage: string;   // 竞品胜出的底层语料逻辑 (Why AI prefers them)
  threatLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  strategicOpening: string;  // 战略切入点 (How we counter this specific gap)
}

export interface GroundingUrl {
  title: string;
  uri: string;
}

export interface IntentCluster {
  intentName: string;           // e.g., "Intent 1 · BOM-Neutral M0+ → M33 Architecture Migration"
  coreProposition: string;       // e.g., "At $0.64 entry price, the M33 is expensive anchor no longer holds."
  monitoringQuestions: MonitoringQuestion[]; // The specific interception checkpoints
}

export interface AnalysisResult {
  strategyReport: StrategyReport;
  intentClusters: IntentCluster[];
  competitorAnalysis: CompetitorInsight[]; // Added array for Battle Cards
  marketStrategy: MarketStrategy; 
  groundingUrls?: GroundingUrl[]; // Sources from Google Search
}

export type IntentCategory = 
  | 'Academic/Cognition'
  | 'Application/Solution'
  | 'Reliability/Risk'
  | 'Commercial/Selection';

export const EXAMPLE_TERMS = `STM32WBA Matter Thread
nRF52832 Alternative Low Power
Bluetooth LE PSA Level 3 Certification
Matter Smart Lock Single Chip Solution
Industrial Temp Bluetooth SoC Selection for EMEA`;