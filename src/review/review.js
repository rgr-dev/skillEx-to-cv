"use strict";

const statusEl = document.getElementById("status");
const errorBox = document.getElementById("error-box");
const cvContainer = document.getElementById("cv-container");
const jobPostingTextEl = document.getElementById("job-posting-text");
const langSelect = document.getElementById("lang-select");
const regenerateBtn = document.getElementById("regenerate-btn");
const exportBtn = document.getElementById("export-btn");
const historyBtn = document.getElementById("history-btn");
const editToggleBtn = document.getElementById("edit-toggle-btn");

const toastAlert = document.getElementById("toast-alert");
const toastMsg = document.getElementById("toast-msg");
const toastActionBtn = document.getElementById("toast-action-btn");
const toastCloseBtn = document.getElementById("toast-close-btn");

const quickAddModal = document.getElementById("quick-add-modal");
const modalSkillName = document.getElementById("modal-skill-name");
const modalSkillLang = document.getElementById("modal-skill-lang");
const modalCategorySelect = document.getElementById("modal-category-select");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");

const coverLetterBtn = document.getElementById("cover-letter-btn");
const coverLetterModal = document.getElementById("cover-letter-modal");
const clCloseBtn = document.getElementById("cl-close-btn");
const clCancelBtn = document.getElementById("cl-cancel-btn");
const clCopyBtn = document.getElementById("cl-copy-btn");
const clRegenerateBtn = document.getElementById("cl-regenerate-btn");
const clLoading = document.getElementById("cl-loading");
const clContentBox = document.getElementById("cl-content-box");
const clText = document.getElementById("cl-text");

const atsPanel = document.getElementById("ats-panel");
const atsCompany = document.getElementById("ats-company");
const atsRole = document.getElementById("ats-role");
const atsScoreBadge = document.getElementById("ats-score-badge");
const atsScoreNum = document.getElementById("ats-score-num");
const atsBarFill = document.getElementById("ats-bar-fill");
const atsSummaryCounts = document.getElementById("ats-summary-counts");
const matchedSkillsTags = document.getElementById("matched-skills-tags");
const missingSkillsTags = document.getElementById("missing-skills-tags");
const matchedCount = document.getElementById("matched-count");
const missingCount = document.getElementById("missing-count");

