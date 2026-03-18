import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

function readJSON(rel: string) {
  return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
}

describe("project scaffolding", () => {
  it("package.json has correct metadata", () => {
    const pkg = readJSON("package.json");
    expect(pkg.name).toBe("@freecodecamp/ai-marketplace");
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe("module");
    expect(pkg.packageManager).toMatch(/^pnpm@/);
    expect(pkg.engines?.node).toBe(">=22");
  });

  it("package.json has all required scripts", () => {
    const pkg = readJSON("package.json");
    expect(pkg.scripts).toHaveProperty("validate");
    expect(pkg.scripts).toHaveProperty("scaffold");
    expect(pkg.scripts).toHaveProperty("test");
    expect(pkg.scripts).toHaveProperty("lint");
    expect(pkg.scripts).toHaveProperty("format");
    expect(pkg.scripts).toHaveProperty("format:check");
    expect(pkg.scripts).toHaveProperty("check");
  });

  it("package.json has required devDependencies", () => {
    const pkg = readJSON("package.json");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).toHaveProperty("tsx");
    expect(deps).toHaveProperty("typescript");
    expect(deps).toHaveProperty("vitest");
    expect(deps).toHaveProperty("turbo");
    expect(deps).toHaveProperty("oxlint");
    expect(deps).toHaveProperty("@clack/prompts");
  });

  it("tsconfig.json has correct compiler options", () => {
    const tsconfig = readJSON("tsconfig.json");
    expect(tsconfig.compilerOptions.target).toBe("ES2022");
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.outDir).toBe("dist");
  });

  it("tsconfig.json includes scripts/ and tests/", () => {
    const tsconfig = readJSON("tsconfig.json");
    expect(tsconfig.include).toContain("scripts");
    expect(tsconfig.include).toContain("tests");
  });

  it("turbo.json has all required tasks", () => {
    const turbo = readJSON("turbo.json");
    expect(turbo.tasks).toHaveProperty("validate");
    expect(turbo.tasks).toHaveProperty("test");
    expect(turbo.tasks).toHaveProperty("lint");
    expect(turbo.tasks).toHaveProperty("format");
    expect(turbo.tasks).toHaveProperty("format:check");
    expect(turbo.tasks).toHaveProperty("check");
  });

  it("turbo.json check task depends on validate, test, lint, format:check", () => {
    const turbo = readJSON("turbo.json");
    const checkDeps = turbo.tasks.check.dependsOn;
    expect(checkDeps).toContain("validate");
    expect(checkDeps).toContain("test");
    expect(checkDeps).toContain("lint");
    expect(checkDeps).toContain("format:check");
  });

  it("vitest.config.ts exists", () => {
    expect(existsSync(resolve(ROOT, "vitest.config.ts"))).toBe(true);
  });

  it("oxlint config exists", () => {
    expect(existsSync(resolve(ROOT, ".oxlintrc.json"))).toBe(true);
  });

  it(".gitignore includes required entries", () => {
    const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");
    expect(gitignore).toContain(".turbo/");
  });
});
