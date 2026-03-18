import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(import.meta.dirname ?? dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const SKILLS_DIR = join(ROOT, "skills");

let total = 0;
let passed = 0;
let failed = 0;

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
  total++;
  passed++;
}

function fail(msg: string): void {
  console.log(`FAIL: ${msg}`);
  total++;
  failed++;
}

function parseFrontmatter(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let inFrontmatter = false;
  let closed = false;
  const fields: Record<string, string> = {};

  for (const line of lines) {
    if (line.trim() === "---") {
      if (inFrontmatter) {
        closed = true;
        break;
      } else {
        inFrontmatter = true;
        continue;
      }
    }
    if (inFrontmatter) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx);
        let value = line.substring(colonIdx + 1).trim();
        value = value.replace(/^["']/, "").replace(/["']$/, "");
        fields[key] = value;
      }
    }
  }

  return closed ? fields : {};
}

function parseJsonFile(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (e) {
    console.error((e as Error).message);
    return null;
  }
}

function getSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

// Validate plugins/ directory
if (existsSync(PLUGINS_DIR)) {
  for (const pluginName of getSubdirs(PLUGINS_DIR)) {
    const pluginDir = join(PLUGINS_DIR, pluginName);
    const pluginJson = join(pluginDir, ".claude-plugin", "plugin.json");

    if (existsSync(pluginJson)) {
      pass(`[${pluginName}] .claude-plugin/plugin.json exists`);
      const data = parseJsonFile(pluginJson);
      if (data) {
        pass(`[${pluginName}] plugin.json is valid JSON`);
      } else {
        fail(`[${pluginName}] plugin.json is not valid JSON`);
      }

      for (const field of ["name", "description", "version"]) {
        if (data && data[field] != null && data[field] !== "") {
          pass(`[${pluginName}] plugin.json has '${field}' field`);
        } else {
          fail(`[${pluginName}] plugin.json missing '${field}' field`);
        }
      }
    } else {
      fail(`[${pluginName}] .claude-plugin/plugin.json does not exist`);
    }

    const skillsDir = join(pluginDir, "skills");
    const skillsStat = statSync(skillsDir, { throwIfNoEntry: false });
    if (skillsStat?.isDirectory()) {
      pass(`[${pluginName}] skills/ directory exists`);
      let skillCount = 0;

      for (const skillName of getSubdirs(skillsDir)) {
        skillCount++;
        const skillMd = join(skillsDir, skillName, "SKILL.md");

        if (existsSync(skillMd)) {
          pass(`[${pluginName}] skills/${skillName}/SKILL.md exists`);
          const fm = parseFrontmatter(skillMd);

          for (const fmField of ["name", "description"]) {
            if (fmField in fm) {
              pass(`[${pluginName}] skills/${skillName}/SKILL.md has '${fmField}' in frontmatter`);
            } else {
              fail(
                `[${pluginName}] skills/${skillName}/SKILL.md missing '${fmField}' in frontmatter`,
              );
            }
          }

          const nameValue = fm["name"] ?? "";
          if (nameValue && /^[a-z][a-z0-9-]*$/.test(nameValue)) {
            pass(`[${pluginName}] skills/${skillName}/SKILL.md 'name' is valid (lowercase-hyphen)`);
          } else {
            fail(
              `[${pluginName}] skills/${skillName}/SKILL.md 'name' is not lowercase-hyphen format (got: '${nameValue}')`,
            );
          }
        } else {
          fail(`[${pluginName}] skills/${skillName}/SKILL.md does not exist`);
        }
      }

      if (skillCount > 0) {
        pass(`[${pluginName}] skills/ has ${skillCount} skill subdirectory(ies)`);
      } else {
        fail(`[${pluginName}] skills/ has no skill subdirectories`);
      }
    } else {
      fail(`[${pluginName}] skills/ directory does not exist`);
    }

    if (existsSync(join(pluginDir, "README.md"))) {
      pass(`[${pluginName}] README.md exists`);
    } else {
      fail(`[${pluginName}] README.md does not exist`);
    }
  }
}

// Validate skills/ directory (standalone skills)
if (existsSync(SKILLS_DIR)) {
  for (const skillName of getSubdirs(SKILLS_DIR)) {
    const skillMd = join(SKILLS_DIR, skillName, "SKILL.md");

    if (existsSync(skillMd)) {
      pass(`[standalone] ${skillName}/SKILL.md exists`);
      const fm = parseFrontmatter(skillMd);

      for (const fmField of ["name", "description"]) {
        if (fmField in fm) {
          pass(`[standalone] ${skillName}/SKILL.md has '${fmField}' in frontmatter`);
        } else {
          fail(`[standalone] ${skillName}/SKILL.md missing '${fmField}' in frontmatter`);
        }
      }

      const nameValue = fm["name"] ?? "";
      if (nameValue && /^[a-z][a-z0-9-]*$/.test(nameValue)) {
        pass(`[standalone] ${skillName}/SKILL.md 'name' is valid (lowercase-hyphen)`);
      } else {
        fail(
          `[standalone] ${skillName}/SKILL.md 'name' is not lowercase-hyphen format (got: '${nameValue}')`,
        );
      }
    } else {
      fail(`[standalone] ${skillName}/SKILL.md does not exist`);
    }
  }
}

// Summary
if (total === 0) {
  console.log("");
  console.log("ERROR: No content found to validate.");
  process.exit(1);
}

console.log("");
console.log("=========================================");
console.log(`Validation complete: ${total} checks, ${passed} passed, ${failed} failed`);
console.log("=========================================");

if (failed > 0) {
  process.exit(1);
}
