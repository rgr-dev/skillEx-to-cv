/* AI provider abstraction. Each provider implements:
 *   async sendPrompt(config, systemPrompt, userPrompt) -> string (raw model text)
 * so the rest of the app never talks to a specific vendor API directly. */
(function (global) {
  "use strict";

  const CV_JSON_SCHEMA_DESCRIPTION = `
Devuelve EXCLUSIVAMENTE un objeto JSON (sin texto adicional, sin markdown, sin backticks) con esta forma exacta:
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
    const langNames = { es: "español", en: "English", pt: "português" };
    const langLabel = langNames[lang] || lang;

    const systemPrompt =
      "Eres un asistente experto en optimización de CVs para sistemas ATS (Applicant Tracking Systems). " +
      "Tu única fuente de verdad para el CV es el CV_MAESTRO proporcionado: nunca debes inventar experiencia, empresas, " +
      "cargos, fechas, títulos académicos ni habilidades que no estén presentes en el CV_MAESTRO. " +
      "Tu tarea es analizar la OFERTA_DE_TRABAJO, extraer la empresa y el cargo, auditar la coincidencia técnica (ATS match) " +
      "y seleccionar, priorizar, reordenar y redactar de forma natural las skills y logros del " +
      "CV_MAESTRO que mejor coincidan con la OFERTA_DE_TRABAJO, para maximizar el matching de palabras clave " +
      "de un ATS. Si una skill pedida en la oferta no aparece en NINGUNA parte del " +
      "CV_MAESTRO (ni en la sección de Habilidades Técnicas ni en el detalle de una experiencia), agrégala a missingSkills y NO la agregues al CV final. " +
      "El usuario suele tener skills reales que domina pero que no siempre detalla explícitamente dentro de cada " +
      "experiencia puntual (para no hacer el CV interminable); si una skill de la OFERTA_DE_TRABAJO aparece en la " +
      "sección de Habilidades Técnicas del CV_MAESTRO, SÍ puedes tejerla dentro de un bullet nuevo en una de las " +
      "dos experiencias más recientes, describiendo de forma plausible y genérica cómo se aplicó (p.ej. 'Apliqué X " +
      "para Y'), PERO nunca inventes cifras, porcentajes, métricas de impacto ni resultados cuantitativos que no " +
      "estén ya presentes en el CV_MAESTRO." +
      "Es importante cuidar la sección de Habilidades Técnicas / skills, ya que los ATS se apoyan mucho ahí, entonces " + 
      "si en la oferta piden alguna tecnología que está en la misma sección skills de CV_MAESTRO o en algunas de " +
      "las experiencias laborales, es prioritario que la resaltes en la sección habilidades técnicas del CV que vas a generar.";

    const userPrompt = `
CV_MAESTRO (idioma: ${langLabel}):
"""
${cvMasterMarkdown}
"""

OFERTA_DE_TRABAJO (texto seleccionado por el usuario en un portal de empleo):
"""
${jobPostingText}
"""

Sigue este proceso EN ORDEN, de forma metódica (no lo saltees ni lo resumas mentalmente):

PASO 1 — Extrae metadatos y el checklist de la oferta:
a) Identifica el nombre de la empresa contratante (si no se menciona o es confidencial, usa "Empresa Confidencial") y el título del puesto o rol (ej. "Senior Backend Developer"). Asígnalos al objeto "metadata".
b) Lee la OFERTA_DE_TRABAJO y arma internamente una lista exhaustiva de CADA tecnología, herramienta, lenguaje, framework, metodología o concepto técnico que menciona (requisito obligatorio o deseable, da igual). No te quedes solo con los 3-4 más obvios: si la oferta menciona 15 términos técnicos, tu checklist debe tener 15 items.

PASO 2 — Cruza cada item del checklist contra TODO el CV_MAESTRO y calcula el ATS Match:
Para cada item del checklist, busca si existe una coincidencia exacta o semántica en CUALQUIER parte del CV_MAESTRO: la sección de Habilidades Técnicas, los bullets de cada experiencia, o las líneas de "Tecnologías". Sé generoso con el matching semántico, no solo textual exacto. Ejemplos de matching semántico válido que NO debes pasar por alto:
   - "OAuth" en la oferta ↔ "OAuth2", "Keycloak (OAuth2)" en el CV_MAESTRO.
   - "LLM integration in production", "prompt design", "structured outputs" en la oferta ↔ "RAG", "LangChain", "LangGraph", "Integración de Modelos Fundacionales (OpenAI API)", "Arquitectura de Sistemas Agénticos" en el CV_MAESTRO.
   - "AI-assisted development tools" en la oferta ↔ "GitHub Copilot", "Claude CLI", "Gemini CLI", "Opencode" en el CV_MAESTRO.
   - "REST API integration" ↔ "RESTful", "Enterprise Integration Patterns (EIP)", "SOAP y RESTful".
   - "SQL" / "schema design" ↔ "PostgreSQL", "MySQL", "Oracle" y cualquier bullet que hable de bases de datos o índices.

