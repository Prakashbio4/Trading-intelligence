const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

const router = express.Router();

const USERNAME_RE = /^[a-z0-9_]{2,20}$/;

// POST /auth/login
router.post('/login', async (req, res) => {
  const raw = req.body.username;
  if (!raw) return res.status(400).json({ error: 'username is required' });

  const username = raw.toLowerCase().trim();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 2-20 characters: letters, numbers, underscores only' });
  }

  try {
    // Check if user exists
    const { data: existing, error: selectErr } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', username)
      .maybeSingle();

    if (selectErr) throw selectErr;

    let user = existing;

    if (!user) {
      // Auto-register
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert({ username, role: 'user' })
        .select('id, username, role')
        .single();
      if (insertErr) throw insertErr;
      user = created;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { userId: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// GET /auth/me
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ userId: payload.userId, username: payload.username, role: payload.role });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
