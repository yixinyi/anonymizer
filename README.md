# Local Reversible Text Anonymizer

Minimal, client-side text anonymizer. All processing occurs in the browser.

Quick start:

1. Serve the folder (static file server). Example using Python 3:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Files of interest:
- `index.html` — minimal front-end shell
- `src/anon.js` — application logic (ES module)
- `src/styles.css` — minimal styles

You can extend `src/anon.js` programmatically since it exports the main actions.