let currentJobText = "";
let currentLang = "es";
let currentSourceUrl = "";
let currentApplicationId = null;
let lastGeneratedData = null;
let isEditMode = false;
let pendingSkillToAdd = null;
let currentCoverLetter = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function showError(err) {
  console.error(err);
  errorBox.hidden = false;
  errorBox.textContent = err && err.message ? err.message : String(err);
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function countMasterExperiences(cvMasterMarkdown) {
  const matches = cvMasterMarkdown.match(/^###\s+/gm);
  return matches ? matches.length : 0;
}

function checkExperienceCompleteness(cvMasterMarkdown, data) {
  const expectedCount = countMasterExperiences(cvMasterMarkdown);
  const actualCount = (data.experience || []).length;
  if (expectedCount > 0 && actualCount < expectedCount) {
    showError(
      new Error(
        `Aviso: el CV maestro tiene ${expectedCount} experiencias, pero la IA solo devolvió ${actualCount}. ` +
          "Usa \"Regenerar\" o revisa el resultado antes de exportar."
      )
    );
  }
}

function updateDocumentTitle(data) {
  const rawName = data.name || "Roger_Moreno";
  const rawRole = data.metadata?.role || "Puesto";
  const rawCompany = data.metadata?.company || "";

  const sanitize = (str) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remover tildes para nombre de archivo limpio
      .replace(/[^a-zA-Z0-9_\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");

  const parts = ["CV", sanitize(rawName), sanitize(rawRole)];
  if (rawCompany && !["Empresa_Confidencial", "No_especificada", "Empresa"].includes(sanitize(rawCompany))) {
    parts.push(sanitize(rawCompany));
  }
  document.title = parts.filter(Boolean).join("_");
}

function renderAtsMatch(metadata, atsMatch) {
  if (!atsMatch && !metadata) {
    atsPanel.hidden = true;
    return;
  }

  // Metadatos
  atsCompany.textContent = metadata?.company || "Empresa";
  atsRole.textContent = metadata?.role || "Puesto solicitado";

  // Score y barra
  const rawScore = Number(atsMatch?.score);
  const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(100, Math.round(rawScore)));
  atsScoreNum.textContent = score;

  const levelClass = score >= 80 ? "high" : score >= 60 ? "medium" : "low";
  atsScoreBadge.className = `ats-score-badge ${levelClass}`;
  atsBarFill.className = `ats-bar-fill ${levelClass}`;
  atsBarFill.style.width = `${score}%`;

  // Listas de skills
  const matched = Array.isArray(atsMatch?.matchedSkills) ? atsMatch.matchedSkills : [];
  const missing = Array.isArray(atsMatch?.missingSkills) ? atsMatch.missingSkills : [];

  matchedCount.textContent = matched.length;
  missingCount.textContent = missing.length;
  atsSummaryCounts.textContent = `(${matched.length} coincidentes / ${missing.length} faltantes)`;

  matchedSkillsTags.innerHTML = matched.length
    ? matched.map((skill) => `<span class="ats-tag match">${escapeHtmlText(skill)}</span>`).join("")
    : '<span class="ats-empty-hint">No se detectaron coincidencias explícitas.</span>';

  missingSkillsTags.innerHTML = missing.length
    ? missing
        .map(
          (skill) => `
      <span class="ats-tag gap" data-skill="${escapeHtmlText(skill)}">
        ${escapeHtmlText(skill)}
        <button class="quick-add-tag-btn" data-skill="${escapeHtmlText(skill)}" title="Añadir '${escapeHtmlText(skill)}' a tu CV Maestro">+</button>
      </span>`
        )
        .join("")
    : '<span class="ats-empty-hint">¡Excelente! Tu CV cubre todos los requisitos mencionados.</span>';

  // Conectar botones de quick-add
  missingSkillsTags.querySelectorAll(".quick-add-tag-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const skill = e.currentTarget.dataset.skill;
      openQuickAddModal(skill);
    });
  });

  atsPanel.hidden = false;
}

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showToast(message, showAction = false, actionText = "Regenerar CV", onAction = null) {
  toastMsg.textContent = message;
  toastActionBtn.hidden = !showAction;
  if (showAction) {
    toastActionBtn.textContent = actionText;
    toastActionBtn.onclick = () => {
      hideToast();
      if (onAction) onAction();
    };
  }
  toastAlert.hidden = false;
}

function hideToast() {
  toastAlert.hidden = true;
}

if (toastCloseBtn) {
  toastCloseBtn.addEventListener("click", hideToast);
}

function updateEditModeUI() {
  cvContainer.classList.toggle("editing-mode", isEditMode);
  if (isEditMode) {
    editToggleBtn.classList.add("btn-active");
    editToggleBtn.textContent = "Modo Edición: Activo ✓";
    setCvContentEditable(true);
    showToast("Modo edición activo. Haz clic sobre cualquier parte del CV para modificarlo directamente antes de exportar.", false);
  } else {
    editToggleBtn.classList.remove("btn-active");
    editToggleBtn.textContent = "Editar CV ✏️";
    setCvContentEditable(false);
  }
}

function setCvContentEditable(editable) {
  const targets = cvContainer.querySelectorAll(
    ".cv-name, .cv-contact, .cv-summary, .cv-skills-line, .cv-entry-row span, .cv-bullets li, .cv-technologies, .cv-education-list li"
  );
  targets.forEach((el) => {
    el.contentEditable = editable ? "true" : "false";
    el.spellcheck = false;
  });
}

if (editToggleBtn) {
  editToggleBtn.addEventListener("click", () => {
    isEditMode = !isEditMode;
    updateEditModeUI();
  });
}

function extractMasterCategories(markdown) {
  const categories = [];
  const lines = markdown.split("\n");
  let inSkills = false;

  for (const line of lines) {
    if (/^##\s+(Habilidades|Technical Skills)/i.test(line)) {
      inSkills = true;
      continue;
    }
    if (inSkills && /^##\s+/.test(line)) {
      break;
    }
    if (inSkills) {
      const match = line.match(/^-\s+\*\*(.*?)\*\*:/);
      if (match && match[1]) {
        categories.push(match[1].trim());
      }
    }
  }

  if (categories.length === 0) {
    const fallback = markdown.match(/-\s+\*\*(.*?)\*\*:/g);
    if (fallback) {
      fallback.forEach((f) => {
        const cat = f.replace(/-\s+\*\*/, "").replace(/\*\*:/, "").trim();
        if (cat && !categories.includes(cat)) categories.push(cat);
      });
    }
  }

  return categories.length ? categories : ["Back End", "Front End", "Bases de Datos", "DevOps & Cloud", "Otras Habilidades"];
}

