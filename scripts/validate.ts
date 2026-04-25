import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type FrontmatterValue,
  getStringField,
  parseFrontmatterFile,
  validateDescription,
  validatePortableName,
} from "./lib/metadata.js";

const ROOT = resolve(import.meta.dirname ?? dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = join(ROOT, "plugins");
const SKILLS_DIR = join(ROOT, "skills");
const AGENTS_DIR = join(ROOT, "agents");

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

function getMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && extname(entry.name) === ".md" && entry.name !== "README.md",
    )
    .map((entry) => entry.name)
    .sort();
}

function checkOptionalString(
  context: string,
  fields: Record<string, FrontmatterValue>,
  field: string,
  maxLength?: number,
): void {
  if (!(field in fields)) return;

  const value = getStringField(fields, field);
  if (value === undefined || value.trim().length === 0) {
    fail(`${context} '${field}' must be a non-empty string`);
    return;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    fail(`${context} '${field}' must be ${maxLength} characters or fewer`);
    return;
  }
  pass(`${context} '${field}' is valid`);
}

function checkMetadata(context: string, fields: Record<string, FrontmatterValue>): void {
  if (!("metadata" in fields)) return;

  const metadata = fields.metadata;
  if (typeof metadata === "string") {
    fail(`${context} 'metadata' must be a mapping`);
    return;
  }

  const badEntry = Object.entries(metadata).find(
    ([key, value]) => key.trim().length === 0 || typeof value !== "string",
  );
  if (badEntry) {
    fail(`${context} 'metadata' keys and values must be strings`);
  } else {
    pass(`${context} 'metadata' is valid`);
  }
}

function validateMarkdownDefinition(
  kind: "agent" | "skill",
  context: string,
  filePath: string,
  expectedName: string,
): void {
  const parsed = parseFrontmatterFile(filePath);

  if (parsed.errors.length === 0) {
    pass(`${context} frontmatter is valid`);
  } else {
    for (const error of parsed.errors) {
      fail(`${context} ${error}`);
    }
  }

  const nameValue = getStringField(parsed.fields, "name") ?? "";
  if (nameValue.length > 0) {
    pass(`${context} has 'name' in frontmatter`);
  } else {
    fail(`${context} missing 'name' in frontmatter`);
  }

  const nameErrors = validatePortableName(nameValue);
  if (nameErrors.length === 0) {
    pass(`${context} 'name' is valid`);
  } else {
    for (const error of nameErrors) {
      fail(`${context} 'name' ${error}`);
    }
  }

  if (nameValue === expectedName) {
    pass(`${context} 'name' matches ${kind === "skill" ? "directory" : "filename"}`);
  } else {
    fail(
      `${context} 'name' must match ${kind === "skill" ? "directory" : "filename"} (got: '${nameValue}')`,
    );
  }

  const descriptionValue = getStringField(parsed.fields, "description") ?? "";
  if (descriptionValue.length > 0) {
    pass(`${context} has 'description' in frontmatter`);
  } else {
    fail(`${context} missing 'description' in frontmatter`);
  }

  const descriptionErrors = validateDescription(descriptionValue);
  if (descriptionErrors.length === 0) {
    pass(`${context} 'description' is valid`);
  } else {
    for (const error of descriptionErrors) {
      fail(`${context} 'description' ${error}`);
    }
  }

  checkOptionalString(context, parsed.fields, "license");
  checkOptionalString(context, parsed.fields, "compatibility", 500);
  checkOptionalString(context, parsed.fields, "allowed-tools");
  checkMetadata(context, parsed.fields);

  if (parsed.body.length > 0) {
    pass(`${context} has markdown body`);
  } else {
    fail(`${context} missing markdown body`);
  }
}

function validateAgentsDir(dir: string, contextPrefix: string): void {
  const agentFiles = getMarkdownFiles(dir);
  if (agentFiles.length === 0) return;

  for (const fileName of agentFiles) {
    const expectedName = parse(fileName).name;
    const filePath = join(dir, fileName);
    validateMarkdownDefinition("agent", `${contextPrefix} ${fileName}`, filePath, expectedName);
  }
}

function validateSkill(skillMd: string, context: string, expectedName: string): void {
  if (existsSync(skillMd)) {
    pass(`${context}/SKILL.md exists`);
    validateMarkdownDefinition("skill", `${context}/SKILL.md`, skillMd, expectedName);
  } else {
    fail(`${context}/SKILL.md does not exist`);
  }
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
        if (data && typeof data[field] === "string" && data[field] !== "") {
          pass(`[${pluginName}] plugin.json has '${field}' field`);
        } else {
          fail(`[${pluginName}] plugin.json missing '${field}' field`);
        }
      }

      const manifestName = typeof data?.name === "string" ? data.name : "";
      if (manifestName === pluginName) {
        pass(`[${pluginName}] plugin.json 'name' matches directory`);
      } else {
        fail(`[${pluginName}] plugin.json 'name' must match directory (got: '${manifestName}')`);
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
        const skillDir = join(skillsDir, skillName);
        validateSkill(join(skillDir, "SKILL.md"), `[${pluginName}] skills/${skillName}`, skillName);
        validateAgentsDir(join(skillDir, "agents"), `[${pluginName}] skills/${skillName}/agents`);
      }

      if (skillCount > 0) {
        pass(`[${pluginName}] skills/ has ${skillCount} skill subdirectory(ies)`);
      } else {
        fail(`[${pluginName}] skills/ has no skill subdirectories`);
      }
    } else {
      fail(`[${pluginName}] skills/ directory does not exist`);
    }

    validateAgentsDir(join(pluginDir, "agents"), `[${pluginName}] agents`);

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
    validateSkill(join(SKILLS_DIR, skillName, "SKILL.md"), `[standalone] ${skillName}`, skillName);
  }
}

// Validate shared agents.
validateAgentsDir(AGENTS_DIR, "[agent]");

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
