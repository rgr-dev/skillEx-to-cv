# SkillEx to CV

> Firefox extension that automatically generates tailored CVs for any job posting, maximizing ATS (Applicant Tracking Systems) matching.

---

## What Does It Do?

When you're reading a job posting and select its text with your mouse, the extension:

1. **Automatically detects the language** of the job posting (Spanish, English, or Portuguese).
2. **Calls AI** (Anthropic Claude, OpenAI, or a compatible endpoint) with your master CV and the job description.
3. **Generates a tailored CV** in JSON and renders it in Harvard format with ATS-compatible typography.
4. **Analyzes the ATS match**: displays an alignment percentage, the skills that matched, and the skills missing from your profile.
5. **Detects the company and job title** from the posting and automatically suggests a PDF filename when exporting.
6. **Tracks job applications** in the browser's local, persistent history.
7. Allows you to generate a **Cover Letter** on demand, using a senior engineer's tone and avoiding AI clichés.

Everything runs **100% locally in your browser**, with no proprietary servers or external tracking. Your master CV and application history are stored in `browser.storage.local`.

---

## Features

| Feature | Description |
|---|---|
| Tailored CV Generation | AI reorders, selects, and rewrites skills to maximize ATS matching |
| ATS Match Score (%) | Alignment bar with a breakdown of matching and missing skills |
| Company and Role Detection | AI automatically extracts this information from the job posting |
| Smart PDF Filename | `CV_[Name]_[Role]_[Company].pdf` when exporting |
| Live CV Editing | `contenteditable` on text elements before printing |
| Quick-Add Skills | Adds missing skills to your master CV with one click and regenerates it |
| On-Demand Cover Letter | Cliché-free, editable cover letter that can be copied to the clipboard |
| Application History | Persistent records with metrics: total applications, companies, and average match score |
| Export to Excel (.csv) | Uses a UTF-8 BOM for direct opening in Microsoft Excel |
| Export to JSON | Portable backup of the complete history |
| Multi-Provider AI Support | Anthropic Claude, OpenAI GPT, or any compatible endpoint (Ollama, LiteLLM, Groq…) |
| Multilingual Support | Master CV in Spanish, English, and Portuguese |

---

## Project Structure

```
skillEx-to-cv/
├── manifest.json               # Extension configuration (WebExtension MV2)
├── icons/                      # Extension icons in various sizes
├── cv-master.es.md             # ⚠️ Master CV in Spanish (DO NOT commit, contains personal data)
├── cv-master.en.md             # ⚠️ Master CV in English (DO NOT commit, contains personal data)
├── cv-master.pt.md             # ⚠️ Master CV in Portuguese (DO NOT commit, contains personal data)
└── src/
    ├── background/
    │   └── background.js       # Background script: context menu and installation events
    ├── lib/
    │   ├── storage.js          # browser.storage.local abstraction (config, master CVs, history)
    │   ├── aiProviders.js      # API clients + prompts for CVs and cover letters
    │   ├── langDetect.js       # Heuristic language detection (es/en/pt)
    │   └── pdfExporter.js      # PDF export via window.print()
    ├── templates/
    │   ├── renderCv.js         # Renders CV JSON as Harvard-style HTML
    │   └── harvard.css         # CV styles (ATS-compatible: no problematic ligatures)
    ├── review/
    │   ├── review.html         # Generated CV review screen
    │   ├── review.js           # Review controller (generation, ATS panel, editing, cover letter)
    │   └── review.css          # Review interface styles
    └── options/
        ├── options.html        # Control panel (AI settings + history)
        ├── options.js          # Panel logic: tabs, history, CSV/JSON exports
        └── options.css         # Control panel styles
```
> You can add .md master cv files to .zip files (explained on next steps) at your risk if only you will use the extension, remember that these files has your personal information. From now I will mark with ⚠️ all section or commets that make sugestion around .md files
---

## What to Commit and What Not to Commit

### ✅ Commit to Version Control

- All source code (`src/`, `manifest.json`, `icons/`)
- **Example master CV template files** (with fictional or redacted data)
- `README.md`, `LICENSE`, `.gitignore`

### 🚫 DO NOT Commit (Configured in `.gitignore`)

| File | Reason |
|---|---|
| `cv-master.es.md` | Contains real personal data (name, email, phone number, work experience) |
| `cv-master.en.md` | Same as above |
| `cv-master.pt.md` | Same as above |
| `*.pdf` | Exported CVs containing personal data |
| `*.zip` / `*.xpi` | Automatically generated build artifacts |
| `.directory` | Internal KDE file manager metadata |

---

## Configuring Your Master CVs

Master CVs are Markdown files that the AI uses as its **single source of truth**. It will never invent information that is not included in them.

### Expected Format

```markdown
# FULL NAME

City, Country • email@example.com • +1 123-456-7890 • https://github.com/username

## Professional Summary

A brief 2–3-line paragraph describing your technical profile.

## Technical Skills

- **Back End**: Java, Spring Boot, Python (FastAPI), Node.js
- **Front End**: React, Angular, TypeScript
- **Databases**: PostgreSQL, MySQL, MongoDB
- **DevOps & Cloud**: Docker, Kubernetes, AWS, GCP
- **Artificial Intelligence (GenAI)**: LangChain, RAG, OpenAI API

## Professional Experience

### Example Company — City, Country
**Senior Backend Engineer** | 2022 - Present

- Achievement or responsibility bullet point 1.
- Achievement or responsibility bullet point 2.

**Technologies**: Java, Spring Boot, Docker, PostgreSQL, AWS

## Education

- Bachelor's Degree in Computer Science — Example University (2015–2019)
```

