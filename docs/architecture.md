# Architecture
React (Vite, Tailwind, Framer Motion, Recharts) -> Express REST API -> MongoDB, and Express -> FastAPI AI service (PyTorch MobileNetV3).

Scan flow: upload (magic-byte validated, 8 MB) -> scan record `processing` -> POST image to `/predict` -> store prediction, confidence, certainty -> rules engine (`backend/services/recommendations.js`) -> zone status -> health map. If inference fails the scan is marked `failed`; no prediction is shown.

Drone scan flow: authenticated 50 MB upload (JPG/PNG/TIFF magic-byte validated) -> Express proxy `/drone/analyze` passes its server-side Gemini key/model and selected language to FastAPI -> FastAPI validates dimensions (25 MP limit, minimum 10 × 10 pixels), decodes with OpenCV, forms 100 independent grid cells with source-pixel bounds, and sends resized cell patches to Gemini vision in a worker thread -> validate cell IDs/classes/scores and tentative causes/actions -> aggregate pixel-area percentages and render an annotated JPEG health map capped at 1600 pixels on its longest side. Original dimensions and source-pixel cell coordinates remain in the response; limiting the embedded map size avoids large JSON responses and excess browser/server memory use. Calls have bounded timeouts to keep large uploads from freezing the UI or AI-service event loop. TIFF previews are available through `/drone/preview`. Drone analysis is not persisted as a field scan.

The drone scanner displays the original image with transparent cell overlays and supports all-cell health mapping and affected-cell precision views. Its downloadable HTML report embeds the annotated map, field statistics, and cell-by-cell recommendations. MobileNetV3 remains limited to leaf photos because it is not trained for aerial imagery.

Gemini provides general-purpose visual estimates, not a validated aerial crop-health diagnosis. Confidence is an uncalibrated model estimate. The key is never sent by the browser; it is forwarded server-to-server from the authenticated Express route. Verify concerning regions in the field.

Zone status rules: low certainty or failed = unknown (grey); healthy + high certainty = healthy (green); healthy + medium = possible stress (yellow); disease + high = suspected disease (red); disease + medium = possible stress (yellow); no scans = not inspected. Latest completed scan per zone is displayed; a status change versus the previous scan is flagged as a conflict.

Flagged area = flagged zones x (field acres / zones). It is area marked for inspection, not a claim of treatment or savings.

Localization: the React language context stores `en`, `hi`, or `mr` in browser local storage (English by default) and supplies translations throughout the app. Chat requests pass the selected language to the authenticated Express proxy, which instructs Gemini to respond in that language. Drone requests pass the same validated locale through Express to FastAPI/Gemini for symptoms and observations; health-category enum values remain stable English keys for UI translation.
