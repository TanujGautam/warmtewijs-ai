// Agent Skills with progressive disclosure: only each skill's name + description
// sits in the system prompt. The full SKILL.md body is loaded on demand via the
// `load_skill` tool, keeping the base prompt small and cache-friendly.
import { SKILLS, SYSTEM_PROMPT } from "./generated/content";

export type SkillName = (typeof SKILLS)[number]["name"];
export const SKILL_NAMES = SKILLS.map((s) => s.name) as SkillName[];

export function getSkill(name: string) {
  return SKILLS.find((s) => s.name === name) ?? null;
}

export function skillIndex(): string {
  return SKILLS.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
}

/** The frozen system prompt: base instructions + skill index. Stable across requests → cacheable. */
export function buildSystemPrompt(): string {
  return `${SYSTEM_PROMPT}\n\n## Available skills\nCall \`load_skill\` with one of these names before answering in its domain:\n${skillIndex()}`;
}

export { SKILLS };
