import * as p from "@clack/prompts";
import {
  mkdirSync,
  readdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TEMPLATES_DIR = join(ROOT, "templates");
const PLUGINS_DIR = join(ROOT, "plugins");
const SKILLS_DIR = join(ROOT, "skills");

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const YAML_SEPARATOR_RE = /^---$/m;

interface ScaffoldOptions {
  name: string;
  description: string;
  type: "plugin" | "skill";
}

function parseArgs(argv: string[]): Partial<ScaffoldOptions> {
  const opts: Partial<ScaffoldOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) {
      opts.name = argv[++i];
    } else if (argv[i] === "--description" && argv[i + 1]) {
      opts.description = argv[++i];
    } else if (argv[i] === "--type" && argv[i + 1]) {
      const val = argv[++i];
      if (val === "plugin" || val === "skill") {
        opts.type = val;
      }
    }
  }
  return opts;
}

function validateName(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return "Name is required.";
  }
  if (!NAME_RE.test(value)) {
    return "Name must be lowercase letters, numbers, and hyphens, starting with a letter.";
  }
  return undefined;
}

function validateDescription(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return "Description is required.";
  }
  if (YAML_SEPARATOR_RE.test(value)) {
    return "Description must not contain YAML document separators (---).";
  }
  return undefined;
}

function checkNameExists(name: string, type: "plugin" | "skill"): string | undefined {
  const targetDir = type === "plugin" ? join(PLUGINS_DIR, name) : join(SKILLS_DIR, name);
  if (existsSync(targetDir)) {
    return `${type === "plugin" ? "Plugin" : "Skill"} "${name}" already exists at ${targetDir}`;
  }
  return undefined;
}

function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function scaffoldPlugin(name: string, description: string): void {
  const templateDir = join(TEMPLATES_DIR, "plugin");
  const targetDir = join(PLUGINS_DIR, name);

  copyDirSync(templateDir, targetDir);

  const pluginJsonPath = join(targetDir, ".claude-plugin", "plugin.json");
  const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
  pluginJson.name = name;
  pluginJson.description = description;
  pluginJson.version = "1.0.0";
  writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");

  const oldSkillDir = join(targetDir, "skills", "example");
  const newSkillDir = join(targetDir, "skills", name);
  renameSync(oldSkillDir, newSkillDir);

  const skillMdPath = join(newSkillDir, "SKILL.md");
  let skillMd = readFileSync(skillMdPath, "utf-8");
  skillMd = skillMd.replace(/^name: example-skill$/m, `name: ${name}`);
  skillMd = skillMd.replace(
    /^description: >[\s\S]*?(?=^---)/m,
    `description: >\n  ${description}\n`,
  );
  writeFileSync(skillMdPath, skillMd);

  const readmePath = join(targetDir, "README.md");
  let readme = readFileSync(readmePath, "utf-8");
  readme = readme.replace(/^# Plugin Name$/m, `# ${name}`);
  readme = readme.replace(
    /^Short description of what this plugin does and the problem it solves\.$/m,
    description,
  );
  readme = readme.replace(/plugins\/plugin-name/g, `plugins/${name}`);
  writeFileSync(readmePath, readme);
}

function scaffoldSkill(name: string, description: string): void {
  const templateDir = join(TEMPLATES_DIR, "skill");
  const targetDir = join(SKILLS_DIR, name);

  copyDirSync(templateDir, targetDir);

  const skillMdPath = join(targetDir, "SKILL.md");
  let skillMd = readFileSync(skillMdPath, "utf-8");
  skillMd = skillMd.replace(/^name: skill-name$/m, `name: ${name}`);
  skillMd = skillMd.replace(
    /^description: >[\s\S]*?(?=^---)/m,
    `description: >\n  ${description}\n`,
  );
  writeFileSync(skillMdPath, skillMd);
}

async function runInteractive(partial: Partial<ScaffoldOptions>): Promise<ScaffoldOptions> {
  p.intro("Scaffold a new plugin or skill");

  const type =
    partial.type ??
    (await (async () => {
      const result = await p.select({
        message: "What do you want to create?",
        options: [
          { value: "plugin" as const, label: "Plugin" },
          { value: "skill" as const, label: "Standalone Skill" },
        ],
      });
      if (p.isCancel(result)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      return result;
    })());

  const name =
    partial.name ??
    (await (async () => {
      const result = await p.text({
        message: "Name?",
        placeholder: "my-plugin",
        validate: validateName,
      });
      if (p.isCancel(result)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      return result;
    })());

  const existsErr = checkNameExists(name, type);
  if (existsErr) {
    p.log.error(existsErr);
    process.exit(1);
  }

  const description =
    partial.description ??
    (await (async () => {
      const result = await p.text({
        message: "Description?",
        placeholder: "A brief description",
        validate: validateDescription,
      });
      if (p.isCancel(result)) {
        p.cancel("Cancelled.");
        process.exit(1);
      }
      return result;
    })());

  return { name, description, type };
}

function runNonInteractive(partial: Partial<ScaffoldOptions>): ScaffoldOptions {
  if (!partial.name || !partial.description || !partial.type) {
    console.error("Non-interactive mode requires --name, --description, and --type flags.");
    process.exit(1);
  }

  const nameErr = validateName(partial.name);
  if (nameErr) {
    console.error(`Invalid name: ${nameErr}`);
    process.exit(1);
  }

  const descErr = validateDescription(partial.description);
  if (descErr) {
    console.error(`Invalid description: ${descErr}`);
    process.exit(1);
  }

  const existsErr = checkNameExists(partial.name, partial.type);
  if (existsErr) {
    console.error(existsErr);
    process.exit(1);
  }

  return partial as ScaffoldOptions;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.name !== undefined) {
    const nameErr = validateName(args.name);
    if (nameErr) {
      console.error(`Invalid name: ${nameErr}`);
      process.exit(1);
    }
  }

  if (args.description !== undefined) {
    const descErr = validateDescription(args.description);
    if (descErr) {
      console.error(`Invalid description: ${descErr}`);
      process.exit(1);
    }
  }

  const isNonInteractive =
    args.name !== undefined && args.description !== undefined && args.type !== undefined;

  const opts = isNonInteractive ? runNonInteractive(args) : await runInteractive(args);

  if (opts.type === "plugin") {
    scaffoldPlugin(opts.name, opts.description);
    const msg = `Plugin created at plugins/${opts.name}/. Run pnpm run validate to verify.`;
    if (isNonInteractive) {
      console.log(msg);
    } else {
      p.outro(msg);
    }
  } else {
    scaffoldSkill(opts.name, opts.description);
    const msg = `Skill created at skills/${opts.name}/. Run pnpm run validate to verify.`;
    if (isNonInteractive) {
      console.log(msg);
    } else {
      p.outro(msg);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
