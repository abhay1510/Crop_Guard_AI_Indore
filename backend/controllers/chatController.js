const geminiClient = require('../services/geminiClient');

const MAX_MESSAGES = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOTAL_LENGTH = (MAX_MESSAGES + 1) * MAX_MESSAGE_LENGTH;

exports.ask = async (req, res) => {
  const { question, history = [], language = 'en' } = req.body || {};
  if (!['en', 'hi', 'mr'].includes(language)) {
    return res.status(400).json({ error: 'Choose English, Hindi, or Marathi.' });
  }
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Enter a farming question.' });
  }
  if (question.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Question must be ${MAX_MESSAGE_LENGTH} characters or fewer.` });
  }
  if (!Array.isArray(history) || history.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `Conversation history must contain at most ${MAX_MESSAGES} messages.` });
  }

  const cleanHistory = [];
  let totalLength = question.length;
  for (const message of history) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      return res.status(400).json({ error: 'Conversation history contains an invalid message.' });
    }
    if (!message.content.trim() || message.content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Each message must be 1-${MAX_MESSAGE_LENGTH} characters.` });
    }
    totalLength += message.content.length;
    cleanHistory.push({ role: message.role, content: message.content });
  }
  if (totalLength > MAX_TOTAL_LENGTH) {
    return res.status(400).json({ error: 'Conversation is too long. Start a new chat.' });
  }

  try {
    const result = await geminiClient.ask([
      ...cleanHistory,
      { role: 'user', content: question.trim() },
    ], language);
    return res.json(result);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 502;
    return res.status(status).json({ error: error.message || 'Chat request failed.' });
  }
};
