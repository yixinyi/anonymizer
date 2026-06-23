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

User-defined mappings can be imported from JSON files shaped like:

```json
{
  "Original text": "[PLACEHOLDER_1]",
  "Another private value": "[CUSTOM_2]"
}
```

The repository includes `my-mapping.json` as an example import file.
Mapping JSON downloaded from the anonymized result can also be imported for reuse.

You can extend `src/anon.js` programmatically since it exports the main actions.
