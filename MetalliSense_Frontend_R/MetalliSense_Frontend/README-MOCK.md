# MetalliSense browser demo

This is a mode of the existing React application. The Node, Python and OPC UA service source is retained. The demo runs on a static server, persists its records in your browser, and needs no API keys. It remains human-approved decision support.

Run these commands in `MetalliSense_Frontend_R/MetalliSense_Frontend`:

```powershell
npm.cmd install
npm.cmd run dev:mock
```

Build and preview:

```powershell
npm.cmd run build:mock
npx.cmd vite preview --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/#/dashboard`. Production files are in `dist`. Mock routes use hashes, so refresh/deep links work without server-side route rewrites. Serve files over HTTP; do not open index.html directly from disk.

Deploy the generated `dist` folder to any static host. Examples, executed from the frontend folder:

```powershell
# Vercel: publish the already built static directory
npx.cmd vercel dist --prod

# Netlify: publish the already built static directory
npx.cmd netlify-cli deploy --dir dist --prod
```

Those deployment commands require your own host login/project configuration and publish the site; they were not executed. For a connected Git deployment, set root directory to `MetalliSense_Frontend_R/MetalliSense_Frontend`, build command to `npm run build:mock`, and publish/output directory to `dist`.

For GitHub Pages, publish the contents of `dist` as the Pages artifact (or copy those contents to the branch/folder selected in Pages settings). Keep the default relative base `./`, or set an explicit subpath before building:

```powershell
$env:VITE_BASE_PATH = '/your-repository/'
npm.cmd run build:mock
Remove-Item Env:VITE_BASE_PATH
```

Use `https://your-user.github.io/your-repository/#/dashboard` for a deep link. Host setup follows the host's account settings; this workspace was not uploaded or deployed.

Normal mode stays available with the original `npm run dev` / `npm run build`. Mock initialization is guarded by `VITE_MOCK_MODE=true` in the new `.env.mock` mode file, and dynamically imported before React mounts. Do not put provider keys in any VITE-prefixed variable. The mock build allowlists only its mode/base variables; existing environment files were not edited.

Use the demo header's **Reset demo data** button to clear and reseed browser business data, active melt flow and chat history. **Outbox** shows alerts with recipient, subject, body and time; no email is sent. **Export audit CSV** downloads a Blob of the uncapped audit. The **Charge Optimizer** link opens the new demo charge planner. `Use this mix` plans a heat and opens the existing gate without deducting stock. Raw charge is deducted at approved furnace start, matching the backend. Strategy approval deducts the actual selected candidate, atomically and once per heat.

Data is stored under `metallisense.browser-demo.v1` in localStorage, per browser origin. The existing active-flow sessionStorage key remains per tab. Changing host/port creates a separate demo. Browser storage can fill; the application reports that failure instead of claiming a successful persistent write. This single-browser demo is not multi-user inventory software.

Exact ports include Node chemistry/yield/uncertainty, screening decisions, DRI QA, gate checks/interlocks, supplier/AHP scoring, inventory/purchase requests, energy calculations, sales/certificates/invoices, costs/carbon formulas, and API payload translations. Existing deterministic supplier/heat history is reused. Training pages use 200 stratified samples from the existing dataset rather than shipping dataset.csv.

The exported Isolation Forest and alloy gradient-boosting evaluators retain every estimator. Model JSON totals about 2.47 MB; 15 Python comparison fixtures match anomaly scores within 1e-6 and match alloy additions/confidence. RL uses exported bootstrapped weights, the actual 0.3/1/2 candidate scales and browser reward updates. Unsupported deliberate P/S additions are explicitly excluded and flagged in candidates because no approved inventory additive exists. Approved additions change simulated readings, and later readings update the reward weights again.

Approximations: grade-risk probabilities use a local distance-to-spec logistic model; mechanical estimates use the existing deterministic browser formula (not Python process noise or trained mechanical ML artifacts); semantic search uses local term/IDF matching; copilot uses local plant-state intent matching instead of an LLM; spectrometer transport/noise is a browser simulator. Confidence, cost, energy and carbon are demo estimates. Voice uses speechSynthesis/SpeechRecognition when available; recognition support, connectivity and microphone permissions depend on the browser. There is no offline audio-file transcription. See `MOCK_COVERAGE.md` for exact endpoint and limitation details.

No original Charge Optimizer page or `tests/test_charge_mix.py` exists in the active source. The demo adds that planner using a JavaScript LP with grade safety margins, residual limits, usable stock and restricted share constraints, plus 12 new constraint/input tests. The original router has no separate Reports or sales-order-management screen; existing Sales/Dispatch, certificates and PO entry are retained. Demo order SO-1001 is fulfilled when invoiced with that PO number.

