/* PDF export abstraction. Today the only implementation is 'print', which
 * relies on the browser's native "Save as PDF" print dialog against a page
 * styled for print (see src/templates/harvard.css). If this proves too
 * limited, add a new strategy here (e.g. 'pdf-lib') and switch the registry
 * default below without touching any caller. */
(function (global) {
  "use strict";

  const strategies = {
    print: {
      async exportToPdf() {
        window.print();
      }
    }
  };

  let activeStrategyName = "print";

  function registerStrategy(name, strategy) {
    strategies[name] = strategy;
  }

  function setActiveStrategy(name) {
    if (!strategies[name]) throw new Error(getMessage("UnkwExportStrategy", [name]));
    activeStrategyName = name;
  }

  async function exportToPdf(options) {
    const strategy = strategies[activeStrategyName];
    return strategy.exportToPdf(options);
  }

  global.SkillExPdfExporter = {
    registerStrategy,
    setActiveStrategy,
    exportToPdf
  };
})(typeof window !== "undefined" ? window : self);
