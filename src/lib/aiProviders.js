/* AI provider abstraction. Each provider implements:
 *   async sendPrompt(config, systemPrompt, userPrompt) -> string (raw model text)
 * so the rest of the app never talks to a specific vendor API directly. */
(function (global) {
  "use strict";

  const i18n = typeof browser !== "undefined" ? browser.i18n : chrome.i18n;

  const CV_JSON_SCHEMA_DESCRIPTION = `
Return EXCLUSIVELY a JSON object (no extra text, no markdown, no backticks) with this exact structure:
{
  "metadata": {
    "company": string,
    "role": string
  },
  "atsMatch": {
    "score": number,
    "matchedSkills": string[],
    "missingSkills": string[]
  },
  "name": string,
  "contact": string,
  "summary": string,
  "skillsSections": [ { "label": string, "items": string[] } ],
  "experience": [
    {
      "company": string,
      "location": string,
      "role": string,
      "period": string,
      "bullets": string[],
      "technologies": string | null
    }
  ],
  "education": string[]
}`.trim();

  function buildPrompts(cvMasterMarkdown, jobPostingText, lang) {
    const langNames = {
      es: getMessage("langEs") || "Spanish",
      en: getMessage("langEn") || "English",
      pt: getMessage("langPt") || "Portuguese"
    };
    const langLabel = langNames[lang] || lang;

    const systemPrompt =
      "You are an expert assistant in optimizing CVs for Applicant Tracking Systems (ATS). " +
      "Your single source of truth for the CV is the provided MASTER_CV: you must never invent experience, companies, " +
      "job titles, dates, academic degrees, or skills that are not present in MASTER_CV. " +
      "Your task is to analyze the JOB_POSTING, extract the company and role, audit the technical match (ATS match), " +
      "and select, prioritize, reorder, and naturally write the skills and achievements from " +
      "MASTER_CV that best match the JOB_POSTING to maximize ATS keyword matching. " +
      "If a skill requested in the offer does not appear ANYWHERE in MASTER_CV (neither in the Technical Skills section nor in experience details), " +
      "add it to missingSkills and do NOT add it to the final CV. " +
      "The user typically possesses real skills they master but doesn't always detail explicitly inside every single past " +
      "experience bullet (to avoid making the CV endless); if a skill from JOB_POSTING appears in the " +
      "Technical Skills section of MASTER_CV, you MAY weave it into a new bullet under one of the " +
      "two most recent experiences, describing in a plausible and generic way how it was applied (e.g. 'Applied X for Y'), " +
      "BUT never invent numbers, percentages, impact metrics, or quantitative results that are not already present in MASTER_CV. " +
      "It is crucial to care for the Technical Skills section, as ATS rely heavily on it; if the job offer asks for " +
      "any technology present in the skills section of MASTER_CV or in work experiences, it is high priority " +
      "that you highlight it in the technical skills section of the generated CV.";

    const userPrompt = `
MASTER_CV (language: ${langLabel}):
"""
${cvMasterMarkdown}
"""

JOB_POSTING (text selected by user from job portal):
"""
${jobPostingText}
"""

Follow this process IN ORDER, methodically (do not skip or mentally summarize):

STEP 1 — Extract metadata and job offer checklist:
a) Identify the hiring company name (if unmentioned or confidential, use "${getMessage("promptConfidentialCompany") || "Confidential Company"}") and job title/role (e.g., "Senior Backend Developer"). Assign them to the "metadata" object.
b) Read JOB_POSTING and build an exhaustive internal list of EVERY technology, tool, language, framework, methodology, or technical concept mentioned (required or nice-to-have, doesn't matter). Do not stop at the 3-4 most obvious: if the offer mentions 15 technical terms, your checklist must have 15 items.

STEP 2 — Cross-check each checklist item against the ENTIRE MASTER_CV and calculate ATS Match:
For each item in the checklist, check if an exact or semantic match exists ANYWHERE in MASTER_CV: Technical Skills section, experience bullets, or "Technologies" lines. Be generous with semantic matching, not just exact text matches. Examples of valid semantic matching you MUST NOT miss:
   - "OAuth" in offer ↔ "OAuth2", "Keycloak (OAuth2)" in MASTER_CV.
   - "LLM integration in production", "prompt design", "structured outputs" in offer ↔ "RAG", "LangChain", "LangGraph", "Foundation Model Integration (OpenAI API)", "Agentic Systems Architecture" in MASTER_CV.
   - "AI-assisted development tools" in offer ↔ "GitHub Copilot", "Claude CLI", "Gemini CLI", "Opencode" in MASTER_CV.
   - "REST API integration" ↔ "RESTful", "Enterprise Integration Patterns (EIP)", "SOAP and RESTful".
   - "SQL" / "schema design" ↔ "PostgreSQL", "MySQL", "Oracle" and any bullet talking about databases or indexes.

Mark each checklist item as MATCH or NO-MATCH:
- Include in "atsMatch.matchedSkills" the list of all matching technologies and technical concepts.
- Include in "atsMatch.missingSkills" the list of required/desired technologies and concepts from the offer that DO NOT appear in MASTER_CV (gaps).
- Calculate "atsMatch.score": an integer between 0 and 100 representing the percentage of technical coverage or alignment with the offer achieved by the CV (100 = meets all offer requirements).

STEP 3 — Build the CV with ALL MATCHES, without exceptions:
Every item marked as MATCH in Step 2 must appear literally in the final CV (in "skillsSections" and/or in an experience bullet). Trimming matches to "prioritize the most important" is NOT optional: if there are 12 matches, all 12 must be present. You may only trim bullets NOT related to any match to keep the CV concise (see Instruction 7), never trim a confirmed match.

Additional instructions:
1. Write the complete result in ${langLabel}, the same language as MASTER_CV, taking special care not to mix languages.
2. Use only facts, companies, roles, dates, and skills that literally exist in MASTER_CV (either in Technical Skills or inside experience details). Never add to the CV content anything that resulted in NO-MATCH in Step 2 (it should only go into "atsMatch.missingSkills").
3. You may reorder bullets and rewrite phrasing to naturally incorporate key terms from the job offer.
4. FORBIDDEN to summarize or collapse specific skills into generic categories like "AI tools", "various technologies", "modern frameworks", etc. Each MATCH from Step 2 must appear with its literal name (e.g., "OpenAI API", "LangChain", "LangGraph", "Claude CLI", "RAG", "Keycloak (OAuth2)"), never replaced by an umbrella term. "skillsSections" must retain separate categories (Back End, Front End, Databases, DevOps & Cloud, AI, etc.) just like MASTER_CV, instead of flattening everything into a single generic "Technical Skills" list: each MASTER_CV category with at least one MATCH must be kept as its own section, listing ALL its MATCHES (not just 2 or 3 examples).
5. Distribution of MATCHES not appearing in any specific experience: if a Step 2 MATCH is in MASTER_CV Technical Skills but NOT in any experience bullets, add it spread out as a new bullet across the TWO most recent experiences (the first two in Experience list). Write each new bullet as a genuine, plausible application of that skill in that experience context (e.g., "Applied/Utilized [skill] for [reasonable task]"), WITHOUT inventing numbers, percentages, or impact metrics that do not already exist in MASTER_CV.
6. MANDATORY: the "experience" array in output JSON must include ALL companies/experiences appearing in MASTER_CV's Experience section, in the same order, without omitting any. Never remove an entire experience to "save space": instead, for less relevant experiences to JOB_POSTING, reduce non-matching bullets (1-2 generic bullets is fine) rather than dropping the whole company.
7. Keep the CV concise (equivalent to 1-2 pages) by trimming non-matching bullets, never trimming confirmed MATCHES or entire experiences.
8. ${CV_JSON_SCHEMA_DESCRIPTION}
`.trim();

    return { systemPrompt, userPrompt };
  }

  function extractJson(rawText) {
    const trimmed = rawText.trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error(getMessage("errInvalidJsonResponse") || "AI response does not contain valid JSON.");
    }
    const jsonSlice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSlice);
    } catch (err) {
      throw new Error(
        getMessage("errParseJson", [err.message]) ||
        `Could not parse JSON returned by AI (may be truncated due to token limit). Detail: ${err.message}`
      );
    }
  }

  async function sendPromptAnthropic(config, systemPrompt, userPrompt) {
    const model = config.model || "claude-sonnet-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const text = (data.content || []).map((block) => block.text || "").join("\n");
    return text;
  }

  async function sendPromptOpenAI(config, systemPrompt, userPrompt) {
    const model = config.model || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async function sendPromptGeneric(config, systemPrompt, userPrompt) {
    if (!config.endpoint) {
      throw new Error(getMessage("errMissingEndpoint") || "Please configure an endpoint for the generic provider in Options.");
    }
    const model = config.model || "";
    const res = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Generic provider error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || data.text || JSON.stringify(data);
  }

  const PROVIDERS = {
    anthropic: sendPromptAnthropic,
    openai: sendPromptOpenAI,
    generic: sendPromptGeneric
  };

  async function generateTailoredCv(config, cvMasterMarkdown, jobPostingText, lang) {
    const sender = PROVIDERS[config.provider];
    if (!sender) {
      throw new Error(getMessage("errUnknownProvider", [config.provider]) || `Unknown AI provider: ${config.provider}`);
    }
    if (!config.apiKey) {
      throw new Error(getMessage("errMissingApiKey") || "API key is missing in Options.");
    }

    const { systemPrompt, userPrompt } = buildPrompts(cvMasterMarkdown, jobPostingText, lang);
    const rawText = await sender(config, systemPrompt, userPrompt);
    return extractJson(rawText);
  }

  function buildCoverLetterPrompts(cvMasterMarkdown, jobPostingText, lang, metadata) {
    const langNames = {
      es: getMessage("langEs") || "Spanish",
      en: getMessage("langEn") || "English",
      pt: getMessage("langPt") || "Portuguese"
    };
    const langLabel = langNames[lang] || lang;

    const confidentialCo = getMessage("promptConfidentialCompany") || "Confidential Company";
    const unspecifiedCo = getMessage("promptUnspecified") || "Unspecified";
    const defaultCo = getMessage("promptDefaultCompany") || "the company";
    const defaultRole = getMessage("promptDefaultRole") || "the position";

    const company = metadata?.company && ![confidentialCo, unspecifiedCo, "Empresa Confidencial", "No especificada"].includes(metadata.company)
      ? metadata.company
      : defaultCo;
    const role = metadata?.role || defaultRole;

    const systemPrompt =
      `You are an expert writer of cover letters for senior software engineers and tech leads. ` +
      `Your goal is to write a direct, persuasive, and human text, from engineer to tech lead or engineering manager. ` +
      `CRITICAL STYLE RULES (ANTI-AI CLICHÉ FILTER): ` +
      `1. FORBIDDEN to use artificial or stiff formulas like "I hope this message finds you well", "I am writing with great enthusiasm", "To whom it may concern", "Dear hiring team", "Innovative/leading company", "Passionate about technology", etc. ` +
      `2. FORBIDDEN to summarize the resume chronologically. ` +
      `3. TONE: Confident, fluent, conversational yet formal, professional, and focused on pragmatic resolution of real technical challenges. ` +
      `4. STRUCTURE (maximum 220-280 words, 3 or 4 short paragraphs): ` +
      `   - Paragraph 1: Direct opening mentioning the role (${role}) at ${company} and what specific technical challenge or product/architecture aspect caught your attention. ` +
      `   - Paragraph 2: Genuine technical connection. Take the 2 biggest technical challenges from the offer and briefly explain how you successfully addressed them in real experiences from MASTER_CV (Spring Boot, microservices, generative AI, databases, cloud, etc.), without inventing false metrics. ` +
      `   - Paragraph 3: Why your profile and professional timing naturally fit the team's challenge. ` +
      `   - Paragraph 4 / Closing: A brief line inviting a technical conversation to delve deeper into how to contribute to the team, followed by a sober sign-off and the candidate's name. ` +
      `5. LANGUAGE: All text must be written 100% in ${langLabel}.`;

    const userPrompt = `
MASTER_CV:
"""
${cvMasterMarkdown}
"""

JOB_POSTING:
"""
${jobPostingText}
"""

Write the cover letter following system instructions.
Return EXCLUSIVELY a JSON object with this exact shape (no extra text or markdown code blocks):
{
  "coverLetter": string
}
`.trim();

    return { systemPrompt, userPrompt };
  }

  async function generateCoverLetter(config, cvMasterMarkdown, jobPostingText, lang, metadata) {
    const sender = PROVIDERS[config.provider];
    if (!sender) {
      throw new Error(getMessage("errUnknownProvider", [config.provider]) || `Unknown AI provider: ${config.provider}`);
    }
    if (!config.apiKey) {
      throw new Error(getMessage("errMissingApiKey") || "API key is missing in Options.");
    }

    const { systemPrompt, userPrompt } = buildCoverLetterPrompts(cvMasterMarkdown, jobPostingText, lang, metadata);
    const rawText = await sender(config, systemPrompt, userPrompt);
    const parsed = extractJson(rawText);
    return parsed.coverLetter || rawText;
  }

  global.SkillExAiProviders = {
    buildPrompts,
    buildCoverLetterPrompts,
    extractJson,
    generateTailoredCv,
    generateCoverLetter
  };
})(typeof window !== "undefined" ? window : self);
