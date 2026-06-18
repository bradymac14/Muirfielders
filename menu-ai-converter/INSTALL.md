# Convert Menu (AI) — install guide

An in-Sheet tool that uploads a menu file, converts it with Claude using your
GEM logic, and hands the JSON to your **existing** `processMenuJSON()` — so your
tabs, routing, and cloud integration are untouched. It replaces the manual
"drop into Gemini → copy JSON → paste back" round-trip.

> Test it on a **copy** of your template, not the production original.

---

## What's in this folder
- **`AIConvert.gs`** — the server code (menu call + Claude call + stub).
- **`ConvertSidebar.html`** — the in-Sheet sidebar (drag-and-drop upload + review + Build).
- **`INSTALL.md`** — this file.

---

## Step 1 — Add the two files to your Sheet's script
1. Open your (copied) Sheet → **Extensions → Apps Script**.
2. **Add a script file:** click **+ → Script**, name it `AIConvert`, and paste the
   contents of `AIConvert.gs`.
3. **Add an HTML file:** click **+ → HTML**, name it exactly **`ConvertSidebar`**
   (no `.html`), and paste the contents of `ConvertSidebar.html`.
4. Save.

## Step 2 — Add the menu item (edit your existing `onOpen`)
Your `Code.gs` already has an `onOpen()`. **Do not add a second one.** Replace it
with this version — it keeps all your existing items and adds the new one:

```javascript
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Menu Tools')
    .addItem('Convert Menu (AI)', 'showConvertSidebar')   // <-- new
    .addItem('Build Menu', 'showImportDialog')
    .addItem('Assign Taxes', 'showTaxDialog')
    .addSeparator()
    .addItem('QA Scorecard', 'openQAChecklist')
    .addToUi();
}
```
(Re-add your original emoji labels if you like — only the new `.addItem` line and
`showConvertSidebar` matter.)

## Step 3 — Test in STUB mode (no key needed)
1. Reload the Sheet. Open **Menu Tools → Convert Menu (AI)**.
2. Drag in any PDF/image, click **Convert**. With no API key set it returns a
   small **sample menu** and a note.
3. Click **Build Menu** → confirm items land in *Your Items / Your Menu Groups /
   Your Menus* exactly as a normal build. The first time, Google will ask you to
   **authorize** the script (it needs spreadsheet + external-request access).

This proves the upload → review → Build pipeline works before any AI/IT setup.

## Step 4 — Go live (real Claude conversion)
1. Get a key for the deployment IT approves:
   - **Anthropic API** (quick test): a key like `sk-ant-...`.
   - **Claude on Vertex AI** (in-tenant, the IT-preferred option): see "Vertex"
     below — you swap one function instead of using an `sk-ant-` key.
2. In Apps Script: **Project Settings (gear) → Script Properties → Add property**
   - Name: `ANTHROPIC_API_KEY`  Value: your key
3. Reload, open the sidebar, upload a real menu, **Convert**. It now calls Claude
   with your GEM logic and returns real JSON to review before you Build.

---

## Switching to Claude on Vertex AI (in-tenant)
Everything is isolated in **one function**: `callClaude_()` in `AIConvert.gs`.
To move the call inside your Google Cloud project, change only that function's
URL and auth header (Vertex uses an OAuth bearer token from a service account
via `ScriptApp.getOAuthToken()` / a Cloud project, not an `sk-ant-` key) and the
request shape Vertex expects. Nothing else in the tool changes. Confirm the exact
Vertex setup with IT, then update `callClaude_()` and `AI_API_URL`.

## Model & cost
- Default model is `claude-opus-4-8` (strongest). For faster/cheaper runs, set
  `AI_MODEL = 'claude-sonnet-4-6'` at the top of `AIConvert.gs`.
- Rough cost is cents per menu (see the cost notes in your manager email).

## Known limits (Apps Script)
- `UrlFetchApp` requests and script runs have time limits. **Very large menus**
  (many pages / hundreds of items) can approach those limits — if a big menu
  times out, split it, raise `AI_MAX_TOKENS`, or use `claude-sonnet-4-6` (faster).
- The tool converts **Block 1 (Menu Items)**, matching what `processMenuJSON`
  ingests today. Modifiers/taxes continue to use your existing tools.

---

## Next step — the learning loop (not yet wired)
The hook is already in place: `getCorrectionExamples_()` in `AIConvert.gs`
currently returns `""`. To make the tool improve from your team's corrections:
1. After a specialist finalizes a menu, capture the corrected JSON (the "good"
   version) — e.g. to a hidden tab or Script Properties.
2. Have `getCorrectionExamples_()` return a few recent, relevant corrected
   examples as few-shot text. They get appended to the system prompt, so the
   next conversion learns from them — no other code changes needed.
This is a deliberate, separate phase because it depends on how you want to
capture "final/approved" — happy to build it once that's decided.
