# CropGuard AI

AI crop-health mapping for targeted inspection. Upload leaf photos, get a prediction with confidence, watch a colour-coded field grid fill in, and get transparent next steps.

**Stack:** React + Vite + Tailwind + Framer Motion + Recharts · Node/Express + MongoDB · Python FastAPI + PyTorch (MobileNetV3) · Gemini farming chatbot

## Features
Animated landing page and glass-style dashboard · auth with per-user access control · fields with configurable grid and analysis reset · small-block/leaf scanner with scan animation and confidence ring · drone image scanner with TIFF support, overlapping regions, Gemini visual assessments, and annotated health map · farming-only Gemini chatbot · animated health map with filters and zone details · prioritised recommendations with human-verification flags · scan history · printable field report (Save as PDF) · flagged-area estimate · optional simulated demo data (clearly labelled).

On the **Fields** page, use **Reset** to permanently remove a field’s scans, results, recommendations, and uploaded scan images while keeping the field and its settings. In-progress scans are invalidated so their results cannot reappear after the reset. The app asks for confirmation before resetting.

**Nearby agricultural help** sends location searches through the authenticated backend, which queries OpenStreetMap with multiple fallback servers and a short-lived cache. The frontend combines live OpenStreetMap results with 10 clearly marked, unverified hackathon sample points around Bhopal and Indore, then shows up to 10 closest places within 50 km. When sample points are nearby, results include those points and fill remaining slots with live map results. Sample points are not real business listings. If map servers are unavailable, nearby sample points remain visible alongside the error. Public map servers can rate-limit requests; retry after a short wait if they are busy. Coverage depends on map data; unlisted businesses will not appear. Restart the backend after updating the app so the `/api/nearby` route is available.

The interface supports English, Hindi, and Marathi from the language selector in the header. English is the default; the selection is remembered in the browser. Chatbot replies and drone-analysis observations use the selected language.

