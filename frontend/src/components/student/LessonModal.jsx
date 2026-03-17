import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { studentApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import './LessonModal.css';

function LessonModal({ date, lesson, tutorId, studentId, onSave, onClose, onMaterialAdded }) {
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [materialFile, setMaterialFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const materials = lesson?.materials || [];

  useEffect(() => {
    if (lesson) {
      setTime(lesson.time || '');
      setNote(lesson.note || '');
    } else {
      setTime('');
      setNote('');
    }
  }, [lesson]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!time.trim()) { setError('Пожалуйста, укажите время урока'); return; }
    onSave({ date, time: time.trim(), note: note.trim() });
  };

  const handleMaterialUpload = async () => {
    if (!materialFile || !tutorId || !studentId) return;
    setUploading(true);
    try {
      const fileUrl = await studentApi.uploadMaterial(materialFile, tutorId, studentId);
      await studentApi.addLessonMaterial(studentId, date, fileUrl);
      setMaterialFile(null);
      onMaterialAdded?.();
      toast.success('Материал прикреплён к уроку');
    } catch {
      toast.error('Не удалось загрузить материал');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="lesson-modal-overlay" onClick={onClose}>
      <div className="lesson-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="lesson-modal-header">
          <h2>Урок на {formatDate(date)}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="time">Время *</label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="note">Заметка</label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="form-textarea"
              placeholder="Тема урока, домашнее задание..."
              rows="3"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="lesson-modal-actions">
            <div className="action-buttons">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                {lesson ? 'Сохранить' : 'Добавить урок'}
              </button>
            </div>
          </div>
        </form>

        {/* Materials section */}
        <div className="lesson-materials-section">
          <h3 className="lesson-materials-title">Материалы к уроку</h3>

          {materials.length > 0 ? (
            <ul className="lesson-materials-list">
              {materials.map((url, i) => {
                const displayUrl = url.startsWith('/api/') ? `${API_BASE}${url}` : url;
                const fileName = decodeURIComponent(url.split('/').pop() || `Файл ${i + 1}`);
                return (
                  <li key={i}>
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" download>
                      📄 {fileName}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="lesson-materials-empty">Материалов нет</p>
          )}

          {tutorId && studentId && (
            <div className="lesson-material-upload">
              <input
                type="file"
                id="lesson-material-file"
                onChange={(e) => setMaterialFile(e.target.files[0] || null)}
                style={{ display: 'none' }}
              />
              <label htmlFor="lesson-material-file" className="file-upload-label">
                {materialFile ? materialFile.name : 'Прикрепить файл'}
              </label>
              {materialFile && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleMaterialUpload}
                  disabled={uploading}
                  style={{ marginTop: '8px' }}
                >
                  {uploading ? 'Загрузка...' : 'Загрузить'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonModal;
