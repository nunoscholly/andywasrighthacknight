export type Severity = "critical" | "warning" | "info";
export type Category = "completeness" | "plausibility" | "risk" | "consistency";

export interface Finding {
  severity: Severity;
  category: Category;
  title: string;
  what_to_clarify: string;
  why_it_matters: string;
  priority: number | null;
}

export interface BriefingRecord {
  id: string;
  client_name: string;
  submitted_at: string;
  raw_input: Record<string, unknown>;
  status: "analyzing" | "ready" | "failed";
  tldr: string | null;
  findings: Finding[];
}

export interface BriefingForm {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company: string;
  projectTitle: string;
  shortDescription: string;
  background: string;
  message: string;
  projectDetail: string;
  goals: string;
  targetAudience: string;
  platforms: string;
  deliverablesDescription: string;
  formats: string;
  submittedDate: string;
  offerDueDate: string;
  productionStart: string;
  productionEnd: string;
  budgetChf: number;
  budgetNotes: string;
  models: string;
  timingNotes: string;
  finalNotes: string;
}

export type RiskLevel = "High" | "Medium" | "Low";

export interface AnalysisResult {
  tldr: string;
  findings: Finding[];
  risk_level: RiskLevel;
  recommended_action: string;
  drafted_reply: string;
}
