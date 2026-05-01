# PanicBoard

PanicBoard turns scattered class information into a prioritized student work plan. It is built for the moment when a student has three syllabi, two LMS pages, and no clear answer to: “what should I do first?”

The app stays intentionally small: upload PDFs, paste a course URL or raw text, then get a `Today`, `This Week`, `Later`, and `No Date` board with a concrete 25-minute next action.

## What It Does

- Extracts assignments, exams, quizzes, readings, projects, discussions, and vague course obligations.
- Uses OpenAI for structured extraction.
- Requires `OPENAI_API_KEY` for extraction.
- Scores and buckets tasks deterministically, so prioritization does not depend only on the model.
- Saves editable tasks in `localStorage`; no login or database.
- Exports dated tasks as a lightweight `.ics` calendar file.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

OpenAI extraction:

```bash
OPENAI_API_KEY=your_key_here npm run dev
```

You can also set `OPENAI_MODEL`; otherwise the app uses `gpt-4o-mini`. Without `OPENAI_API_KEY`, the UI will show a configuration error instead of guessing.

## Demo Flow

1. Click `Run 30-second demo`.
2. Review `What should I do next?`.
3. Scan `Today`, `This Week`, `Later`, and `No Date`.
4. Edit, complete, delete, or export tasks from the board.

## Deploy

### Vercel

PanicBoard is a standard Next.js app and deploys cleanly on Vercel.

1. Push the project to GitHub, GitLab, or Bitbucket.
2. In Vercel, choose `Add New Project` and import the repo.
3. Keep the default framework preset: `Next.js`.
4. Build command: `npm run build`.
5. Install command: `npm install`.
6. Add `OPENAI_API_KEY` in `Settings > Environment Variables`.
7. Add `OPENAI_MODEL` only if you want to override the default `gpt-4o-mini`.
8. Deploy.

The app requires `OPENAI_API_KEY` for extraction.

### Netlify

Use the Next.js runtime/plugin through Netlify’s standard Next.js detection. Build command: `npm run build`.

## Known Limitations

- URL ingestion fetches a single readable page only; it does not crawl an LMS.
- Some scanned PDFs may have no embedded text and require OCR outside this MVP.
- Vague dates are preserved by the model and placed in `No Date`.
- Calendar export creates all-day due-date events, not full calendar integrations.
