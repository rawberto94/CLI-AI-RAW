# TCV golden PDFs

Drop labeled PDFs here with a sibling `<name>.expected.json`:

```json
{
  "totalValue": 1200000,
  "currency": "CHF",
  "text": "optional packed text used until a PDF extractor is wired"
}
```

If this folder has no PDFs, CI skips the PDF harness and stays green.