Validation commands:

```powershell
npm.cmd run test:mock
npm.cmd run build:mock
npm.cmd run test:mock:e2e
# Optional normal-mode isolation check, preserving the mock dist:
npm.cmd run build -- --outDir dist-normal
```

Playwright uses installed Chrome and a Vite static preview server on 127.0.0.1:4179. It blocks every request to another origin, including fonts (mock fonts are served locally). The full flow uses browser fetch for business mutations and UI interaction for charge planning/reset; separate tests click both strategy acceptance pages and check stock and mechanical rendering. It does not prove every individual form/control, every input, every supported browser or a live-foundry process works. No physical instruments, remote deployment, real email, provider LLM, or production calibration was tested.

Model export is read-only: run `tools/export_models.py` from the project root with the existing AI Python environment. It exports local trusted pickle artifacts into frontend model JSON without training or feedback. `tools/model_fixtures.py` creates read-only comparison fixtures. Backend and Python service source/model artifacts are not modified.

Vite mode/env behavior: [official guide](https://vite.dev/guide/env-and-mode). Test static-server setup: [Playwright web-server guide](https://playwright.dev/docs/test-webserver).

Validation on 2026-10-12: both production builds passed; 3 Playwright tests passed (23 routes, full browser flow, both acceptance UI paths, persistence and reset). Unit coverage includes 12 LP constraint/input cases, gate checks/fingerprints against Node with the same risk input, 15 Python anomaly/alloy comparisons, failure-safe stock transactions, unsupported-additive flags and reward update persistence. The final static `dist` is 6,295,799 bytes across 100 files (about 6.30 MB uncompressed / 2.60 MB when each file is gzip-compressed). Large lazy model chunks retain all trained trees; Vite's 500 kB warning remains. Normal output is 1,947,896 bytes and contains no mock runtime/model markers or assets. No .env, .pem or dataset.csv file appears in either output.

Files changed: package.json/package-lock.json, main.jsx, App.jsx, vite.config.js, MainLayout/Sidebar, Dashboard, Spectrometer, RLOptimizer, FullAnalysis, MechanicalProperties, AIAgent, ReadAloud and AIChatInterface. Added: src/mock runtime/domain ports/seed/models/UI, local font assets, .env.mock, tests/configs, this README, MOCK_COVERAGE.md and MOCK_VALIDATION.json. Read-only export/comparison scripts live in project-root tools. The source backup is `_backup_before_mock_20261012` at project root; it intentionally excludes dependencies, generated output and environment files.


Latest UI change: at the user's request, the whole auxiliary header strip is removed (Charge Optimizer shortcut, Outbox, audit export and Reset demo data). Earlier descriptions of those header controls are historical. The existing page controls and browser runtime remain, and #/charge-optimizer is still available directly.


Vercel production preparation: vercel.json selects framework vite, output dist, npm install and VITE_MOCK_MODE=true npm run build:mock, with /(.*) rewritten to /index.html. .vercelignore excludes all environment files (including the nonsecret mode file), certificates, dataset.csv, dependencies and generated/test output; the build command supplies the mock flag explicitly. Deploy from this source folder with npx vercel --prod after authentication. Production deployment is READY at https://metallisense-static-demo.vercel.app (manual Vercel CLI deployment). Local deployment validation passed all 23 routes, deep-link refresh, optimizer output and copilot response with off-origin requests blocked.


Production URL: https://metallisense-static-demo.vercel.app/#/dashboard. Automatic GitHub linking needs a GitHub Login Connection and did not succeed; the manual production deployment succeeded. Vercel install reported 12 dependency vulnerabilities (2 moderate, 10 high). Dependency upgrades were not applied because this deployment task preserves app features and UI. Live-check results are recorded in VERCEL-LIVE-CHECK.json and VERCEL-DEPLOYMENT.json.

Final production verification passed: all 23 routes, pre-melt deep-link refresh, charge optimization, closed-loop RL page and copilot chat after a generated analysis. Zero console/page errors, failed HTTP requests or backend/off-origin requests were observed in the blocked-network Chrome check.


Verified custom production domain: https://melt.automconsultancy.in/#/dashboard. HTTPS, all 23 routes, pre-melt deep-link refresh, optimizer and copilot UI passed. Keep the melt CNAME pointing to d61a65b3f451dbaa.vercel-dns-017.com; project-domain ownership verification was completed using the requested _vercel TXT record.
