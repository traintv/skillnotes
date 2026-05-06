const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Note = require('../models/Note');
const { body, validationResult } = require('express-validator');
const passport = require('passport');

require('../config/passport');

const createDemoNote = async (userId) => {
  try {
    const { marked } = await import('marked');

    const demoNote = new Note({
      title: 'Demo',
      text: '# Добро пожаловать в SkillNotes!\n\nЭто демонстрационная заметка, показывающая возможности Markdown.\n\n## Форматирование\n\n- **Жирный текст** создается с помощью `**жирный**`\n- *Курсивный текст* создается с помощью `*курсив*`\n- Списки создаются с помощью `-` или `*` в начале строки\n\n## Код\n\n```javascript\nconst greeting = "Привет, мир!";\nconsole.log(greeting);\n```\n\n## Ссылки\n\n[Посетить Skillbox](https://skillbox.ru)\n\n## Приятного использования SkillNotes!',
      user: userId
    });

    demoNote.html = marked(demoNote.text);
    await demoNote.save();
    return demoNote;
  } catch (err) {
    console.error('Error creating demo note:', err);
    return null;
  }
};

router.post('/signup', [
  body('email')
    .isEmail()
    .withMessage('Введите корректный email')
    .normalizeEmail(),
  body('username')
    .isLength({ min: 3 })
    .withMessage('Имя пользователя должно содержать минимум 3 символа')
    .trim()
    .escape(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array().map(err => err.msg).join(', ')
    });
  }

  try {
    const { email, username, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      } else {
        return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
      }
    }

    const user = new User({ email, username, password });
    await user.save();

    await createDemoNote(user._id);

    req.session.userId = user._id;

    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      userId: user._id
    });
  } catch (err) {
    console.error('Ошибка при регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
    if (!user) {
      return res.status(401).json({ error: info.message });
    }

    req.session.userId = user._id;

    return res.json({
      message: 'Вход выполнен успешно',
      userId: user._id
    });
  })(req, res, next);
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Ошибка при выходе:', err);
      return res.status(500).json({ error: 'Ошибка при выходе из системы' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Выход выполнен успешно' });
  });
});

router.get('/check', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ authenticated: true });
  }
  res.json({ authenticated: false });
});

router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      username: user.username,
      email: user.email,
      id: user._id,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error('Ошибка при получении данных пользователя:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;