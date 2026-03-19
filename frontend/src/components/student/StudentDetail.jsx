import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentApi, progressApi } from '../../services/api';
import { API_BASE } from '../../config.js';
import Calendar from './Calendar';
import LessonModal from './LessonModal';
import ThemeToggle from '../ui/ThemeToggle';
import { parseLocalDate } from '../../utils/date';
import './StudentDetail.css';

const PAYMENT_LABELS = {
  TRIAL: 'Пробный',
  PENDING: 'Не оплачено',
  PAID_EXTERNAL: 'Оплачено вне сервиса',
  PAID_PLATFORM: 'Оплачено',
};

const PAYMENT_COLORS = {
  TRIAL: '#8b5cf6',
  PENDING: '#f59e0b',
  PAID_EXTERNAL: '#10b981',
  PAID_PLATFORM: '#3b82f6',
};

function StudentDetail({ tutorId }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newMaterialFile, setNewMaterialFile] = useState(null);
  const [materialUploading, setMaterialUploading] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [pricePerLesson, setPricePerLesson] = useState('');
  const [trialLessonsCount, setTrialLessonsCount] = useState(1);
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    loadStudent();
  }, [id]);

  const loadStudent = async () => {
    try {
      const response = await studentApi.getStudent(id);
      setStudent(response.data);
      setPricePerLesson(response.data.pricePerLesson != null ? String(response.data.pricePerLesson) : '');
      setTrialLessonsCount(response.data.trialLessonsCount ?? 1);

      if (response.data.lessonDates) {
        const lessonsData = response.data.lessonDates.map(dateStr => {
          if (dateStr.includes('|')) {
            const [date, time, note] = dateStr.split('|');
            return { date, time, note: note || '' };
          }
          return { date: dateStr, time: '', note: '' };
        });
        setLessons(lessonsData);
      } else {
        setLessons([]);
      }
    } catch {
      toast.error('Не удалось загрузить информацию об ученике');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 10MB');
      return;
    }
    setNewMaterialFile(file);
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterialFile || !tutorId) return;

    setMaterialUploading(true);
    try {
      const fileUrl = await studentApi.uploadMaterial(newMaterialFile, tutorId, id);
      await studentApi.addMaterial(id, fileUrl);
      setNewMaterialFile(null);
      const fileInput = document.getElementById('materialFile');
      if (fileInput) fileInput.value = '';
      loadStudent();
    } catch {
      toast.error('Не удалось загрузить материал');
    } finally {
      setMaterialUploading(false);
    }
  };

  const handleDateClick = (date, existingLesson) => {
    setSelectedDate(date);
    const lessonMaterials = student?.lessonMaterials?.[date] || [];
    setSelectedLesson(existingLesson ? { ...existingLesson, materials: lessonMaterials } : null);
    setShowLessonModal(true);
  };

  const handleSaveLesson = async (lessonData) => {
    try {
      const newLessonString = `${lessonData.date}|${lessonData.time}|${lessonData.note || ''}`;
      if (selectedLesson) {
        // Editing existing: find the original full string and replace it
        const oldLessonString = student.lessonDates?.find(d => {
          const dateKey = d.includes('|') ? d.split('|')[0] : d;
          return dateKey === selectedLesson.date && d.includes(selectedLesson.time);
        }) || `${selectedLesson.date}|${selectedLesson.time}|${selectedLesson.note || ''}`;
        await studentApi.updateLessonDate(id, oldLessonString, newLessonString);
      } else {
        await studentApi.addLessonDate(id, newLessonString);
      }
      setShowLessonModal(false);
      setSelectedDate(null);
      setSelectedLesson(null);
      await loadStudent();
    } catch {
      toast.error('Не удалось сохранить урок');
    }
  };

  const handleSavePrice = async () => {
    setSavingPrice(true);
    try {
      await studentApi.updatePrice(id, pricePerLesson === '' ? null : Number(pricePerLesson), trialLessonsCount);
      toast.success('Сохранено');
      loadStudent();
    } catch {
      toast.error('Не удалось сохранить');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleSetPaymentStatus = async (date, status) => {
    try {
      await studentApi.updateLessonPayment(id, date, status);
      loadStudent();
    } catch {
      toast.error('Не удалось обновить статус');
    }
  };

  const getPhotoUrl = () => {
    if (!student?.photoUrl) return null;
    if (student.photoUrl.startsWith('/api/')) return `${API_BASE}${student.photoUrl}`;
    return student.photoUrl;
  };

  if (loading) {
    return (
      <div className="student-detail-container">
        <header className="detail-nav" role="banner">
          <div className="detail-nav-inner">
            <button className="detail-nav-brand" onClick={() => navigate('/home')} aria-label="На главную">
              <div className="brand-logo-mark">TL</div>
              <span className="brand-name">TutorLab</span>
            </button>
          </div>
        </header>
        <div className="container">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="student-detail-container">
        <header className="detail-nav" role="banner">
          <div className="detail-nav-inner">
            <button className="detail-nav-brand" onClick={() => navigate('/home')} aria-label="На главную">
              <div className="brand-logo-mark">TL</div>
              <span className="brand-name">TutorLab</span>
            </button>
          </div>
        </header>
        <div className="container">
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Ученик не найден
          </div>
          <button className="btn btn-secondary" onClick={() => navigate('/home')}>
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  const photoUrl = getPhotoUrl();
  const fullName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <div className="student-detail-container">

      {/* Top navigation */}
      <header className="detail-nav" role="banner">
        <div className="detail-nav-inner">
          <button className="detail-nav-brand" onClick={() => navigate('/home')} aria-label="На главную">
            <div className="brand-logo-mark">TL</div>
            <span className="brand-name">TutorLab</span>
          </button>

          <nav className="detail-nav-breadcrumb" aria-label="Навигация">
            <button className="detail-nav-parent" onClick={() => navigate('/home')}>
              Ученики
            </button>
            <span className="detail-nav-sep">›</span>
            <span className="detail-nav-current">{fullName}</span>
          </nav>

          <div className="detail-nav-actions">
            <button
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '6px 14px' }}
              onClick={() => {
                const url = `${window.location.origin}/s/${id}`;
                navigator.clipboard.writeText(url).then(() => {
                  toast.success('Ссылка скопирована');
                });
              }}
              title="Скопировать ссылку для ученика"
            >
              Поделиться
            </button>
            {student.studentAccountId && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '13px', padding: '6px 14px' }}
                onClick={() => navigate('/chat')}
              >
                Написать
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container">

        {/* Student main card */}
        <div className="student-main-card card">
          <div className="student-main-content">
            <div className="student-photo-section">
              {photoUrl ? (
                <img src={photoUrl} alt={fullName} className="student-photo" />
              ) : (
                <div className="student-photo-placeholder">
                  <span>{student.firstName.charAt(0)}{student.lastName.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="student-info-section">
              <h1>{fullName}</h1>
              <p className="student-age">Возраст: {student.age} лет</p>
              {student.interests && student.interests.length > 0 ? (
                <div className="interests-list">
                  {student.interests.map((interest, index) => (
                    <span key={index} className="interest-tag">{interest}</span>
                  ))}
                </div>
              ) : (
                <p className="empty-text">Интересы не указаны</p>
              )}
            </div>
          </div>
        </div>

        {/* Payment settings */}
        <div className="card">
          <h2>Оплата</h2>
          <div className="payment-settings">
            <div className="payment-field">
              <label className="payment-label">Цена за урок (₽)</label>
              <div className="payment-row">
                <input
                  type="number"
                  className="payment-input"
                  placeholder="Не задана"
                  value={pricePerLesson}
                  min={0}
                  onChange={e => setPricePerLesson(e.target.value)}
                />
                <div className="payment-trial-wrap">
                  <label className="payment-label">Пробных уроков</label>
                  <select
                    className="payment-select"
                    value={trialLessonsCount}
                    onChange={e => setTrialLessonsCount(Number(e.target.value))}
                  >
                    {[0, 1, 2, 3].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleSavePrice}
                  disabled={savingPrice}
                >
                  {savingPrice ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>

            {/* Payment status per lesson */}
            {lessons.length > 0 && (
              <div className="payment-lessons">
                <h3 className="payment-lessons-title">Статусы оплаты уроков</h3>
                {[...lessons].sort((a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)).map((l, i) => {
                  const lessonKey = `${l.date}|${l.time}|${l.note || ''}`;
                  const status = student?.lessonPayments?.[lessonKey] || student?.lessonPayments?.[l.date] || 'PENDING';
                  const color = PAYMENT_COLORS[status] || '#f59e0b';
                  const lessonIndex = i + 1;
                  const isTrial = lessonIndex <= trialLessonsCount;
                  const effectiveStatus = isTrial ? 'TRIAL' : status;
                  return (
                    <div key={lessonKey} className="payment-lesson-row">
                      <div className="payment-lesson-info">
                        <span className="payment-lesson-date">
                          {new Date(l.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          {l.time && ` ${l.time}`}
                        </span>
                        <span
                          className="payment-status-badge"
                          style={{ background: `${PAYMENT_COLORS[effectiveStatus]}20`, color: PAYMENT_COLORS[effectiveStatus] }}
                        >
                          {PAYMENT_LABELS[effectiveStatus]}
                        </span>
                      </div>
                      {!isTrial && (
                        <div className="payment-actions">
                          {status !== 'PAID_EXTERNAL' && (
                            <button
                              className="btn-payment btn-payment-external"
                              onClick={() => handleSetPaymentStatus(lessonKey, 'PAID_EXTERNAL')}
                            >
                              Оплачено вне сервиса
                            </button>
                          )}
                          {(status === 'PAID_EXTERNAL' || status === 'PAID_PLATFORM') && (
                            <button
                              className="btn-payment btn-payment-undo"
                              onClick={() => handleSetPaymentStatus(lessonKey, 'PENDING')}
                            >
                              Отменить
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="card">
          <h2>Календарь занятий</h2>
          <Calendar lessons={lessons} onDateClick={handleDateClick} />
          {lessons.length === 0 && (
            <p className="empty-text" style={{ marginTop: '20px', textAlign: 'center' }}>
              Нажмите на дату в календаре, чтобы запланировать урок
            </p>
          )}
          {lessons.length > 0 && (
            <div className="upcoming-lessons">
              <h3 style={{ marginTop: '30px', marginBottom: '16px', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
                Запланированные уроки
              </h3>
              <div className="lessons-list">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  return lessons
                  .filter(lesson => parseLocalDate(lesson.date) >= today)
                  .sort((a, b) => {
                    const diff = parseLocalDate(a.date) - parseLocalDate(b.date);
                    if (diff !== 0) return diff;
                    return (a.time || '').localeCompare(b.time || '');
                  })
                  .map((lesson, index) => {
                    const lessonDate = parseLocalDate(lesson.date);

                    let dateLabel = lessonDate.toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'long', weekday: 'long',
                    });
                    if (lessonDate.toDateString() === today.toDateString()) dateLabel = 'Сегодня';
                    else if (lessonDate.toDateString() === tomorrow.toDateString()) dateLabel = 'Завтра';

                    return (
                      <div key={index} className="lesson-item">
                        <div className="lesson-item-main" onClick={() => handleDateClick(lesson.date, lesson)}>
                          <div className="lesson-item-date">
                            <span className="lesson-date-label">{dateLabel}</span>
                            {lesson.time && <span className="lesson-time-label">{lesson.time}</span>}
                          </div>
                          {lesson.note && <div className="lesson-item-note">{lesson.note}</div>}
                        </div>
                        {lessonDate.toDateString() === today.toDateString() && (
                          <button
                            className="btn btn-primary lesson-start-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/live/teacher?studentId=${id}&studentName=${encodeURIComponent(fullName)}`);
                            }}
                          >
                            Начать урок
                          </button>
                        )}
                      </div>
                    );
                  })
                  })()}
              </div>
            </div>
          )}
        </div>

        {showLessonModal && (
          <LessonModal
            date={selectedDate}
            lesson={selectedLesson}
            tutorId={tutorId}
            studentId={id}
            onSave={handleSaveLesson}
            onMaterialAdded={loadStudent}
            onClose={() => {
              setShowLessonModal(false);
              setSelectedDate(null);
              setSelectedLesson(null);
            }}
          />
        )}

        {/* Materials */}
        <div className="card">
          <h2>Материалы</h2>
          {student.materialUrls && student.materialUrls.length > 0 ? (
            <ul className="materials-list">
              {student.materialUrls.map((url, index) => {
                const displayUrl = url.startsWith('/api/') ? `${API_BASE}${url}` : url;
                const fileName = decodeURIComponent(url.split('/').pop() || `Материал ${index + 1}`);
                return (
                  <li key={index}>
                    <a href={displayUrl} target="_blank" rel="noopener noreferrer" download>
                      📄 {fileName}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-text">Материалы не добавлены</p>
          )}
          <form onSubmit={handleAddMaterial} className="add-form">
            <input
              type="file"
              id="materialFile"
              onChange={handleMaterialFileChange}
              style={{ display: 'none' }}
              accept="*/*"
            />
            <label htmlFor="materialFile" className="file-upload-label">
              {newMaterialFile ? newMaterialFile.name : 'Выбрать файл'}
            </label>
            {newMaterialFile && (
              <button type="submit" className="btn btn-primary" disabled={materialUploading}>
                {materialUploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            )}
          </form>
        </div>

        <ProgressNoteSection studentId={id} />

      </div>
    </div>
  );
}

// ── Progress Note Section ─────────────────────────────────────────────────────
function ProgressNoteSection({ studentId }) {
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [skillTags, setSkillTags] = useState('');
  const [rating, setRating] = useState(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    progressApi.getNotes(studentId)
      .then(r => setNotes(r.data || []))
      .catch(() => {});
  }, [studentId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await progressApi.addNote(studentId, {
        noteText: noteText.trim(),
        skillTags: skillTags.split(',').map(s => s.trim()).filter(Boolean),
        rating: Number(rating),
      });
      const r = await progressApi.getNotes(studentId);
      setNotes(r.data || []);
      setNoteText('');
      setSkillTags('');
      setRating(3);
      setShowForm(false);
      toast.success('Заметка добавлена');
    } catch {
      toast.error('Ошибка при сохранении заметки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-block">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="section-title">Заметки о прогрессе</h2>
        <button className="btn btn-secondary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Отмена' : '+ Добавить заметку'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Текст заметки о прогрессе..."
            rows={3}
            style={{ borderRadius: 8, padding: '8px 12px', fontSize: '0.9rem',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)', resize: 'vertical' }}
          />
          <input
            type="text"
            value={skillTags}
            onChange={e => setSkillTags(e.target.value)}
            placeholder="Теги через запятую (напр: алгебра, дроби)"
            style={{ borderRadius: 8, padding: '8px 12px', fontSize: '0.9rem',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Оценка:</span>
            {[1,2,3,4,5].map(n => (
              <button type="button" key={n} onClick={() => setRating(n)}
                style={{ fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer',
                  color: n <= rating ? '#f59e0b' : 'var(--text-secondary)' }}>
                ★
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Сохранение...' : 'Сохранить заметку'}
          </button>
        </form>
      )}
      {notes.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Нет заметок о прогрессе.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map(note => (
            <div key={note.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10,
              padding: '12px 16px', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {note.date ? new Date(note.date).toLocaleDateString('ru-RU') : ''}
                </span>
                <span style={{ color: '#f59e0b' }}>{'★'.repeat(note.rating)}{'☆'.repeat(5 - note.rating)}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{note.noteText}</p>
              {note.skillTags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {note.skillTags.map((tag, i) => (
                    <span key={i} className="sv-interest-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentDetail;
