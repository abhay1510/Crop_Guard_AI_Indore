const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { handleUpload, handleDroneUpload } = require('../middleware/upload');
const authC = require('../controllers/authController');
const contactC = require('../controllers/contactController');
const adminC = require('../controllers/adminController');
const admin = require('../middleware/admin');
const fieldC = require('../controllers/fieldController');
const nearbyC = require('../controllers/nearbyController');
const scanC = require('../controllers/scanController');
const droneC = require('../controllers/droneController');
const chatC = require('../controllers/chatController');
const aiClient = require('../services/aiClient');
const chatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.userId,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'You have reached the chat limit of 30 messages per 15 minutes. Please wait for the limit to reset.' }),
});

const router = express.Router();
// Express 4 doesn't catch async errors; wrap handlers.
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/health', w(async (req, res) => res.json({ status: 'ok', ai: await aiClient.health() })));

router.post('/auth/register', w(authC.register));
router.post('/auth/login', w(authC.login));
router.get('/auth/me', auth, w(authC.me));
const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many contact messages. Please try again later.' },
});
router.post('/contact', contactRateLimit, w(contactC.create));

router.get('/admin/overview', auth, admin, w(adminC.overview));
router.get('/admin/users', auth, admin, w(adminC.users));
router.patch('/admin/users/:id/role', auth, admin, w(adminC.updateUserRole));
router.get('/admin/messages', auth, admin, w(adminC.messages));
router.patch('/admin/messages/:id/read', auth, admin, w(adminC.markMessageRead));

router.get('/dashboard', auth, w(fieldC.dashboard));
router.get('/nearby', auth, w(nearbyC.search));
router.post('/chat', auth, chatRateLimit, w(chatC.ask));

router.post('/fields', auth, w(fieldC.create));
router.get('/fields', auth, w(fieldC.list));
router.get('/fields/:id', auth, w(fieldC.get));
router.patch('/fields/:id', auth, w(fieldC.update));
router.delete('/fields/:id/analysis', auth, w(fieldC.resetAnalysis));
router.delete('/fields/:id', auth, w(fieldC.remove));
router.get('/fields/:id/scans', auth, w(fieldC.scans));
router.get('/fields/:id/health-map', auth, w(fieldC.healthMap));
router.get('/fields/:id/recommendations', auth, w(fieldC.recommendations));
router.get('/fields/:id/statistics', auth, w(fieldC.statistics));
router.get('/fields/:id/report', auth, w(fieldC.report));

router.post('/scans', auth, handleUpload, w(scanC.create));
router.post('/drone/preview', auth, handleDroneUpload, w(droneC.preview));
router.post('/drone/analyze', auth, handleDroneUpload, w(droneC.analyze));
router.get('/scans', auth, w(scanC.list));
router.get('/scans/:id', auth, w(scanC.get));
router.get('/scans/:id/image', auth, w(scanC.image));

module.exports = router;