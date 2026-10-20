/* Renders the AI-produced CV JSON into HTML matching harvard.css. */
(function (global) {
  "use strict";

  /* All literal, human-facing labels used by the rendered CV document must
   * live here, keyed by language. Never hardcode a label string elsewhere in
   * this file — that's what caused labels to always render in Spanish
   * regardless of the CV's actual language. */
  const LABELS = {
    es: {
      skills: "Habilidades Técnicas",
      experience: "Experiencia",
      education: "Educación",
      technologies: "Tecnologías"
    },
    en: {
      skills: "Technical Skills",
      experience: "Experience",
      education: "Education",
      technologies: "Technologies"
    },
    pt: {
      skills: "Habilidades Técnicas",
      experience: "Experiência Profissional",
      education: "Educação",
      technologies: "Tecnologias"
    }
  };

  function getLabels(lang) {
    return LABELS[lang] || LABELS.es;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderSkillsSections(skillsSections) {
    return (skillsSections || [])
      .map(
        (section) => `
        <div class="cv-skills-line">
          <span class="cv-skills-label">${escapeHtml(section.label)}:</span>
          ${escapeHtml((section.items || []).join(", "))}
        </div>`
      )
      .join("");
  }

  function renderExperienceEntry(entry, labels) {
    const bullets = (entry.bullets || [])
      .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
      .join("");

    const technologies = entry.technologies
      ? `<div class="cv-technologies"><span class="label">${escapeHtml(labels.technologies)}:</span> ${escapeHtml(entry.technologies)}</div>`
      : "";

    return `
      <div class="cv-entry">
        <div class="cv-entry-row">
          <span class="left">${escapeHtml(entry.company || "")}</span>
          <span class="right">${escapeHtml(entry.location || "")}</span>
        </div>
        <div class="cv-entry-row">
          <span class="left">${escapeHtml(entry.role || "")}</span>
          <span class="right">${escapeHtml(entry.period || "")}</span>
        </div>
        <ul class="cv-bullets">${bullets}</ul>
        ${technologies}
      </div>`;
  }

  function renderCv(data, lang) {
    const labels = getLabels(lang);

    return `
      <div class="cv-page">
        <div class="cv-header">
          <p class="cv-name">${escapeHtml(data.name || "")}</p>
          <p class="cv-contact">${escapeHtml(data.contact || "")}</p>
        </div>
        <p class="cv-summary">${escapeHtml(data.summary || "")}</p>

        <div class="cv-section">
          <div class="cv-section-title">${escapeHtml(labels.skills)}</div>
          ${renderSkillsSections(data.skillsSections)}
        </div>

        <div class="cv-section">
          <div class="cv-section-title">${escapeHtml(labels.experience)}</div>
          ${(data.experience || []).map((entry) => renderExperienceEntry(entry, labels)).join("")}
        </div>

        <div class="cv-section">
          <div class="cv-section-title">${escapeHtml(labels.education)}</div>
          <ul class="cv-education-list">
            ${(data.education || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </div>
      </div>`;
  }

  global.SkillExRenderCv = { renderCv };
})(typeof window !== "undefined" ? window : self);
