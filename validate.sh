#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL=0
PASSED=0
FAILED=0

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

pass() {
  echo "PASS: $1"
  TOTAL=$((TOTAL + 1))
  PASSED=$((PASSED + 1))
}

fail() {
  echo "FAIL: $1"
  TOTAL=$((TOTAL + 1))
  FAILED=$((FAILED + 1))
}

validate_json_file() {
  local file="$1"
  local jq_err
  if jq_err="$(jq empty "$file" 2>&1)"; then
    return 0
  else
    echo "$jq_err" >&2
    return 1
  fi
}

json_has_field() {
  local file="$1" field="$2"
  jq -e --arg f "$field" '.[$f] | select(. != null and . != "")' "$file" &>/dev/null
}

# NOTE: Known limitation — a literal "---" inside a field value would prematurely
# close the frontmatter block in this simple line-based parser.
has_yaml_frontmatter_field() {
  local file="$1" field="$2"
  local in_frontmatter=false
  local found=false
  local closed=false
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if [[ "$in_frontmatter" == true ]]; then
        closed=true
        break
      else
        in_frontmatter=true
        continue
      fi
    fi
    if [[ "$in_frontmatter" == true ]]; then
      if [[ "$line" =~ ^${field}: ]]; then
        found=true
      fi
    fi
  done < "$file"
  [[ "$found" == true && "$closed" == true ]]
}

# NOTE: Known limitation — a literal "---" inside a field value would prematurely
# close the frontmatter block in this simple line-based parser.
get_yaml_field() {
  local file="$1" field="$2"
  local in_frontmatter=false
  local closed=false
  local value=""
  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if [[ "$in_frontmatter" == true ]]; then
        closed=true
        break
      else
        in_frontmatter=true
        continue
      fi
    fi
    if [[ "$in_frontmatter" == true ]]; then
      if [[ "$line" =~ ^${field}:[[:space:]]*(.*) ]]; then
        value="${BASH_REMATCH[1]}"
        # Strip surrounding quotes (single or double) if present
        value="${value#\"}" ; value="${value%\"}"
        value="${value#\'}" ; value="${value%\'}"
      fi
    fi
  done < "$file"
  if [[ "$closed" == true ]]; then
    echo "$value"
  fi
}

# ============================================================
# Validate plugins/ directory
# ============================================================
if [[ -d "$SCRIPT_DIR/plugins" ]]; then
  for plugin_dir in "$SCRIPT_DIR"/plugins/*/; do
    [[ -d "$plugin_dir" ]] || continue
    plugin_dir="${plugin_dir%/}"
    plugin_name="$(basename "$plugin_dir")"

    plugin_json="$plugin_dir/.claude-plugin/plugin.json"
    if [[ -f "$plugin_json" ]]; then
      pass "[$plugin_name] .claude-plugin/plugin.json exists"
      if validate_json_file "$plugin_json"; then
        pass "[$plugin_name] plugin.json is valid JSON"
      else
        fail "[$plugin_name] plugin.json is not valid JSON"
      fi

      for field in name description version; do
        if json_has_field "$plugin_json" "$field"; then
          pass "[$plugin_name] plugin.json has '$field' field"
        else
          fail "[$plugin_name] plugin.json missing '$field' field"
        fi
      done
    else
      fail "[$plugin_name] .claude-plugin/plugin.json does not exist"
    fi

    skills_dir="$plugin_dir/skills"
    if [[ -d "$skills_dir" ]]; then
      pass "[$plugin_name] skills/ directory exists"
      skill_count=0
      for skill_sub in "$skills_dir"/*/; do
        [[ -d "$skill_sub" ]] || continue
        skill_sub="${skill_sub%/}"
        skill_count=$((skill_count + 1))
        skill_name="$(basename "$skill_sub")"
        skill_md="$skill_sub/SKILL.md"
        if [[ -f "$skill_md" ]]; then
          pass "[$plugin_name] skills/$skill_name/SKILL.md exists"

          for fm_field in name description; do
            if has_yaml_frontmatter_field "$skill_md" "$fm_field"; then
              pass "[$plugin_name] skills/$skill_name/SKILL.md has '$fm_field' in frontmatter"
            else
              fail "[$plugin_name] skills/$skill_name/SKILL.md missing '$fm_field' in frontmatter"
            fi
          done

          name_value="$(get_yaml_field "$skill_md" "name")"
          if [[ -n "$name_value" && "$name_value" =~ ^[a-z][a-z0-9-]*$ ]]; then
            pass "[$plugin_name] skills/$skill_name/SKILL.md 'name' is valid (lowercase-hyphen)"
          else
            fail "[$plugin_name] skills/$skill_name/SKILL.md 'name' is not lowercase-hyphen format (got: '$name_value')"
          fi
        else
          fail "[$plugin_name] skills/$skill_name/SKILL.md does not exist"
        fi
      done
      if [[ "$skill_count" -gt 0 ]]; then
        pass "[$plugin_name] skills/ has $skill_count skill subdirectory(ies)"
      else
        fail "[$plugin_name] skills/ has no skill subdirectories"
      fi
    else
      fail "[$plugin_name] skills/ directory does not exist"
    fi

    if [[ -f "$plugin_dir/README.md" ]]; then
      pass "[$plugin_name] README.md exists"
    else
      fail "[$plugin_name] README.md does not exist"
    fi
  done
fi

# ============================================================
# Validate skills/ directory (standalone skills)
# ============================================================
if [[ -d "$SCRIPT_DIR/skills" ]]; then
  for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    [[ -d "$skill_dir" ]] || continue
    skill_dir="${skill_dir%/}"
    skill_name="$(basename "$skill_dir")"
    skill_md="$skill_dir/SKILL.md"

    if [[ -f "$skill_md" ]]; then
      pass "[standalone] $skill_name/SKILL.md exists"

      for fm_field in name description; do
        if has_yaml_frontmatter_field "$skill_md" "$fm_field"; then
          pass "[standalone] $skill_name/SKILL.md has '$fm_field' in frontmatter"
        else
          fail "[standalone] $skill_name/SKILL.md missing '$fm_field' in frontmatter"
        fi
      done

      name_value="$(get_yaml_field "$skill_md" "name")"
      if [[ -n "$name_value" && "$name_value" =~ ^[a-z][a-z0-9-]*$ ]]; then
        pass "[standalone] $skill_name/SKILL.md 'name' is valid (lowercase-hyphen)"
      else
        fail "[standalone] $skill_name/SKILL.md 'name' is not lowercase-hyphen format (got: '$name_value')"
      fi
    else
      fail "[standalone] $skill_name/SKILL.md does not exist"
    fi
  done
fi

# ============================================================
# Summary
# ============================================================
if [[ "$TOTAL" -eq 0 ]]; then
  echo ""
  echo "ERROR: No content found to validate."
  exit 1
fi

echo ""
echo "========================================="
echo "Validation complete: $TOTAL checks, $PASSED passed, $FAILED failed"
echo "========================================="

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
