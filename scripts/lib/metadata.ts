import { readFileSync } from "node:fs";

export type FrontmatterValue = string | Record<string, string>;

export interface FrontmatterResult {
  fields: Record<string, FrontmatterValue>;
  body: string;
  errors: string[];
}

export const PORTABLE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validatePortableName(value: string, label = "name"): string[] {
  const errors: string[] = [];

  if (value.length === 0) {
    errors.push(`${label} is required`);
  }
  if (value.length > 64) {
    errors.push(`${label} must be 64 characters or fewer`);
  }
  if (!PORTABLE_NAME_RE.test(value)) {
    errors.push(
      `${label} must use lowercase letters, numbers, and single hyphens, with no leading or trailing hyphen`,
    );
  }

  return errors;
}

export function validateDescription(value: string): string[] {
  const errors: string[] = [];
  const normalized = value.trim();

  if (normalized.length === 0) {
    errors.push("description is required");
  }
  if (normalized.length > 1024) {
    errors.push("description must be 1024 characters or fewer");
  }

  return errors;
}

export function validateScaffoldDescription(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return "Description is required.";
  }
  if (/^---$/m.test(value)) {
    return "Description must not contain YAML document separators (---).";
  }
  return undefined;
}

export function parseFrontmatterFile(filePath: string): FrontmatterResult {
  return parseFrontmatter(readFileSync(filePath, "utf-8"));
}

export function parseFrontmatter(content: string): FrontmatterResult {
  const lines = content.split(/\r?\n/);
  const errors: string[] = [];

  if (lines[0]?.trim() !== "---") {
    return {
      fields: {},
      body: content.trim(),
      errors: ["frontmatter must start with ---"],
    };
  }

  const closeIdx = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (closeIdx === -1) {
    return {
      fields: {},
      body: "",
      errors: ["frontmatter must end with ---"],
    };
  }

  const fields = parseYamlSubset(lines.slice(1, closeIdx), errors);
  const body = lines
    .slice(closeIdx + 1)
    .join("\n")
    .trim();
  return { fields, body, errors };
}

export function getStringField(
  fields: Record<string, FrontmatterValue>,
  key: string,
): string | undefined {
  const value = fields[key];
  return typeof value === "string" ? value : undefined;
}

function parseYamlSubset(lines: string[], errors: string[]): Record<string, FrontmatterValue> {
  const fields: Record<string, FrontmatterValue> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      continue;
    }
    if (/^\s/.test(line)) {
      errors.push(`unexpected indented line in frontmatter: ${line.trim()}`);
      continue;
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(line);
    if (!match) {
      errors.push(`invalid frontmatter line: ${line.trim()}`);
      continue;
    }

    const [, key, rawValue = ""] = match;
    const value = rawValue.trim();

    if (value === ">" || value === "|") {
      const blockLines: string[] = [];
      while (i + 1 < lines.length && isIndentedOrBlank(lines[i + 1])) {
        blockLines.push(lines[++i]);
      }
      fields[key] = parseBlockScalar(blockLines, value);
      continue;
    }

    if (value === "" && i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
      const map: Record<string, string> = {};
      while (i + 1 < lines.length && isIndentedOrBlank(lines[i + 1])) {
        const childLine = lines[++i];
        if (childLine.trim().length === 0) {
          continue;
        }
        const childMatch = /^\s+([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/.exec(childLine);
        if (!childMatch) {
          errors.push(`invalid nested frontmatter line: ${childLine.trim()}`);
          continue;
        }
        map[childMatch[1]] = stripQuotes((childMatch[2] ?? "").trim());
      }
      fields[key] = map;
      continue;
    }

    fields[key] = stripQuotes(value);
  }

  return fields;
}

function isIndentedOrBlank(line: string): boolean {
  return line.trim().length === 0 || /^\s/.test(line);
}

function parseBlockScalar(lines: string[], style: ">" | "|"): string {
  const unindented = stripCommonIndent(lines).join("\n").trim();
  return style === ">" ? unindented.replace(/\n+/g, " ") : unindented;
}

function stripCommonIndent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(indent));
}

function stripQuotes(value: string): string {
  return value.replace(/^["']/, "").replace(/["']$/, "");
}
