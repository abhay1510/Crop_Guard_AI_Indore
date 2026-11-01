# API (all except auth and /health need `Authorization: Bearer <token>`; ownership enforced)
POST /api/auth/register | /api/auth/login, GET /api/auth/me, GET /api/health, GET /api/dashboard
POST/GET /api/fields, GET/PATCH/DELETE /api/fields/:id
GET /api/fields/:id/{scans,health-map,recommendations,statistics,report}
POST /api/fields/:id/seed-demo  (empty fields only; creates SIMULATED scans flagged demo:true)
POST /api/scans (multipart: fieldId, zoneId, image), GET /api/scans, GET /api/scans/:id, GET /api/scans/:id/image
AI service: GET /health, GET /model-info, POST /predict (multipart `file`)