function addSkillToMasterMarkdown(markdown, category, skill) {
  const lines = markdown.split("\n");
  let targetFound = false;

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const updatedLines = lines.map((line) => {
    if (!targetFound) {
      const regex = new RegExp(`^-\\s+\\*\\*${escapeRegex(category)}\\*\\*:`, "i");
      if (regex.test(line)) {
        targetFound = true;
        if (!line.toLowerCase().includes(skill.toLowerCase())) {
          return `${line.trimEnd()}, ${skill}`;
        }
      }
    }
    return line;
  });

  if (!targetFound) {
    const skillsIdx = updatedLines.findIndex((l) => /^##\s+(Habilidades|Technical Skills)/i.test(l));
    if (skillsIdx >= 0) {
      updatedLines.splice(skillsIdx + 2, 0, `- **${category}**: ${skill}`);
    } else {
      updatedLines.push(`- **${category}**: ${skill}`);
    }
  }

  return updatedLines.join("\n");
}

async function openQuickAddModal(skill) {
  pendingSkillToAdd = skill;
  modalSkillName.textContent = `"${skill}"`;
  modalSkillLang.textContent = currentLang.toUpperCase();

  const cvMap = await SkillExStorage.getCvMarkdownMap();
  const cvMarkdown = cvMap[currentLang] || "";
  const categories = extractMasterCategories(cvMarkdown);

  modalCategorySelect.innerHTML = categories
    .map((cat) => `<option value="${escapeHtmlText(cat)}">${escapeHtmlText(cat)}</option>`)
    .join("");

  quickAddModal.hidden = false;
}

function closeQuickAddModal() {
  quickAddModal.hidden = true;
  pendingSkillToAdd = null;
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeQuickAddModal);
if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeQuickAddModal);

if (modalConfirmBtn) {
  modalConfirmBtn.addEventListener("click", async () => {
    if (!pendingSkillToAdd) return;
    const skill = pendingSkillToAdd;
    const category = modalCategorySelect.value;

    try {
      const cvMap = await SkillExStorage.getCvMarkdownMap();
      const currentMd = cvMap[currentLang] || "";
      const updatedMd = addSkillToMasterMarkdown(currentMd, category, skill);

      await SkillExStorage.setCvMarkdown(currentLang, updatedMd);
      closeQuickAddModal();

      showToast(
        `¡"${skill}" se añadió a "${category}" en tu CV Maestro (${currentLang.toUpperCase()})!`,
        true,
        "Regenerar CV ahora",
        () => runGeneration(currentLang)
      );
    } catch (err) {
      showError(err);
      closeQuickAddModal();
    }
  });
}

async function runGeneration(lang) {
  clearError();
  hideToast();
  regenerateBtn.disabled = true;
  exportBtn.disabled = true;
  cvContainer.innerHTML = "";
  atsPanel.hidden = true;
  atsBarFill.style.width = "0%";
  setStatus("Generando CV con IA…");

  try {
    const config = await SkillExStorage.getConfig();
    const cvMap = await SkillExStorage.getCvMarkdownMap();
    const cvMasterMarkdown = cvMap[lang];

    if (!cvMasterMarkdown) {
      throw new Error(
        `No hay un CV maestro configurado para el idioma "${lang}". Cárgalo en Opciones.`
      );
    }

    const data = await SkillExAiProviders.generateTailoredCv(
      config,
      cvMasterMarkdown,
      currentJobText,
      lang
    );

    cvContainer.innerHTML = SkillExRenderCv.renderCv(data, lang);
    if (isEditMode) {
      setCvContentEditable(true);
    }

    renderAtsMatch(data.metadata, data.atsMatch);
    updateDocumentTitle(data);

    lastGeneratedData = data;
    await saveApplicationRecord("Generado");

    setStatus("CV generado. Revisa el contenido antes de exportar.");
    exportBtn.disabled = false;
    checkExperienceCompleteness(cvMasterMarkdown, data);
  } catch (err) {
    setStatus("Ocurrió un error durante la generación.");
    showError(err);
  } finally {
    regenerateBtn.disabled = false;
  }
}

