import Header from "../components/Header";
import { SKILLS } from "@/lib/skills";
import { KNOWLEDGE } from "@/lib/generated/content";

export const metadata = { title: "Skills — Warmtewijs AI" };

export default function SkillsPage() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ paddingTop: 56, paddingBottom: 80 }}>
        <div className="eyebrow">skills/*/SKILL.md</div>
        <h1 style={{ fontSize: 40, letterSpacing: "-0.03em", marginBottom: 12 }}>The advisor&apos;s skills</h1>
        <p className="sectionLede">
          Each skill is a Markdown file with YAML frontmatter (<code>name</code>, <code>description</code>) and a procedure. The agent sees only the descriptions up front, and calls <code>load_skill</code> to read the full file when a question falls in that skill&apos;s domain. To add a skill, drop a new folder in <code>skills/</code>. No code changes needed.
        </p>
        {SKILLS.map((s) => (
          <article className="skillCard" key={s.name}>
            <header>
              <strong>{s.name}</strong>
              <span>{s.path}</span>
            </header>
            <div className="desc">{s.description}</div>
            <pre>{s.body}</pre>
          </article>
        ))}

        <div className="eyebrow" style={{ marginTop: 56 }}>knowledge/*.md · RAG corpus</div>
        <h2 style={{ fontSize: 28, letterSpacing: "-0.02em", marginBottom: 16 }}>Knowledge base</h2>
        <div className="grid3">
          {KNOWLEDGE.map((k) => (
            <div className="cell" key={k.id}>
              <span className="cellTag">[{k.id}]</span>
              <h3>{k.title}</h3>
              <p>{k.source}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
