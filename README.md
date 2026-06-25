# Local Reversible Text Anonymizer

- Minimal client-side text anonymizer and de-anonymizer.
- Supports custom mappings and basic regex-based PII detection. 
- All processing stays in your browser.

User-defined mappings can be imported from JSON files shaped like:

```json
{
  "Original text": "[PLACEHOLDER_1]",
  "Another private value": "[CUSTOM_2]"
}
```

