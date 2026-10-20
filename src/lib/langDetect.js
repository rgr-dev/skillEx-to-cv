/* Very small heuristic language detector for es/en/pt, good enough to pick
 * which master CV markdown to use for a pasted job posting. Not meant to be
 * a general-purpose language detector. */
(function (global) {
  "use strict";

  const STOPWORDS = {
    es: [
      "que", "para", "con", "los", "las", "una", "por", "del", "se ", "más",
      "trabajo", "experiencia", "requisitos", "conocimientos", "empresa",
      "años", "buscamos", "habilidades", "deseable", "responsabilidades"
    ],
    en: [
      "the", "and", "with", "for", "you", "our", "are", "years",
      "experience", "requirements", "responsibilities", "skills", "we are",
      "looking for", "must have", "nice to have"
    ],
    pt: [
      "que", "para", "com", "uma", "por", "dos", "das", "não", "mais",
      "trabalho", "experiência", "requisitos", "conhecimentos", "empresa",
      "anos", "procuramos", "habilidades", "desejável", "responsabilidades"
    ]
  };

  function detectLanguage(text, supportedLangs) {
    const normalized = ` ${text.toLowerCase()} `;
    const scores = {};

    for (const lang of supportedLangs) {
      const words = STOPWORDS[lang] || [];
      scores[lang] = words.reduce((acc, word) => {
        const occurrences = normalized.split(word).length - 1;
        return acc + occurrences;
      }, 0);
    }

    let best = supportedLangs[0];
    let bestScore = -1;
    for (const lang of supportedLangs) {
      if (scores[lang] > bestScore) {
        bestScore = scores[lang];
        best = lang;
      }
    }

    // If nothing matched meaningfully, default to Spanish.
    if (bestScore <= 0) return supportedLangs.includes("es") ? "es" : best;
    return best;
  }

  global.SkillExLangDetect = { detectLanguage };
})(typeof window !== "undefined" ? window : self);
