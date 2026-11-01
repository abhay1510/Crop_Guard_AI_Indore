const User = require('../models/User');

module.exports = async function admin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (error) {
    next(error);
  }
};