Marca cada item del checklist como MATCH o NO-MATCH:
- Incluye en "atsMatch.matchedSkills" la lista de todas las tecnologías y conceptos técnicos que hicieron coincidencia.
- Incluye en "atsMatch.missingSkills" la lista de tecnologías y conceptos requeridos/deseados por la oferta que NO aparecen en el CV_MAESTRO (gaps).
- Calcula "atsMatch.score": un entero entre 0 y 100 que representa el porcentaje de alineación o cobertura técnica de la oferta alcanzado por el CV (100 = cumple todos los requisitos de la oferta).

PASO 3 — Construye el CV con TODOS los MATCH, sin excepciones:
Todo item marcado como MATCH en el Paso 2 tiene que aparecer literalmente en el CV final (en "skillsSections" y/o en algún bullet de experiencia). No es opcional recortar matches para "priorizar los más importantes": si hay 12 matches, los 12 deben estar presentes. Solo podés recortar bullets NO relacionados con ningún match para mantener el CV conciso (ver Instrucción 7), nunca recortar un match confirmado.

Instrucciones adicionales:
1. Escribe el resultado completo en ${langLabel}, el mismo idioma del CV_MAESTRO, ten especial cuidado de no mezclar idiomas.
2. Usa solo hechos, empresas, cargos, fechas y skills que existan literalmente en el CV_MAESTRO (ya sea en la sección de Habilidades Técnicas o en el detalle de alguna experiencia). Nunca agregues al contenido del CV algo que resultó NO-MATCH en el Paso 2 (solo debe ir en "atsMatch.missingSkills").
3. Puedes reordenar bullets y reescribir su redacción para incluir naturalmente las palabras clave de la oferta.
4. PROHIBIDO resumir o colapsar skills concretas en categorías genéricas como "AI tools", "herramientas de IA", "varias tecnologías", "frameworks modernos", etc. Cada MATCH del Paso 2 debe aparecer con su nombre literal (ej. "OpenAI API", "LangChain", "LangGraph", "Claude CLI", "RAG", "Keycloak (OAuth2)"), nunca reemplazado por un término paraguas. "skillsSections" debe conservar categorías separadas (Back End, Front End, Bases de Datos, DevOps & Cloud, IA, etc.) igual que el CV_MAESTRO, en vez de aplanar todo en una sola lista "Technical Skills" genérica: cada categoría del CV_MAESTRO que tenga al menos un MATCH debe conservarse como su propia sección, listando TODOS sus MATCH (no solo 2 o 3 de ejemplo).
5. Distribución de MATCH que no aparecen en ninguna experiencia puntual: si un MATCH del Paso 2 está en la sección de Habilidades Técnicas del CV_MAESTRO pero NO aparece en los bullets de ninguna experiencia, agrégalo repartido como bullet nuevo en las DOS experiencias más recientes (las dos primeras del listado de Experiencia). Redacta cada bullet nuevo como una aplicación genuina y plausible de esa skill en el contexto de esa experiencia (ej. "Apliqué/Utilicé [skill] para [tarea razonable]"), SIN inventar cifras, porcentajes ni métricas de impacto que no existan ya en el CV_MAESTRO.
6. OBLIGATORIO: el array "experience" del JSON de salida debe incluir TODAS las empresas/experiencias que aparecen en la sección de Experiencia del CV_MAESTRO, en el mismo orden, sin omitir ninguna. Nunca elimines una experiencia completa para "ahorrar espacio": en su lugar, para las experiencias menos relevantes a la OFERTA_DE_TRABAJO, reduce la cantidad de bullets NO relacionados con ningún MATCH (1-2 bullets genéricos está bien) en vez de quitar la empresa entera.
7. Mantén el CV conciso (equivalente a 1-2 páginas) recortando bullets sin match, nunca recortando MATCH confirmados ni experiencias completas.
8. ${CV_JSON_SCHEMA_DESCRIPTION}
`.trim();

    return { systemPrompt, userPrompt };
  }

  function extractJson(rawText) {
    const trimmed = rawText.trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new Error("La respuesta de la IA no contiene un JSON válido.");
    }
    const jsonSlice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSlice);
    } catch (err) {
      throw new Error(
        "No se pudo interpretar el JSON devuelto por la IA (puede estar truncado por límite de tokens). " +
          `Detalle: ${err.message}`
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
      throw new Error("Configura un endpoint para el proveedor genérico en Opciones.");
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
    // Best-effort: support OpenAI-compatible shape first, fall back to plain text field.
    return data.choices?.[0]?.message?.content || data.text || JSON.stringify(data);
  }

  const PROVIDERS = {
    anthropic: sendPromptAnthropic,
    openai: sendPromptOpenAI,
    generic: sendPromptGeneric
  };

  async function generateTailoredCv(config, cvMasterMarkdown, jobPostingText, lang) {
    const sender = PROVIDERS[config.provider];
    if (!sender) throw new Error(`Proveedor de IA desconocido: ${config.provider}`);
    if (!config.apiKey) throw new Error("Falta configurar el API key en Opciones.");

    const { systemPrompt, userPrompt } = buildPrompts(cvMasterMarkdown, jobPostingText, lang);
    const rawText = await sender(config, systemPrompt, userPrompt);
    return extractJson(rawText);
  }

  function buildCoverLetterPrompts(cvMasterMarkdown, jobPostingText, lang, metadata) {
    const langNames = { es: "español", en: "English", pt: "português" };
    const langLabel = langNames[lang] || lang;
    const company = metadata?.company && !["Empresa Confidencial", "No especificada"].includes(metadata.company)
      ? metadata.company
      : "la empresa";
    const role = metadata?.role || "la posición";

    const systemPrompt =
      `Eres un redactor experto en cartas de presentación (cover letters) para ingenieros de software senior y líderes técnicos. ` +
      `Tu objetivo es redactar un texto directo, persuasivo y humano, de ingeniero a líder técnico o engineering manager. ` +
      `REGLAS CRÍTICAS DE ESTILO (FILTRO ANTI-CLICHÉS DE IA): ` +
      `1. PROHIBIDO usar fórmulas artificiales o acartonadas como "Espero que este mensaje te encuentre bien", "Escribo con gran entusiasmo", "Me dirijo a ustedes", "Estimado equipo de contratación", "Empresa innovadora/líder", "Apasionado por la tecnología", etc. ` +
      `2. PROHIBIDO resumir el currículum de forma cronológica. ` +
      `3. TONO: Seguro, fluido, conversacional pero formal, profesional y centrado en la resolución pragmática de problemas técnicos reales. ` +
      `4. ESTRUCTURA (máximo 220-280 palabras, 3 o 4 párrafos cortos): ` +
      `   - Párrafo 1: Apertura directa mencionando el rol (${role}) en ${company} y qué reto técnico específico o aspecto del producto/arquitectura captó tu atención. ` +
      `   - Párrafo 2: Conexión técnica genuina. Toma los 2 mayores desafíos técnicos de la oferta y explica brevemente cómo los abordaste con éxito en experiencias reales de tu CV_MAESTRO (Spring Boot, microservicios, IA generativa, bases de datos, nube, etc.), sin inventar métricas falsas. ` +
      `   - Párrafo 3: Por qué tu perfil y momento profesional encajan de manera natural con el desafío del equipo. ` +
      `   - Párrafo 4 / Cierre: Una línea breve invitando a una conversación técnica para profundizar en cómo aportar al equipo, seguida de una despedida sobria y el nombre del candidato. ` +
      `5. IDIOMA: Todo el texto debe estar escrito 100% en ${langLabel}.`;

    const userPrompt = `
CV_MAESTRO:
"""
${cvMasterMarkdown}
"""

OFERTA_DE_TRABAJO:
"""
${jobPostingText}
"""

Redacta la carta de presentación siguiendo las instrucciones del sistema.
Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta (sin texto extra ni bloques de código markdown):
{
  "coverLetter": string
}
`.trim();

    return { systemPrompt, userPrompt };
  }

  async function generateCoverLetter(config, cvMasterMarkdown, jobPostingText, lang, metadata) {
    const sender = PROVIDERS[config.provider];
    if (!sender) throw new Error(`Proveedor de IA desconocido: ${config.provider}`);
    if (!config.apiKey) throw new Error("Falta configurar el API key en Opciones.");

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
