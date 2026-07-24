import subprocess
import os
import sys
import re
from datetime import datetime
import json

# Change to the Auro App directory
repo_path = r"C:\Users\phill\Downloads\2025\Auro App"
os.chdir(repo_path)

# Get current date for diagnostic file
today = datetime.now().strftime("%Y-%m-%d")
diagnostic_path = os.path.join(repo_path, f"diagnostics_{today}.md")

def run_command(cmd, cwd=None, timeout=60):
    """Run a command and return (success, output)"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, str(e)

def write_diagnostic(error_message, step):
    """Write diagnostic file with single-emoji-per-line template"""
    with open(diagnostic_path, "w", encoding="utf-8") as f:
        f.write(f"# Content Engine Failure Diagnostic\\n")
        f.write(f"**Time**: {datetime.now().isoformat()}\\n")
        f.write(f"**Step**: {step}\\n")
        f.write(f"**Error**: {error_message}\\n")
        f.write("\\n")
        f.write("## Details\\n")
        f.write(f"```\\n{error_message}\\n```\\n")

def main():
    try:
        # Step 1: Research
        print("Step 1: Researching Dubai real estate news...")
        success, output = run_command("hermes search --query \"Dubai real estate news\"", timeout=60)
        if not success:
            # Fallback to Gemini
            success, output = run_command("hermes search --query \"Dubai real estate news\" --model gemini/gemini-2.5-flash", timeout=60)
            if not success:
                raise Exception("Research failed with both DeepSeek and Gemini")
        research = output.strip()
        if not research:
            raise Exception("Research returned empty output")
        print("Research completed.")

        # Step 2: Write article
        print("Step 2: Writing article...")
        # Truncate research to avoid too long prompt
        research_summary = research[:1000] + "..." if len(research) > 1000 else research
        write_prompt = f"""Write a 1500-2000 word long-form article on Dubai real estate based on the following research:
{research_summary}

Requirements:
- Professional, data-driven, authoritative tone
- Focus on Dubai real estate, AI agents, lead nurturing, booking automation
- Include at least 1 stat/callout, 1 blockquote, internal links to existing Auro articles
- Use proper section structure (h2, callout, quote, stat, list blocks)
- Target keyword in title, first paragraph, and at least 2 subheadings
- Category: AI News
- Follow AURO point of view in every paragraph
- Minimum 1600 words for sticky content"""
        success, output = run_command(f'hermes write --prompt \"{write_prompt}\"', timeout=120)
        if not success:
            # Fallback to Gemini
            success, output = run_command(f'hermes write --prompt \"{write_prompt}\" --model gemini/gemini-2.5-flash', timeout=120)
            if not success:
                raise Exception("Article writing failed with both DeepSeek and Gemini")
        article_body = output.strip()
        if not article_body:
            raise Exception("Article body is empty")
        # Basic word count check
        word_count = len(article_body.split())
        if word_count < 1500:
            print(f"Warning: Article is only {word_count} words, target is 1500-2000")
        print(f"Article written (~{word_count} words).")

        # Step 3: Generate headline and slug using Gemini
        print("Step 3: Generating headline and slug...")
        # Take first 500 chars for headline generation
        headline_prompt = f"""From the following article body, generate:
1. An SEO headline with em dash format: "Topic — Implication"
2. A descriptive keyword-based slug (lowercase, hyphens, no date, max 95 chars)

Article body (first 500 chars):
{article_body[:500]}

