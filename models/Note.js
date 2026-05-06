const mongoose = require('mongoose');

// Схема заметки
const noteSchema = new mongoose.Schema({
  title: { 
    type: String, 
    default: '' 
  },
  text: { 
    type: String, 
    default: '' 
  },
  html: { 
    type: String, 
    default: '' 
  },
  created: { 
    type: Date, 
    default: Date.now 
  },
  updated: { 
    type: Date, 
    default: Date.now 
  },
  isArchived: { 
    type: Boolean, 
    default: false 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
});

// Преобразование markdown в HTML перед сохранением
noteSchema.pre('save', async function(next) {
  if (this.isModified('text')) {
    try {
      // Динамический импорт marked
      const { marked } = await import('marked');
      this.html = marked(this.text);
      this.updated = Date.now();
      next();
    } catch (err) {
      console.error('Error converting markdown to HTML:', err);
      next(err);
    }
  } else {
    next();
  }
});

// Индексы для эффективного поиска
noteSchema.index({ user: 1, created: -1 });
noteSchema.index({ user: 1, isArchived: 1 });
noteSchema.index({ title: 'text' });

module.exports = mongoose.model('Note', noteSchema);