async function saveApplicationRecord(status = "Generado") {
  if (!lastGeneratedData) return;
  const rawScore = Number(lastGeneratedData.atsMatch?.score);
  const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(100, Math.round(rawScore)));

  try {
    const record = await SkillExStorage.saveApplication({
      id: currentApplicationId || undefined,
      company: lastGeneratedData.metadata?.company || "Empresa Confidencial",
      role: lastGeneratedData.metadata?.role || "Puesto solicitado",
      matchScore: score,
      matchedSkills: Array.isArray(lastGeneratedData.atsMatch?.matchedSkills)
        ? lastGeneratedData.atsMatch.matchedSkills
        : [],
      missingSkills: Array.isArray(lastGeneratedData.atsMatch?.missingSkills)
        ? lastGeneratedData.atsMatch.missingSkills
        : [],
      lang: currentLang,
      sourceUrl: currentSourceUrl,
      status
    });
    if (record && record.id) {
      currentApplicationId = record.id;
    }
  } catch (err) {
    console.error("Error guardando postulación en el historial:", err);
  }
}

async function init() {
  const pending = await SkillExStorage.getPendingSelection();
  if (!pending || !pending.text) {
    setStatus("No hay ninguna selección pendiente. Selecciona texto en la oferta y usa el menú contextual.");
    return;
  }

  currentJobText = pending.text;
  currentSourceUrl = pending.sourceUrl || "";
  jobPostingTextEl.textContent = pending.text;

  currentLang = SkillExLangDetect.detectLanguage(pending.text, SkillExStorage.SUPPORTED_LANGS);
  langSelect.value = currentLang;

  await runGeneration(currentLang);
}

langSelect.addEventListener("change", () => {
  currentLang = langSelect.value;
  currentCoverLetter = null;
});

regenerateBtn.addEventListener("click", () => runGeneration(currentLang));

exportBtn.addEventListener("click", async () => {
  await saveApplicationRecord("Exportado");
  SkillExPdfExporter.exportToPdf();
});

if (historyBtn) {
  historyBtn.addEventListener("click", () => {
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else {
      window.open(browser.runtime.getURL("src/options/options.html#history"));
    }
  });
}

// Funciones para Cover Letter (Carta de Presentación)
async function runCoverLetterGeneration() {
  clLoading.hidden = false;
  clContentBox.hidden = true;
  clRegenerateBtn.disabled = true;
  clCopyBtn.disabled = true;

  try {
    const config = await SkillExStorage.getConfig();
    const cvMap = await SkillExStorage.getCvMarkdownMap();
    const cvMasterMarkdown = cvMap[currentLang];

    if (!cvMasterMarkdown) {
      throw new Error(`No hay un CV maestro configurado para el idioma "${currentLang}". Cárgalo en Opciones.`);
    }

    const letter = await SkillExAiProviders.generateCoverLetter(
      config,
      cvMasterMarkdown,
      currentJobText,
      currentLang,
      lastGeneratedData?.metadata
    );

    currentCoverLetter = letter;
    clText.textContent = letter;
    clLoading.hidden = true;
    clContentBox.hidden = false;
  } catch (err) {
    clLoading.hidden = true;
    clContentBox.hidden = false;
    clText.textContent = `Error al generar la carta de presentación: ${err.message || String(err)}`;
  } finally {
    clRegenerateBtn.disabled = false;
    clCopyBtn.disabled = false;
  }
}

function openCoverLetterModal() {
  coverLetterModal.hidden = false;
  if (!currentCoverLetter) {
    runCoverLetterGeneration();
  }
}

function closeCoverLetterModal() {
  coverLetterModal.hidden = true;
}

if (coverLetterBtn) coverLetterBtn.addEventListener("click", openCoverLetterModal);
if (clCloseBtn) clCloseBtn.addEventListener("click", closeCoverLetterModal);
if (clCancelBtn) clCancelBtn.addEventListener("click", closeCoverLetterModal);
if (clRegenerateBtn) clRegenerateBtn.addEventListener("click", runCoverLetterGeneration);

if (clCopyBtn) {
  clCopyBtn.addEventListener("click", async () => {
    const textToCopy = clText.textContent || "";
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = clCopyBtn.textContent;
      clCopyBtn.textContent = "¡Copiado! ✓";
      clCopyBtn.classList.add("btn-copied");
      setTimeout(() => {
        clCopyBtn.textContent = originalText;
        clCopyBtn.classList.remove("btn-copied");
      }, 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  });
}

init();