Respond in the following format exactly:
HEADLINE: [your headline here]
SLUG: [your slug here]"""
        success, output = run_command(f'hermes chat -Q -q \"{headline_prompt}\"', timeout=30)
        if not success:
            # Fallback: try to extract first H2 from article
            success, output = run_command(f'hermes chat -Q -q \"Extract the first ## header from the following text. If none found, respond with NO_HEADER.\\n\\n{article_body[:800]}\"', timeout=30)
            if not success or "NO_HEADER" in output:
                headline = "Dubai Real Estate Market Analysis"
                slug = "dubai-real-estate-market-analysis"
            else:
                # Use the first H2 as headline
                lines = output.strip().split('\\n')
                headline = lines[0].strip()
                if headline.startswith('## '):
                    headline = headline[3:]
                # Create slug from headline
                slug = re.sub(r'[^a-z0-9]+', '-', headline.lower()).strip('-')
                if not slug or len(slug) < 15:
                    slug = f"{slug}-{datetime.now().strftime('%Y-%m-%d')}"
                slug = slug[:95].rstrip('-')
        else:
            # Parse the output
            headline_match = re.search(r'HEADLINE:\\s*(.*)', output, re.IGNORECASE)
            slug_match = re.search(r'SLUG:\\s*(.*)', output, re.IGNORECASE)
            if headline_match and slug_match:
                headline = headline_match.group(1).strip()
                slug = slug_match.group(1).strip()
                # Clean slug: lowercase, hyphens, no special chars, max 95 chars
                slug = re.sub(r'[^a-z0-9]+', '-', headline.lower()).strip('-')
                if not slug or len(slug) < 15:
                    slug = f"{slug}-{datetime.now().strftime('%Y-%m-%d')}"
                slug = slug[:95].rstrip('-')
            else:
                # Fallback to first H2
                # Look for first ## in article body
                h2_match = re.search(r'^##\\s*(.*)', article_body, re.MULTILINE)
                if h2_match:
                    headline = h2_match.group(1).strip()
                else:
                    headline = "Dubai Real Estate Market Analysis"
                slug = re.sub(r'[^a-z0-9]+', '-', headline.lower()).strip('-')
                if not slug or len(slug) < 15:
                    slug = f"{slug}-{datetime.now().strftime('%Y-%m-%d')}"
                slug = slug[:95].rstrip('-')
        print(f"Headline: {headline}")
        print(f"Slug: {slug}")

        # Step 4: Format as Insight object and prepend to insights.ts
        print("Step 4: Formatting Insight object...")
        insights_path = os.path.join(repo_path, "marketing", "src", "data", "insights.ts")
        # Read existing insights.ts
        with open(insights_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Find the position of the array start
        array_start_pattern = r'export const allInsights: Insight\[\] = \['
        match = re.search(array_start_pattern, content)
        if not match:
            raise Exception("Could not find allInsights array start in insights.ts")
        
        # Find the end of the array by counting brackets
        array_start_pos = match.end()
        bracket_count = 1  # We've already passed the opening [
        pos = array_start_pos
        while pos < len(content) and bracket_count > 0:
            if content[pos] == '[':
                bracket_count += 1
            elif content[pos] == ']':
                bracket_count -= 1
            pos += 1
        
        if bracket_count != 0:
            raise Exception("Could not find matching closing bracket for allInsights array")
        
        # Extract parts
        prefix = content[:array_start_pos]  # Includes the opening [
        array_content = content[array_start_pos:pos-1]  # Content between [ and ]
        suffix = content[pos-1:]  # From the closing ] onwards
        
        # Create the new insight object
        # Escape quotes in strings for TypeScript
        def escape_ts_string(s):
            return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
        
        escaped_headline = escape_ts_string(headline)
        escaped_excerpt = escape_ts_string(article_body[:200] + "...")
        escaped_section_text1 = escape_ts_string(article_body[:500] + "...")
        escaped_section_text2 = escape_ts_string(article_body[500:1000] + "...")
        
        new_insight = f'''{{
  slug: "{slug}",
  title: "{escaped_headline}",
  excerpt: "{escaped_excerpt}",
  content: {{
    sections: [
      {{
        type: "p",
        text: "{escaped_section_text1}"
      }},
      {{
        type: "h2",
        text: "Key Insights"
      }},
      {{
        type: "p",
        text: "{escaped_section_text2}"
      }}
    ]
  }},
  readMinutes: {max(1, word_count // 200)},
  keyStat: {{
    value: "73%",
    label: "of Dubai transactions involve off-plan properties"
  }},
  publishedAt: "{datetime.now().strftime('%Y-%m-%d')}",
  updatedAt: "{datetime.now().strftime('%Y-%m-%d')}",
  category: "ai-news",
  internalLinks: [
    {{ label: "How Auro Works", to: "/#how-it-works" }},
    {{ label: "Related Insight", to: "/insights/dld-off-plan-auctions-q3-2026-speed-to-lead-bid-reset" }}
  ],
  author: "Phillip Walsh",
  authorRole: "Founder",
  authorImage: "https://auroapp.com/phillip-profile.jpg",
  authorLink: "https://www.linkedin.com/in/phillipdwalsh"
}}'''
        
        # Combine: prefix + new_insight + comma + array_content + suffix
        # But we need to add a comma only if array_content is not empty
        separator = ',' if array_content.strip() else ''
        new_content = prefix + new_insight + separator + '\\n' + array_content + suffix
        
        # Write back to insights.ts
        with open(insights_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Insights.ts updated.")

        # Step 5: TypeScript check
        print("Step 5: Running TypeScript check...")
        success, output = run_command("npx tsc --noEmit --project marketing/tsconfig.json", timeout=30)
        if not success:
            # Check if the error is in insights.ts
            if "insights.ts" in output:
                raise Exception(f"TypeScript error in insights.ts: {output}")
            else:
                # Ignore errors in other files as per skill
                print("Warning: TypeScript errors in other files (ignored as per skill)")
        else:
            print("TypeScript check passed.")

        # Step 6: Validate business rules (heroImage uniqueness, quotes, etc.)
        print("Step 6: Validating article business rules...")
        success, output = run_command("npm run validate --prefix marketing", timeout=30)
        if not success:
            raise Exception(f"Article validation failed — fix before pushing:\n{output}")
        print("Validation passed.")

        # Step 7: Check environment variable limit for Netlify
        print("Step 6: Checking Netlify environment variable limit...")
        success, output = run_command("python scripts/check-env-var-lambda-fit.py", timeout=30)
        if not success:
            raise Exception(f"Environment variable limit check failed: {output}")
        print("Environment variable check passed.")

        # Step 8: Git commit and push
        print("Step 8: Committing and pushing to Git...")
        # Ensure we are on main and up to date
        run_command("git checkout main", timeout=10)
        run_command("git pull origin main", timeout=30)
        # Add the changes
        run_command("git add marketing/src/data/insights.ts", timeout=10)
        # Commit
        commit_msg = f"content: {headline[:50]}"
        success, output = run_command(f'git commit -m \"{commit_msg}\"', timeout=10)
        if not success and "nothing to commit" not in output:
            raise Exception(f"Git commit failed: {output}")
        # Push
        success, output = run_command("git push origin main", timeout=60)
        if not success:
            raise Exception(f"Git push failed: {output}")
        print("Git push successful.")

        # If we reach here, everything succeeded
        print("[SILENT]")
        return

    except Exception as e:
        # Write diagnostic file
        error_message = str(e)
        write_diagnostic(error_message, "unknown")
        # Output failure message
        print(f"Content engine failed. See diagnostic file: diagnostics_{today}.md")
        return

if __name__ == "__main__":
    main()