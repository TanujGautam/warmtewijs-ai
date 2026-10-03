import { SKILLS } from "@/lib/skills";

export function GET() {
  return Response.json({ skills: SKILLS.map(({ name, description, path }) => ({ name, description, path })) });
}
