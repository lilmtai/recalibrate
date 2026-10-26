# Recalibrate

A calm ADHD planner for high achievers. Plan your day on a visual timeline, log why a block didn't happen, and turn each reason into an if-then fix that shows up as a prep cue next time.

## Run it locally

It's a single file with no build step.

- Quickest: double-click `index.html` to open it in your browser.
- Or serve it (recommended, closer to how it runs online):

```bash
npx serve .
# then open http://localhost:3000
```

## Where data is saved

Outside Claude, everything is saved in your browser (localStorage). It stays on that one browser and device. Clearing site data erases it.

The AI coach buttons only appear when the page runs inside Claude. Running the coach elsewhere needs a small backend that calls the Claude API (see "Next steps").

## Publish it with GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo: Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/ (root)`.
3. After a minute your planner is live at `https://<your-username>.github.io/<repo-name>/`.

## Next steps

- Repeating routines, a focus timer and a weekly planning view.
- Accounts and sync across devices (for example Supabase or Firebase).
- Real reminders: make it an installable PWA with push notifications.
- AI coach outside Claude: a serverless function that calls the Claude API, so the API key never sits in the browser.
