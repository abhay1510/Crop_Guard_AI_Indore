# CropGuard AI

AI crop-health mapping for targeted inspection. Upload leaf photos, get a prediction with confidence, watch a colour-coded field grid fill in, and get transparent next steps.

**Stack:** React + Vite + Tailwind + Framer Motion + Recharts · Node/Express + MongoDB · Python FastAPI + PyTorch (MobileNetV3) · Gemini farming chatbot

## Features
Animated landing page and glass-style dashboard · auth with per-user access control · fields with configurable grid · small-block/leaf scanner with scan animation and confidence ring · drone image scanner with TIFF support, overlapping regions, Gemini visual assessments, and annotated health map · farming-only Gemini chatbot · animated health map with filters and zone details · prioritised recommendations with human-verification flags · scan history · printable field report (Save as PDF) · flagged-area estimate · optional simulated demo data (clearly labelled).

The interface supports English, Hindi, and Marathi from the language selector in the header. English is the default; the selection is remembered in the browser. Chatbot replies and drone-analysis observations use the selected language.

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

## Admin and contact pages
- Public **About us** and **Contact us** pages are linked from the landing page and app navigation.
- Register the initial administrator account, then from `backend/` run `node scripts/setUserRole.js admin@gmail.com admin`. Replace the email with the account to promote. Only admins can manage account roles or read contact submissions.
- Contact form messages are saved in MongoDB and shown in **Admin → Contact inbox**. To also send email notifications, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `CONTACT_EMAIL` in `backend/.env`. Without SMTP configuration, messages remain available in the admin inbox and the contact page reports that email was not sent.

## Demo flow for judges (5 min)
1. Landing page, register. 2. Fields: create a field. 3. Scanner: upload a leaf photo, show prediction, confidence and next step. 4. Health Map: the cell changes colour; click it. 5. Actions and Report pages. If you have no photos or model yet, use **Load simulated demo data** on the Fields page and say clearly it is simulated.

## Real model vs demo mode (important)
- **Real mode:** put `crop_model.pth` and `class_labels.json` in `ai-service/models/` (train with `python training/train.py --data data --epochs 8`; dataset layout is in the script header). Class names containing "healthy" count as healthy.
- **No model, no DEMO_MODE:** `/predict` returns 503, scans are stored as failed. Nothing is invented.
- **DEMO_MODE=true:** a green-pixel heuristic, NOT AI. Everything it produces is tagged Demo. Simulated seed data is tagged the same way. Do not present either as model output or report accuracy for them.
- Confidence thresholds (`HIGH_CONF=0.85`, `LOW_CONF=0.60`) are unvalidated starting values. Calibrate on your validation set. PlantVillage-style lab images usually overstate field performance.

The app flags where to inspect. It does not diagnose and never recommends pesticides, fertiliser or doses. Verify on-site first.

## Production notes
Set `CORS_ORIGIN`, a strong `JWT_SECRET`, serve over HTTPS, and use object storage for uploads on hosts with ephemeral disks.

## Farming chatbot
- Sign in and open **Farm assistant**. The authenticated backend proxies questions to Google Gemini `generateContent`; configure `GEMINI_API_KEY` in `backend/.env` (optional `GEMINI_MODEL`, default `gemini-3.5-flash-lite`). Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Never expose the key in frontend code or commit it.
- The model is instructed to classify scope and answer only farming-related questions. Requests are bounded and rate-limited; non-farming prompts receive a fixed out-of-scope response. This is a prompt-based model boundary, not a perfect content filter.
- Chatbot advice can be wrong. It avoids chemical product doses and recommends local expert/product-label guidance for high-impact treatment questions.
- The same Gemini key/model is used for drone-image visual assessment. The key is passed only from the authenticated backend to the private AI-service request and is not sent by the browser.
