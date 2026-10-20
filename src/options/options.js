"use strict";

const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const modelInput = document.getElementById("model");
const endpointInput = document.getElementById("endpoint");
const endpointField = document.getElementById("endpoint-field");
const aiConfigForm = document.getElementById("ai-config-form");
const configSavedMsg = document.getElementById("config-saved-msg");

const langTabs = Array.from(document.querySelectorAll(".lang-tab"));
const mdEditor = document.getElementById("md-editor");
const mdFileInput = document.getElementById("md-file-input");
const saveMdBtn = document.getElementById("save-md-btn");
const resetMdBtn = document.getElementById("reset-md-btn");
const mdSavedMsg = document.getElementById("md-saved-msg");

let activeLang = "es";

function flashSaved(el) {
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 1800);
}

function toggleEndpointField() {
  endpointField.style.display = providerSelect.value === "generic" ? "block" : "none";
}

async function loadConfig() {
  const config = await SkillExStorage.getConfig();
  providerSelect.value = config.provider;
  apiKeyInput.value = config.apiKey || "";
  modelInput.value = config.model || "";
  endpointInput.value = config.endpoint || "";
  toggleEndpointField();
}

providerSelect.addEventListener("change", toggleEndpointField);

aiConfigForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await SkillExStorage.setConfig({
    provider: providerSelect.value,
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim(),
    endpoint: endpointInput.value.trim()
  });
  flashSaved(configSavedMsg);
});

async function loadMdForActiveLang() {
  const map = await SkillExStorage.getCvMarkdownMap();
  mdEditor.value = map[activeLang] || "";
}

async function selectLang(lang) {
  activeLang = lang;
  langTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.lang === lang));
  await loadMdForActiveLang();
}

langTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectLang(tab.dataset.lang));
});

mdFileInput.addEventListener("change", async () => {
  const file = mdFileInput.files[0];
  if (!file) return;
  const text = await file.text();
  mdEditor.value = text;
  mdFileInput.value = "";
});

saveMdBtn.addEventListener("click", async () => {
  await SkillExStorage.setCvMarkdown(activeLang, mdEditor.value);
  flashSaved(mdSavedMsg);
});

resetMdBtn.addEventListener("click", async () => {
  const url = browser.runtime.getURL(`cv-master.${activeLang}.md`);
  const res = await fetch(url);
  const defaultText = await res.text();
  mdEditor.value = defaultText;
  await SkillExStorage.setCvMarkdown(activeLang, defaultText);
  flashSaved(mdSavedMsg);
});

// Elementos de la barra principal de pestañas
const mainTabs = Array.from(document.querySelectorAll(".main-tab"));
const panelConfig = document.getElementById("panel-config");
const panelHistory = document.getElementById("panel-history");
const tabHistoryCount = document.getElementById("tab-history-count");

// Elementos de métricas e historial
const metricTotal = document.getElementById("metric-total");
const metricCompanies = document.getElementById("metric-companies");
const metricAvgScore = document.getElementById("metric-avg-score");
const historyTbody = document.getElementById("history-tbody");
const historyEmpty = document.getElementById("history-empty");
const exportCsvBtn = document.getElementById("export-csv-btn");
const exportJsonBtn = document.getElementById("export-json-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");

function switchMainTab(targetId) {
  mainTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.target === targetId);
  });
  panelConfig.hidden = targetId !== "panel-config";
  panelHistory.hidden = targetId !== "panel-history";

  if (targetId === "panel-history") {
    loadHistoryDashboard();
  }
}

mainTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchMainTab(tab.dataset.target));
});

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(isoString) {
  if (!isoString) return "-";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadHistoryDashboard() {
  const history = await SkillExStorage.getApplicationsHistory();
  tabHistoryCount.textContent = history.length;
  metricTotal.textContent = history.length;

  const companiesSet = new Set(
    history
      .map((item) => (item.company || "").trim().toLowerCase())
      .filter((c) => c && !["empresa confidencial", "no especificada", "empresa"].includes(c))
  );
  metricCompanies.textContent = companiesSet.size;

  if (history.length === 0) {
    metricAvgScore.textContent = "0%";
    historyTbody.innerHTML = "";
    historyEmpty.hidden = false;
    return;
  }

  historyEmpty.hidden = true;
  const totalScore = history.reduce((acc, item) => acc + (Number(item.matchScore) || 0), 0);
  metricAvgScore.textContent = `${Math.round(totalScore / history.length)}%`;

  historyTbody.innerHTML = history
    .map((item) => {
      const score = Number(item.matchScore) || 0;
      const levelClass = score >= 80 ? "high" : score >= 60 ? "medium" : "low";
      const statusClass = (item.status || "").toLowerCase() === "exportado" ? "exportado" : "";

      const matchedList = Array.isArray(item.matchedSkills) ? item.matchedSkills : [];
      const missingList = Array.isArray(item.missingSkills) ? item.missingSkills : [];
      const skillsTooltip = `Coincidentes: ${matchedList.join(", ") || "Ninguna"}\nFaltantes: ${missingList.join(", ") || "Ninguna"}`;

      const linkBtn = item.sourceUrl
        ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn-link" title="Abrir oferta original">Oferta ↗</a>`
        : "";

      return `
        <tr data-id="${escapeHtml(item.id)}">
          <td>${escapeHtml(formatDate(item.createdAt))}</td>
          <td><strong>${escapeHtml(item.company || "Empresa")}</strong></td>
          <td>${escapeHtml(item.role || "-")}</td>
          <td><span class="score-badge ${levelClass}">${score}%</span></td>
          <td>
            <span class="skills-summary-pill" title="${escapeHtml(skillsTooltip)}">
              ${matchedList.length} match / ${missingList.length} gaps
            </span>
          </td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(item.status || "Generado")}</span></td>
          <td>
            ${linkBtn}
            <button class="btn-icon-danger delete-app-btn" data-id="${escapeHtml(item.id)}" title="Eliminar registro">✕</button>
          </td>
        </tr>`;
    })
    .join("");

  // Conectar botones de eliminar individuales
  document.querySelectorAll(".delete-app-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm("¿Deseas eliminar esta postulación del historial?")) {
        await SkillExStorage.deleteApplication(id);
        await loadHistoryDashboard();
      }
    });
  });
}

function getISODate() {
  return new Date().toISOString().split("T")[0];
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

exportCsvBtn.addEventListener("click", async () => {
  const history = await SkillExStorage.getApplicationsHistory();
  if (history.length === 0) {
    alert("No hay registros en el historial para exportar.");
    return;
  }

  // BOM UTF-8 (\uFEFF) para que Excel reconozca tildes y caracteres internacionales
  const BOM = "\uFEFF";
  const delimiter = ";"; // Punto y coma para compatibilidad directa con Excel

  const headers = [
    "Fecha",
    "Empresa",
    "Puesto",
    "Score ATS (%)",
    "Skills Coincidentes",
    "Skills Faltantes",
    "Idioma",
    "Estado",
    "URL Oferta"
  ];

  const escapeCsv = (val) => {
    const s = String(val == null ? "" : val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = history.map((item) => {
    const dateStr = item.createdAt ? formatDate(item.createdAt) : "";
    const matched = Array.isArray(item.matchedSkills) ? item.matchedSkills.join(", ") : "";
    const missing = Array.isArray(item.missingSkills) ? item.missingSkills.join(", ") : "";
    return [
      escapeCsv(dateStr),
      escapeCsv(item.company || ""),
      escapeCsv(item.role || ""),
      escapeCsv(item.matchScore != null ? item.matchScore : ""),
      escapeCsv(matched),
      escapeCsv(missing),
      escapeCsv(item.lang || ""),
      escapeCsv(item.status || ""),
      escapeCsv(item.sourceUrl || "")
    ].join(delimiter);
  });

  const csvContent = BOM + [headers.map(escapeCsv).join(delimiter), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `postulaciones_skillex_${getISODate()}.csv`);
});

exportJsonBtn.addEventListener("click", async () => {
  const history = await SkillExStorage.getApplicationsHistory();
  if (history.length === 0) {
    alert("No hay registros en el historial para exportar.");
    return;
  }
  const jsonContent = JSON.stringify(history, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
  downloadBlob(blob, `postulaciones_skillex_${getISODate()}.json`);
});

clearHistoryBtn.addEventListener("click", async () => {
  if (confirm("¿Estás seguro de que deseas vaciar TODO el historial de postulaciones? Esta acción no se puede deshacer.")) {
    await SkillExStorage.clearApplicationsHistory();
    await loadHistoryDashboard();
  }
});

(async function init() {
  await SkillExStorage.ensureDefaultCvMarkdownSeeded();
  await loadConfig();
  await selectLang(activeLang);

  // Inicializar conteo del historial
  const history = await SkillExStorage.getApplicationsHistory();
  tabHistoryCount.textContent = history.length;

  // Si se abre con hash #history, mostrar directamente la pestaña de historial
  if (window.location.hash === "#history") {
    switchMainTab("panel-history");
  }
})();
