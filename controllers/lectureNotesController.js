const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const LectureNote = require('../models/LectureNote');

const notesFilePath = path.join(__dirname, '../lecture-notes.json');

// Helper: load notes from JSON fallback
const loadNotesFromJson = () => {
  try {
    const data = fs.readFileSync(notesFilePath, 'utf8');
    return JSON.parse(data).notes || [];
  } catch (err) {
    return [];
  }
};

// Helper: save notes to JSON fallback
const saveNotesToJson = (notes) => {
  fs.writeFileSync(notesFilePath, JSON.stringify({ notes }, null, 2));
};

// Get all lecture notes
exports.getAllNotes = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const notes = await LectureNote.find().sort({ createdAt: -1 });
      return res.json(notes);
    }

    // Fallback mode: load from lecture-notes.json
    const notes = loadNotesFromJson();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get notes by subject
exports.getNotesBySubject = async (req, res) => {
  try {
    const { subject } = req.params;

    if (mongoose.connection.readyState === 1) {
      const notes = await LectureNote.find({ subject }).sort({ createdAt: -1 });
      return res.json(notes);
    }

    // Fallback mode: filter from lecture-notes.json
    const notes = loadNotesFromJson();
    const filteredNotes = notes.filter(note => note.subject === subject);
    res.json(filteredNotes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new lecture note
exports.createNote = async (req, res) => {
  try {
    const { title, content, subject } = req.body;
    const createdBy = req.user?.email || 'admin@statscbt.com'; // fallback for admin

    const images = [];

    // Handle uploaded images
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        images.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size
        });
      });
    }

    const noteData = {
      title,
      content,
      subject,
      createdBy,
      images,
      _id: Date.now().toString() // simple ID for JSON fallback
    };

    if (mongoose.connection.readyState === 1) {
      const note = new LectureNote(noteData);
      await note.save();
      return res.status(201).json(note);
    }

    // Fallback mode: save to lecture-notes.json
    const notes = loadNotesFromJson();
    notes.push(noteData);
    saveNotesToJson(notes);

    res.status(201).json(noteData);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update lecture note
exports.updateNote = async (req, res) => {
  try {
    const { title, content, subject } = req.body;
    const updateData = {
      title,
      content,
      subject,
      updatedAt: new Date()
    };

    // Handle new uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }));

      if (mongoose.connection.readyState === 1) {
        const note = await LectureNote.findById(req.params.id);
        if (note) {
          updateData.images = [...(note.images || []), ...newImages];
        }
      } else {
        // Fallback mode
        const notes = loadNotesFromJson();
        const note = notes.find(n => n._id === req.params.id);
        if (note) {
          updateData.images = [...(note.images || []), ...newImages];
        }
      }
    }

    if (mongoose.connection.readyState === 1) {
      const note = await LectureNote.findByIdAndUpdate(req.params.id, updateData, { new: true });
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }
      return res.json(note);
    }

    // Fallback mode: update in lecture-notes.json
    const notes = loadNotesFromJson();
    const noteIndex = notes.findIndex(n => n._id === req.params.id);

    if (noteIndex === -1) {
      return res.status(404).json({ message: 'Note not found' });
    }

    notes[noteIndex] = { ...notes[noteIndex], ...updateData };
    saveNotesToJson(notes);

    res.json(notes[noteIndex]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete lecture note
exports.deleteNote = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const note = await LectureNote.findByIdAndDelete(req.params.id);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      // Delete associated image files
      if (note.images && note.images.length > 0) {
        note.images.forEach(image => {
          const imagePath = path.join(__dirname, '../uploads', image.filename);
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        });
      }

      return res.json({ message: 'Note deleted' });
    }

    // Fallback mode: delete from lecture-notes.json
    const notes = loadNotesFromJson();
    const noteIndex = notes.findIndex(n => n._id === req.params.id);

    if (noteIndex === -1) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const note = notes[noteIndex];

    // Delete associated image files
    if (note.images && note.images.length > 0) {
      note.images.forEach(image => {
        const imagePath = path.join(__dirname, '../uploads', image.filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }

    notes.splice(noteIndex, 1);
    saveNotesToJson(notes);

    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete specific image from a note
exports.deleteNoteImage = async (req, res) => {
  try {
    const { noteId, imageIndex } = req.params;

    if (mongoose.connection.readyState === 1) {
      const note = await LectureNote.findById(noteId);
      if (!note || !note.images || !note.images[imageIndex]) {
        return res.status(404).json({ message: 'Note or image not found' });
      }

      const image = note.images[imageIndex];
      const imagePath = path.join(__dirname, '../uploads', image.filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      note.images.splice(imageIndex, 1);
      await note.save();

      return res.json({ message: 'Image deleted' });
    }

    // Fallback mode
    const notes = loadNotesFromJson();
    const note = notes.find(n => n._id === noteId);

    if (!note || !note.images || !note.images[imageIndex]) {
      return res.status(404).json({ message: 'Note or image not found' });
    }

    const image = note.images[imageIndex];
    const imagePath = path.join(__dirname, '../uploads', image.filename);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    note.images.splice(imageIndex, 1);
    saveNotesToJson(notes);

    res.json({ message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};