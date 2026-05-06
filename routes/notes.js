const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const mongoose = require('mongoose');

// Получение списка заметок с фильтрацией и пагинацией
router.get('/', async (req, res) => {
  try {
    const { age, search, page = 1 } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;
    
    // Базовый фильтр - только заметки текущего пользователя
    let filter = { user: req.session.userId };
    
    // Фильтр по архиву
    if (age === 'archive') {
      filter.isArchived = true;
    } else {
      filter.isArchived = false;
      
      // Фильтр по дате
      if (age) {
        const now = new Date();
        let startDate;
        
        switch (age) {
          case '1month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case '3months':
            startDate = new Date(now.setMonth(now.getMonth() - 3));
            break;
          case 'alltime':
            // Не устанавливаем startDate для всего времени
            break;
          default:
            startDate = new Date(now.setMonth(now.getMonth() - 1)); // По умолчанию - 1 месяц
        }
        
        if (startDate) {
          filter.created = { $gte: startDate };
        }
      }
    }
    
    // Поиск по заголовку
    if (search && search.trim()) {
      // Используем регулярное выражение для поиска без учета регистра
      filter.title = { $regex: new RegExp(search, 'i') };
    }
    
    // Получение заметок с пагинацией
    const notes = await Note.find(filter)
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit + 1); // Берем на 1 больше, чтобы проверить, есть ли еще записи
    
    // Проверка наличия следующей страницы
    const hasMore = notes.length > limit;
    if (hasMore) {
      notes.pop(); // Удаляем лишнюю запись, которую использовали для проверки
    }
    
    // Подготовка данных для ответа с подсветкой найденного текста
    const data = notes.map(note => {
      const result = {
        _id: note._id,
        title: note.title,
        text: note.text,
        html: note.html,
        created: note.created,
        updated: note.updated,
        isArchived: note.isArchived
      };
      
      // Если был поиск, добавляем подсветку
      if (search && search.trim() && note.title) {
        // Создаем безопасное регулярное выражение, экранируя специальные символы
        const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeSearch})`, 'gi');
        result.highlights = note.title.replace(regex, '<mark>$1</mark>');
      }
      
      return result;
    });
    
    res.json({ data, hasMore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание новой заметки
router.post('/', async (req, res) => {
  try {
    const { title, text } = req.body;
    
    const note = new Note({
      title: title || '',
      text: text || '',
      user: req.session.userId
    });
    
    await note.save();
    
    res.status(201).json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение одной заметки
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOne({ 
      _id: id, 
      user: req.session.userId 
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Редактирование заметки
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text } = req.body;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOne({ 
      _id: id, 
      user: req.session.userId 
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    // Обновление полей
    note.title = title !== undefined ? title : note.title;
    note.text = text !== undefined ? text : note.text;
    
    await note.save();
    
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Архивация заметки
router.put('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.session.userId },
      { isArchived: true, updated: Date.now() },
      { new: true }
    );
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Восстановление заметки из архива
router.put('/:id/unarchive', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.session.userId },
      { isArchived: false, updated: Date.now() },
      { new: true }
    );
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление заметки
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOneAndDelete({ 
      _id: id, 
      user: req.session.userId,
      isArchived: true // Можно удалять только архивные заметки
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена или не находится в архиве' });
    }
    
    res.json({ message: 'Заметка успешно удалена', _id: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление всех архивных заметок
router.delete('/archived', async (req, res) => {
  try {
    const result = await Note.deleteMany({ 
      user: req.session.userId,
      isArchived: true 
    });
    
    res.json({ 
      message: 'Архивные заметки успешно удалены', 
      count: result.deletedCount 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Скачивание заметки в формате PDF (опционально)
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка валидности ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Некорректный ID заметки' });
    }
    
    const note = await Note.findOne({ 
      _id: id, 
      user: req.session.userId 
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Заметка не найдена' });
    }
    
    // Создаем HTML для преобразования в PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${note.title || 'Заметка'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          .date { color: #666; font-style: italic; }
          .content { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${note.title || 'Без заголовка'}</h1>
        <div class="date">Создано: ${note.created.toLocaleDateString()}</div>
        <div class="content">${note.html}</div>
      </body>
      </html>
    `;
    
    try {
      // Динамический импорт puppeteer
      const puppeteer = await import('puppeteer');
      
      // Запускаем браузер
      const browser = await puppeteer.default.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const page = await browser.newPage();
      
      // Загружаем HTML
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Генерируем PDF
      const pdfBuffer = await page.pdf({ 
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
      });
      
      // Закрываем браузер
      await browser.close();
      
      // Отправляем PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${note.title || 'note'}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Error generating PDF:', err);
      res.status(500).json({ error: 'Ошибка при создании PDF' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
