import { Sparkles } from "lucide-react";
import logo from "../assets/logo.svg";

export function Header() {
  return (
    <header className="header">
      <a className="brand" href="#top" aria-label="Thumblify home">
        <img src={logo} alt="Thumblify" />
      </a>
      <nav className="nav" aria-label="Primary navigation">
        <a href="#generate">Generate</a>
        <a href="#gallery">Gallery</a>
      </nav>
      <a className="headerCta" href="#generate">
        <Sparkles size={18} />
        Create
      </a>
    </header>
  );
}
