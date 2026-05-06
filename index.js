// Загружаем переменные окружения только в режиме разработки
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const nunjucks = require('nunjucks');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const passport = require('passport');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');

// Импорт конфигурации Passport
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Подключение к MongoDB с правильным URI и обработкой ошибок
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 60000, // Увеличиваем таймаут до 60 секунд
  socketTimeoutMS: 45000, // Таймаут сокета
})
.then(() => {
  console.log('MongoDB connected successfully');
  console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  if (err.name === 'MongooseServerSelectionError') {
    console.error('MongoDB connection details:', err.reason);
  }
});

// Обработчики событий подключения к MongoDB
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Настройка Nunjucks
nunjucks.configure('views', {
  autoescape: true,
  express: app,
});

app.set('view engine', 'njk');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Для упрощения разработки
}));
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Настройка сессии
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60, // 14 дней в секундах
    autoRemove: 'native' // Использовать встроенный механизм MongoDB для удаления устаревших сессий
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 дней в миллисекундах
    secure: process.env.NODE_ENV === 'production', // Использовать secure cookie только в продакшн
    httpOnly: true, // Предотвращает доступ к cookie через JavaScript
    sameSite: 'lax' // Защита от CSRF
  }
}));

// Инициализация Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware для проверки аутентификации
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/');
};

// Маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/notes', isAuthenticated, noteRoutes);

// Рендеринг страниц
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const User = require('./models/User');
    const user = await User.findById(req.session.userId);
    res.render('dashboard', { 
      username: user ? user.username : 'Пользователь',
      session: { userId: req.session.userId }
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { 
      username: 'Пользователь',
      session: { userId: req.session.userId }
    });
  }
});

// Обработка 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.status(404).render('404');
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
  res.status(500).render('error', { error: 'Произошла ошибка на сервере' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Application URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
  } else {
    console.log(`Development server: http://localhost:${PORT}`);
  }
});

module.exports = app;
