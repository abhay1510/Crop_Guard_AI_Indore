const mongoose = require('mongoose');
const User = require('../models/User');
const Field = require('../models/Field');
const Scan = require('../models/Scan');
const ContactMessage = require('../models/ContactMessage');

exports.overview = async (req, res) => {
  const [users, admins, fields, scans, unreadMessages] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    Field.countDocuments(),
    Scan.countDocuments(),
    ContactMessage.countDocuments({ readAt: null }),
  ]);
  res.json({ users, admins, fields, scans, unreadMessages });
};

exports.users = async (req, res) => {
  const users = await User.find({}, 'name email role createdAt').sort({ createdAt: -1 }).limit(500).lean();
  res.json({ users: users.map((user) => ({ ...user, role: user.role || 'farmer' })) });
};

exports.updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'User not found' });
  if (!['farmer', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be farmer or admin' });
  if (String(req.userId) === id && role !== 'admin') return res.status(409).json({ error: 'You cannot remove your own admin role' });

  const user = await User.findById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
    return res.status(409).json({ error: 'The last admin role cannot be removed' });
  }
  user.role = role;
  await user.save();
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
};

exports.messages = async (req, res) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ messages });
};

exports.markMessageRead = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: 'Contact message not found' });
  const message = await ContactMessage.findByIdAndUpdate(id, { readAt: new Date() }, { new: true }).lean();
  if (!message) return res.status(404).json({ error: 'Contact message not found' });
  res.json({ message });
};
