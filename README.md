CogniLoad-XAI is a browser-based Muse 2 / Muse S (Classic protocol) EEG research workspace. The experiment page records four EEG channels (TP9, AF7, AF8, TP10) continuously through a 30-second baseline, a task, and a 30-second post-task rest, then exports one CSV per session.

The interface supports Thai and English. Use the **English / ไทย** button on the sign-in screen or in the app header to switch languages. The choice is saved in this browser and survives reloads. On first visit, the app chooses Thai for a Thai browser locale and English otherwise. Changing the interface language does not change recorded EEG data or CSV field names.

## Running a study session

1. Sign in with a researcher account. Use Chrome or Edge on a computer or Android device over HTTPS or `localhost`; allow Bluetooth access.
2. Enter a pseudonymous participant ID, session ID, participant group (`patient` or `control`), condition, choose one of the three web games, and set the maximum task duration (5–540 seconds). Confirm that consent has been obtained under the study protocol. Use the same game and task duration for corresponding sessions in both groups; run another session for another game.
3. Connect Muse and wait for the **EEG ครบ 4 ช่อง** indicator and live channel values. Research sessions require at least one second of recent data on each channel and block starting if at least 1% of recent samples on any channel reach the ADC limit. For a hardware check, use **ทดสอบอุปกรณ์ 15 วินาที**; the exported CSV will have `test_mode=true` and does not require participant consent or a quality precheck. A research session records 30 seconds of baseline before the game starts. EEG stays recording during the game and for 30 seconds after the game ends. Total planned duration is limited to 600 seconds.
4. Use **เพิ่ม marker** for additional events. Automatic markers identify session and phase boundaries. The selected game opens automatically at the start of the Task phase. Press **จบกิจกรรม · เก็บ EEG ต่อ 30 วินาที** when the participant finishes, or let the task reach its maximum time. Either way, the game stops and the EEG continues for a 30-second post-task rest. The exported `task_seconds` reflects the elapsed task time. Game markers include game number, trial number, stimulus, response, correctness and reaction time; a game summary marker records total responses, errors and mean reaction time. Repeated clicks on a response are ignored. Leaving the game page during Task, failing to start the selected game, losing the device or one EEG channel, or hiding the tab stops the session and marks it incomplete; the partial recording remains exportable.
   Reaction time starts when the stimulus appears for Odd or Even and Pattern Drift. For Echo Sequence it starts when the response prompt appears, after the 2.2-second display period.
5. EEG and markers are saved in browser IndexedDB in short batches during recording. Each session also retains its own summary of timing, EEG sample counts and quality, and game results when available. Finalized summaries sync to the server for the admin view; the recording and CSV remain in this browser. If sync fails, the local list shows **Pending sync** and offers **Retry summary sync**. If the tab closes or reloads, the most recent saved batches remain available in **รอบทดลองที่เก็บในเครื่อง** and an unfinished session is marked interrupted. Up to roughly one second of unsaved data can be lost on an abrupt browser or operating-system crash. Export the CSV and check the downloaded file before starting another session. After exporting raw EEG, **ลบ EEG ดิบ เก็บสรุป** removes the large recording while keeping its summary for comparison. **ลบรอบถาวร** removes local data only; already synced server summaries remain available to admins. Clearing site data or using another browser/device removes access to locally saved sessions.

The CSV has one header and one row per EEG sample or event marker. Every row includes `study_group`, `game_id` and `protocol_version` (`alz_web_games_v1` for a research session). `timestamp_ms` for EEG is the host-clock estimate from `muse-jsx`, with sample offsets at 256 Hz; event markers use the browser clock. `received_at_ms` records packet arrival time. `relative_ms` is relative to session start. `packet_index` and `sample_index` help identify dropped or reordered packets. The screen shows observed samples per second and estimates missing, duplicated, and reordered packets from the 16-bit Muse packet index independently for each channel. No EEG recording is sent to the server by this workflow.

The **Dashboard** tab reads research recordings from the browser's IndexedDB. Its overview charts show completed research sessions: the bar chart compares EEG sample counts across TP9, AF7, AF8 and TP10 for the latest completed session; the pie chart shows its actual baseline, task and post-task durations; and the line chart tracks average samples per second per channel across up to 12 completed sessions. Below the charts, **สรุปผลทุกครั้งที่ทดลอง** lists every saved session, including incomplete runs and device checks. Choose any two sessions to compare their timing, EEG counts and quality, and game performance side by side. **ส่งออกสรุปทุกครั้ง (.csv)** downloads one row per session for backup or analysis. Earlier recordings are summarized when the dashboard first loads them. The older assessment overview remains available in a collapsible section below the EEG charts.

## Admin view

Set `ADMIN_USERS` on the server to a comma-separated list of `email:password` pairs (passwords must be at least 12 characters), for example `ADMIN_USERS='admin@example.org:replace-with-a-long-secret'`. Admin accounts are configured by the server operator; public registration cannot grant admin access. Set a stable `SESSION_SECRET` as well. After signing in, open **Admin**, search a pseudonymous participant ID, and select it to see all synced session summaries, including incomplete runs and device checks. The comparison table lets you compare any two runs for that ID, and the CSV button exports those summaries. Each summary records the researcher account that uploaded it. The admin API requires an authenticated admin account for both the ID list and record details; researchers can only upload summaries. Raw EEG and event rows are never uploaded by this feature.

Summaries are written to `data/research-summaries.json` by default, or to `RESEARCH_DATA_DIR/research-summaries.json` when that environment variable is set. Run on one server with a persistent writable volume and back up this file together with `data/users.json`. The JSON store is designed for a single server process; use a transactional database before running multiple writers. A serverless ephemeral filesystem cannot retain these records. Summary sync runs when a researcher signs in and after each finalized session. Existing local sessions are summarized and synced when the researcher next signs in on the same browser. Admins only see records after sync succeeds.

The screen also warns when at least 1% of samples in a channel reach the Muse ADC limit (about ±1000 µV). This indicates clipped values; the channel needs a contact/fit check before participant recording. For an exported file, run:

```bash
node scripts/validate-muse-csv.mjs /path/to/muse_recording.csv
```

The validator prints phase timing, samples per channel, packet gaps, clipping percentages, an approximate 50 Hz amplitude from two-second windows, and game trial markers. A 50 Hz warning is a heuristic for possible mains interference, not a clinical signal-quality cutoff. The live graph centers each channel on its recent mean and uses an automatic display scale; neither operation changes the raw EEG in the CSV. The four large numbers are the latest raw samples, so their signed values can drift and are not scores. `unansweredTrials` identifies stimuli without a response, including a trial cut off by the Task deadline; analyze these separately. It reports data integrity and basic signal checks, not clinical EEG quality or an Alzheimer diagnosis.

This is a research prototype; signal display and sample counts do not establish clinical signal quality or a diagnosis. Validate timing and data completeness against your study protocol before collecting participants.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Auth & deployment notes

Accounts are stored in `data/users.json` (scrypt-hashed passwords) and sessions are HMAC-signed cookies.

- **Single server / VPS / Docker** (filesystem writable): works out of the box. Set `SESSION_SECRET` env var so sessions survive restarts.
- **Serverless (Vercel, Lambda, etc.)**: the filesystem is read-only and ephemeral — account registration will return `storage_unavailable`. You must either deploy on a writable server or replace `lib/auth/store.js` with a real database (SQLite on a persistent volume, Postgres, Upstash Redis, etc.).
- **Multiple instances**: always set the `SESSION_SECRET` environment variable (e.g. `openssl rand -base64 32`) so session cookies verify on every instance.