### Setup Steps

1. Open the extension and go to **"Control Panel"** → **"Settings"** → the **"Master CV by Language"** tab.
2. Select the language (ES / EN / PT).
3. Paste or edit your master CV directly in the text editor.
4. Click **"Save Master CV"**.
5. Repeat for each language you need.

Alternatively, you can upload a `.md` file from your computer using the file upload button.

---

## AI Provider Configuration

Go to **"Control Panel"** → **"Settings"** → **"AI Provider"**.

### Anthropic (Claude) — Recommended

```
Provider: Anthropic (Claude)
API Key:  sk-ant-api03-...
Model:    claude-sonnet-4-5  (or your preferred model)
```

Get your API key at: https://console.anthropic.com

### OpenAI (GPT)

```
Provider: OpenAI (GPT)
API Key:  sk-...
Model:    gpt-4o  (or gpt-4o-mini for lower costs)
```

Get your API key at: https://platform.openai.com

### Generic (OpenAI-Compatible)

Use local models (Ollama, vLLM) or alternative providers (Groq, LiteLLM, OpenRouter):

```
Provider: Generic (OpenAI-compatible endpoint)
API Key:  your-api-key (or any string if the endpoint does not require authentication)
Model:    model-name
Endpoint: http://localhost:11434/v1/chat/completions
```

---

## Local Installation (Development / Testing)

### Option A: Load as a Temporary Extension (Lost When Firefox Restarts)

> ⚠️ The `browser.storage.local` data of temporary extensions may be cleared when the browser restarts. Use this option **only for development and quick tests**.

1. Open Firefox and navigate to `about:debugging`.
2. Click **"This Firefox"** → **"Load Temporary Add-on"**.
3. Select the project's `manifest.json` file.
4. The extension remains active until you close Firefox.

### Option B: Firefox Developer Edition / Nightly (Persistent in Developer Mode)

1. Open `about:config` and set:

   ```
   xpinstall.signatures.required = false
   ```

2. Package the extension:

   ```bash
   cd skillEx-to-cv/
   zip -r skillEx-to-cv.zip . -x "*.git*" -x "*.gitignore" -x "cv-master.*.md" -x "*.pdf"
   ```
  > ⚠️ You can remove the file exclusion `-x "cv-master.*.md"` if you want

3. Drag the `.zip` file into Firefox or install it through `about:addons`.

---

## Mozilla Signing (Permanent Installation — Recommended)

This is the recommended option for **daily use**. It keeps the extension permanently installed and preserves all data in `browser.storage.local` across browser restarts.

1. Create a free account at [addons.mozilla.org](https://addons.mozilla.org).

2. Package the project into a `.zip` file:

   ```bash
   cd skillEx-to-cv/
   zip -r skillEx-to-cv.zip . \
     -x "*.git*" \
     -x ".gitignore" \
     -x "cv-master.es.md" \
     -x "cv-master.en.md" \
     -x "cv-master.pt.md" \
     -x "*.pdf" \
     -x "*.zip" \
     -x ".directory"
   ```
> ⚠️ You can remove the file exclusion `-x "cv-master.*.md"` if you want

3. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/):
   - Click **"Submit a New Add-on"**.
   - Choose **"On your own"** (do not list it publicly in the store).
   - Upload the `.zip` file.
   - Mozilla automatically validates it within minutes and provides a signed `.xpi` file.

4. Install the `.xpi` in your everyday Firefox browser by dragging it into the browser window.

> **Result:** The extension remains permanently installed. Your API key, master CVs, and application history persist in `browser.storage.local`, regardless of how many times you restart the browser.


> If you decide to exclude .md master CV files, you must configure them manually in the extension preferences "master CV" section" without master CV files loaded/configured, the extension doesn't work.

---

## Usage

1. Open a job portal (LinkedIn, InfoJobs, Glassdoor, etc.).
2. **Select the entire job posting text with your mouse** (description, requirements, tech stack, etc.).
3. **Right-click** → **"Generate CV with These Skills"**.
4. A new tab opens with:
   - The AI-generated tailored CV in Harvard format.
   - The **ATS panel**, displaying the match percentage, matching skills, and missing skills.
5. Available options:
   - **`Edit CV ✏️`**: Edit any text directly in the CV before exporting.
   - **`Cover Letter ✉️`**: Generate a tailored cover letter using a senior engineer's tone.
   - **`Regenerate`**: Generate a new version of the CV for the same job posting.
   - **`Export to PDF`**: Opens Firefox's native print dialog. Save the document as a PDF.
   - **`History`**: Opens the panel with your application history and metrics.

### Quick-Add job Skills

If the ATS panel shows skills in **red** (missing) that you **actually have but forgot to include in your master CV**:

1. Click the `+` button next to the skill.
2. Choose the target technical category.
3. Confirm → the skill is automatically added to your master CV.
4. Click **"Regenerate CV Now"** → the ATS score increases in the same session.

---

## Application History and Data Export

Access your history by clicking **"History"** in the top bar of the review screen, or by navigating to **"Control Panel"** → **"Application History"**.

You'll find:

- **Global Metrics**: Total applications, distinct companies, and average ATS match score.
- **History Table**: Date, company, job title, score, matching/missing skills, and status.
- **Export to Excel (.csv)**: A file with a UTF-8 BOM, ready to open directly in Microsoft Excel or LibreOffice Calc.
- **Export to JSON**: A complete, portable backup of your application history.

---

## License

This project is licensed under the [MIT License](LICENSE).
