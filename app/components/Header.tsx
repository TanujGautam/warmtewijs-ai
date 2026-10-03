import Link from "next/link";

export default function Header() {
  return (
    <header className="header">
      <Link href="/" className="brand">
        <span className="brandMark" />
        <span className="brandName">Warmtewijs</span>
        <span className="brandTag">AI</span>
      </Link>
      <nav className="nav">
        <Link href="/#under-the-hood">Under the hood</Link>
        <Link href="/skills">Skills</Link>
        <Link href="/#mcp">MCP</Link>
        <Link href="/advisor" className="btn">
          Ask the advisor
        </Link>
      </nav>
    </header>
  );
}
