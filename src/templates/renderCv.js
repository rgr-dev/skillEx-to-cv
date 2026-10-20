/* Renders the AI-produced CV JSON into HTML matching harvard.css. */
(function (global) {
  "use strict";

  const i18n = typeof browser !== "undefined" ? browser.i18n : (typeof chrome !== "undefined" ? chrome.i18n : null);

  function getMsg(key) {
    if (typeof getMessage === "function") {
      const res = getMessage(key);
      if (res && res !== key) return res;
    }
    if (i18n && typeof i18n.getMessage === "function") {
      const res = i18n.getMessage(key);
      if (res) return res;
    }
    return "";
  }

  /* Tabla de respaldo (fallback) con etiquetas según el idioma del CV */
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
    const targetLang = (lang || "es").toLowerCase();
    const fallback = LABELS[targetLang] || LABELS.es;

    return {
      skills: getMsg(`cvLabelSkills_${targetLang}`) || fallback.skills,
      experience: getMsg(`cvLabelExperience_${targetLang}`) || fallback.experience,
      education: getMsg(`cvLabelEducation_${targetLang}`) || fallback.education,
      technologies: getMsg(`cvLabelTechnologies_${targetLang}`) || fallback.technologies
    };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
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