On first sign-in for each account in a browser, a step-by-step app tour explains the language selector and the main navigation options. Use **Next**/**Back** to move through the tour or **Skip** to close it; it will not appear again for that account in that browser.

Not included: YOLO object detection, segmentation, GPS/NDVI, weather, robotics.

## Drone image analysis
- The Crop Scanner has separate Small Block / Leaf and Drone / Aerial Image modes. Drone uploads accept JPG/JPEG, PNG, and TIFF up to 50 MB (25 million pixels maximum); TIFF previews are decoded by the AI service.
- The AI service divides each drone image into a fixed 10 × 10 grid and assesses all 100 cells independently with Gemini vision via the backend proxy. It returns color-coded health classes, tentative causes, cell-specific inspection actions, rough uncalibrated health/confidence scores, and field-level observations. Original image dimensions and cell coordinates are preserved; the embedded annotated JPEG is capped at 1600 pixels on its longest side to keep large responses manageable. Analysis runs outside FastAPI's event loop and has a bounded request timeout.
- Drone results distinguish Healthy, Mild Stress, Moderate Stress, Severe Stress, and Uncertain. Suspected causes are hypotheses, never confirmed diagnoses. The interactive grid supports health-mapping and precision-treatment views, and exports a downloadable HTML report with the annotated image, statistics, and per-cell recommendations.
- The MobileNetV3 model in this project is trained on close-up leaf images, not aerial imagery, so it is deliberately not applied to drone cells; doing so would give misleading results. Gemini vision performs the drone-cell assessments.
- This is a general-purpose vision estimate, not a validated aerial crop-health model or diagnosis. Lighting, shadows, crop stage, and image resolution can affect results. Verify concerning regions in the field; do not make treatment decisions from this map alone. The server requires `GEMINI_API_KEY` in `backend/.env`.

## Run (3 terminals, Windows PowerShell commands shown; see notes for macOS/Linux)
Needs Node 18+, Python 3.10+, MongoDB running locally (or an Atlas URI in `backend/.env`).

**1. AI service**
```powershell
cd ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt     # demo only? delete the torch/torchvision lines first (big download)
$env:DEMO_MODE="true"               # macOS/Linux: export DEMO_MODE=true
uvicorn app.main:app --port 8000
```
**2. Backend**
```powershell
cd backend
npm install
copy .env.example .env              # then set JWT_SECRET to a random string
# Set GEMINI_API_KEY in backend/.env. Keep it server-side; never put it in frontend/.env.
npm start
```
**3. Frontend**
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev                          # http://localhost:5173
```
Or with Docker: `JWT_SECRET=$(openssl rand -hex 32) docker compose up --build`.

## Share a local demo with ngrok (Windows)
The Vite development server proxies `/api` to the local backend, so one ngrok tunnel shares both the UI and API. Keep the frontend API base as `/api` (the default in `frontend/.env.example`); do not set it to `localhost` or a local backend URL.

1. Start MongoDB (locally or through your configured Atlas URI), then start the AI service and backend using steps 1–2 above. For a demo without model weights, set `$env:DEMO_MODE="true"` in the AI-service terminal before starting Uvicorn.
2. In another PowerShell terminal:
   ```powershell
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```
3. Sign in to ngrok and configure its agent once with the auth token from your ngrok dashboard:
   ```powershell
   ngrok config add-authtoken <YOUR_NGROK_AUTHTOKEN>
   ```
   Keep the token private; do not put it in project files or share it.
4. In a separate terminal, start the tunnel:
   ```powershell
   ngrok http 5173
   ```
5. Open the `https://...ngrok-free.app` forwarding URL printed by ngrok and share that URL with your friend. Keep all local services and the ngrok process running while they use it.

The app and API will be reachable by anyone who has the tunnel URL. Use demo data and a non-admin test account, and stop ngrok (`Ctrl+C`) when finished. The free ngrok URL changes when you restart the tunnel. Browser geolocation requires the HTTPS forwarding URL and the visitor's permission.
## Admin and contact pages
- Public **About us** and **Contact us** pages are linked from the landing page and app navigation.
- Admin accounts open only the Admin dashboard; farmer features and public About/Contact pages are not available while signed in as an admin. Admins can manage account roles and read contact submissions.
- Register the initial administrator account, then from `backend/` run `node scripts/setUserRole.js admin@gmail.com admin`. Replace the email with the account to promote.
- Contact form messages are saved in MongoDB and shown in **Admin → Contact inbox**. To email each submission, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM` (defaults to `SMTP_USER`), and `CONTACT_EMAIL` (the inbox that receives messages) in `backend/.env`. For Gmail, use `smtp.gmail.com`, port `587`, your Gmail address as `SMTP_USER`, and a Google app password as `SMTP_PASS` (enable 2-Step Verification and generate an app password in your Google Account; do not use your normal account password). Set `SMTP_FROM` to the authenticated Gmail address or leave it blank. Restart the backend after editing `.env`. Keep credentials private and never commit `.env`. Without SMTP configuration, submissions are still saved in the admin inbox; the contact page distinguishes unconfigured email from a delivery failure.

## Real model vs demo mode (important)
- **Real mode:** put `crop_model.pth` and `class_labels.json` in `ai-service/models/` (train with `python training/train.py --data data --epochs 8`; dataset layout is in the script header). Class names containing "healthy" count as healthy.
- **No model, no DEMO_MODE:** `/predict` returns 503, scans are stored as failed. Nothing is invented.
- **DEMO_MODE=true:** a green-pixel heuristic, NOT AI. Everything it produces is tagged Demo. Simulated seed data is tagged the same way. Do not present either as model output or report accuracy for them.
- Confidence thresholds (`HIGH_CONF=0.85`, `LOW_CONF=0.60`) are unvalidated starting values. Calibrate on your validation set. PlantVillage-style lab images usually overstate field performance.

The app flags where to inspect. It does not diagnose and never recommends pesticides, fertiliser or doses. Verify on-site first.

## Farming chatbot
- Sign in and open **Farm assistant**. The authenticated backend proxies questions to Google Gemini `generateContent`; configure `GEMINI_API_KEY` in `backend/.env` (optional `GEMINI_MODEL`, default `gemini-3.5-flash-lite`). Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Never expose the key in frontend code or commit it.
- The model is instructed to classify scope and answer only farming-related questions. Requests are bounded and rate-limited; non-farming prompts receive a fixed out-of-scope response. This is a prompt-based model boundary, not a perfect content filter.
- Chatbot advice can be wrong. It avoids chemical product doses and recommends local expert/product-label guidance for high-impact treatment questions.
- The same Gemini key/model is used for drone-image visual assessment. The key is passed only from the authenticated backend to the private AI-service request and is not sent by the browser.
