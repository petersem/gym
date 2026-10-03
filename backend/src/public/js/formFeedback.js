/* global window, document, requestAnimationFrame */

/**
 * Brings the validation summary into view after an invalid form submission.
 *
 * Loaded only when the page has errors. Runs on `pageshow` so it also works when
 * the page comes from the back/forward cache, and waits a frame so the layout is
 * final. A URL fragment alone does not scroll reliably after a 303 redirect.
 * Focusing the summary also lets screen readers announce it.
 */
window.addEventListener("pageshow", () => {
  const summary = document.getElementById("form-validation");
  if (summary) {
    requestAnimationFrame(() => {
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
});
