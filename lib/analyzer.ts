import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnalysisResult, BriefingForm, Finding } from "./types";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("Missing ANTHROPIC_API_KEY.");
}

const client = new Anthropic({ apiKey });

const FindingSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  category: z.enum(["completeness", "plausibility", "risk", "consistency"]),
  title: z.string().min(1),
  what_to_clarify: z.string().min(1),
  why_it_matters: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
});

const AnalysisSchema = z.object({
  tldr: z.string().min(1),
  findings: z.array(FindingSchema),
});

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    tldr: {
      type: "string",
      description:
        "Three to five sentences. State the project in one line, then the biggest blockers before the agency can quote.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "warning", "info"],
            description:
              "critical = blocks quoting / will cause production failure. warning = needs clarification but not blocking. info = noted, low risk.",
          },
          category: {
            type: "string",
            enum: ["completeness", "plausibility", "risk", "consistency"],
          },
          title: { type: "string", description: "Six to ten words." },
          what_to_clarify: {
            type: "string",
            description:
              "One or two sentences. The exact question or missing fact.",
          },
          why_it_matters: {
            type: "string",
            description:
              "One or two sentences. The downstream consequence if unresolved.",
          },
          priority: {
            type: ["integer", "null"],
            enum: [1, 2, 3, null],
            description:
              "1, 2, or 3 for the three most important questions to ask the client. null for the rest.",
          },
        },
        required: [
          "severity",
          "category",
          "title",
          "what_to_clarify",
          "why_it_matters",
          "priority",
        ],
      },
    },
  },
  required: ["tldr", "findings"],
};

const SYSTEM_PROMPT = `You are a senior Account Manager analyst at Andy Was Right, a Zurich-based creative content agency. A client has submitted a project briefing. Your job: produce a structured analysis for the AM who will respond.

Look for:
- completeness: missing facts the agency needs before quoting (venue, dates, contacts, deliverable specs)
- plausibility: budget vs scope mismatches, timelines that don't fit production realities
- risk: legal/usage rights, weather, model availability, location permits, dependencies on unspecified assets
- consistency: contradictions within the brief, references to attachments not provided, dates that don't line up

Be specific. Reference concrete details from the brief. Avoid generic advice. Mark exactly three findings with priority 1, 2, 3 — these are the top questions the AM should ask the client first. All other findings get priority null.

Severity rules:
- critical: blocks the quote, will derail production, or signals a legal issue.
- warning: needs clarification, scope creep risk.
- info: worth noting, not actionable now.

Produce 5–10 findings total. Quality over quantity. If the brief is unusually clean, return fewer.`;

export async function analyzeBriefing(
  briefing: BriefingForm,
): Promise<AnalysisResult> {
  const userMessage = `Client briefing payload (JSON):\n\n${JSON.stringify(
    briefing,
    null,
    2,
  )}\n\nAnalyze it and return findings via the report_findings tool.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "report_findings",
        description:
          "Submit the structured analysis of the client briefing.",
        input_schema: TOOL_INPUT_SCHEMA as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "report_findings" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block.");
  }

  const parsed = AnalysisSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      `Analyzer schema validation failed: ${parsed.error.message}`,
    );
  }

  const findings: Finding[] = parsed.data.findings;
  return { tldr: parsed.data.tldr, findings };
}
