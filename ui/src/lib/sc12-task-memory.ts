/**
 * SC12 TASK MEMORY HELPERS
 * ========================
 * Parses compact task notes into structured task-memory sections.
 *
 * KEY CONCEPTS:
 * - SC12 task notes act like a lightweight working-memory page.
 * - Markdown-ish headings, `Label: value`, bullets, and links should remain readable in the UI.
 *
 * USAGE:
 * - Parsed by the shared Task Memory view before rendering.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 */

export type TaskMemorySection = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type ParsedTaskMemory = {
  sections: TaskMemorySection[];
  links: string[];
};

const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const DEFAULT_SECTION_TITLE = "Notes";

function normalizeSectionTitle(raw: string): string {
  const trimmed = raw.replace(/#+/g, "").trim();
  if (!trimmed) return DEFAULT_SECTION_TITLE;
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function appendUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) target.push(value);
  }
}

export function collectTaskMemoryLinks(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(
    new Set((text.match(URL_PATTERN) ?? []).map((link) => link.replace(/[.,;:!?]+$/, ""))),
  );
}

export function parseTaskMemory(notes: string | undefined): ParsedTaskMemory {
  const text = notes?.trim() ?? "";
  if (!text) return { sections: [], links: [] };

  const sections: TaskMemorySection[] = [];
  const links = collectTaskMemoryLinks(text);
  let currentSection: TaskMemorySection | null = null;

  const ensureSection = (title = DEFAULT_SECTION_TITLE): TaskMemorySection => {
    if (!currentSection) {
      currentSection = { title, paragraphs: [], bullets: [] };
      sections.push(currentSection);
    }
    return currentSection;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      currentSection = {
        title: normalizeSectionTitle(headingMatch[1]),
        paragraphs: [],
        bullets: [],
      };
      sections.push(currentSection);
      continue;
    }

    const inlineSectionMatch = line.match(/^([A-Za-z][A-Za-z /_-]{1,40}):\s*(.*)$/);
    if (inlineSectionMatch) {
      currentSection = {
        title: normalizeSectionTitle(inlineSectionMatch[1]),
        paragraphs: [],
        bullets: [],
      };
      sections.push(currentSection);
      if (inlineSectionMatch[2]) {
        currentSection.paragraphs.push(inlineSectionMatch[2].trim());
      }
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      ensureSection().bullets.push(bulletMatch[1].trim());
      continue;
    }

    ensureSection().paragraphs.push(line);
  }

  if (links.length > 0 && !sections.some((section) => section.title === "Links")) {
    sections.push({ title: "Links", paragraphs: [], bullets: links });
  } else {
    for (const section of sections) {
      appendUnique(section.bullets, section.title === "Links" ? links : []);
    }
  }

  return { sections, links };
}
