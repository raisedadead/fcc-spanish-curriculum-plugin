---
name: sync-issue-templates
description: >
  Sync GitHub issue templates from an organization's .github repo into the
  current repository. Enables blank issues while preserving org templates and
  contact links. Invoke with /sync-issue-templates. Use for: "sync issue
  templates", "enable blank issues", "copy org templates", "setup issue
  templates", or "update issue template config".
---

# Sync Issue Templates

You are an agent that syncs GitHub issue templates from an organization's
`.github` repository into the current repo, with optional overrides like
enabling blank issues.

GitHub does not support hybrid inheritance — once a repo has its own
`.github/ISSUE_TEMPLATE/` directory, org-level templates are fully overridden.
This skill bridges that gap by fetching and copying org templates locally.

## Prerequisites

- `gh` CLI must be authenticated
- The current directory must be a git repo hosted on GitHub

## Instructions

1. Detect the GitHub org and repo for the current working directory:

   ```
   gh repo view --json owner,name
   ```

2. Fetch the list of issue template files from the org's `.github` repo:

   ```
   gh api repos/{org}/.github/contents/.github/ISSUE_TEMPLATE --jq '.[].name'
   ```

   If the org has no `.github` repo or no `ISSUE_TEMPLATE` directory, inform
   the user and ask how they want to proceed (create templates from scratch or
   abort).

3. For each template file found (`.yml` or `.md` files, excluding `config.yml`),
   fetch its contents:

   ```
   gh api repos/{org}/.github/contents/.github/ISSUE_TEMPLATE/{filename} --jq '.content' | base64 -d
   ```

   Write each template to `.github/ISSUE_TEMPLATE/{filename}` in the current
   repo, preserving the original filename.

4. Fetch the org's `config.yml` if it exists:

   ```
   gh api repos/{org}/.github/contents/.github/ISSUE_TEMPLATE/config.yml --jq '.content' | base64 -d
   ```

5. Build the repo's `config.yml` by starting from the org's config (if found)
   and applying overrides. By default, set `blank_issues_enabled: true`. Preserve
   any `contact_links` from the org config.

6. Ask the user before writing:
   - Show which templates will be copied
   - Show the final `config.yml` that will be written
   - Show any differences from the org defaults (e.g., `blank_issues_enabled`
     changed from `false` to `true`)
   - Wait for explicit confirmation

7. Write all files to `.github/ISSUE_TEMPLATE/` in the current repo.

8. Report what was created/updated.

## Handling arguments

- If the user passes `--no-blank` or opts out of blank issues, set
  `blank_issues_enabled: false`.
- If the user wants to exclude specific org templates, skip those files.
- If the user wants to add extra contact links, append them to the config.

## Output format

After completion, report:

- Files created or updated (with paths)
- Key config differences from org defaults
- Reminder to commit and push to the default branch for changes to take effect

## Guardrails

- Avoid overwriting existing repo-level templates without consent; ask before
  replacing or merging local templates.
- Avoid committing or pushing; write the files and let the user handle git.
- Avoid fabricating template content; copy only from the org's `.github` repo.
- Avoid modifying templates during copy; preserve them exactly as-is.
