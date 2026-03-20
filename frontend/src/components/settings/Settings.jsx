import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { tutorApi } from '../../services/api';
import TutorNav from '../ui/TutorNav';
import './Settings.css';

function Settings({ tutorId, onBack, onLogout }) {
  const [tutor, setTutor] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    about: '',
    photoUrl: '',
    subjectsInput: '', // comma-separated
    hourlyRate: '',
    isPublicProfile: false,
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTutor();
  }, [tutorId]);

  const loadTutor = async () => {
    try {
      const response = await tutorApi.getTutor(tutorId);
      const tutorData = response.data;
      setTutor(tutorData);
      setFormData({
        fullName: tutorData.fullName || '',
        about: tutorData.about || '',
        photoUrl: tutorData.photoUrl || '',
        subjectsInput: (tutorData.subjects || []).join(', '),
        hourlyRate: tutorData.hourlyRate != null ? String(tutorData.hourlyRate) : '',
        isPublicProfile: tutorData.isPublicProfile || false,
      });
      if (tutorData.photoUrl) {
        setPhotoPreview(tutorData.photoUrl);
      }
    } catch {
      toast.error('Не удалось загрузить данные профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let photoUrl = formData.photoUrl;

      if (photoFile) {
        const uploadResponse = await tutorApi.uploadPhoto(photoFile);
        photoUrl = uploadResponse.data.photoUrl;
      }

      const subjects = formData.subjectsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await tutorApi.updateTutor(tutorId, {
        fullName: formData.fullName,
        about: formData.about,
        photoUrl,
        subjects,
        hourlyRate: formData.hourlyRate ? parseInt(formData.hourlyRate) : null,
        isPublicProfile: formData.isPublicProfile,
      });
      toast.success('Настройки сохранены');
      loadTutor();
    } catch {
      toast.error('Ошибка при сохранении настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <TutorNav tutorId={tutorId} activePage="settings" onLogout={onLogout} />
        <div className="settings-content">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <TutorNav tutorId={tutorId} activePage="settings" onLogout={onLogout} />
      <div className="settings-content">
        <div className="settings-header">
          <h1>Настройки</h1>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-section">
            <h2>Фото профиля</h2>
            <div className="photo-upload">
              <div className="photo-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" />
                ) : (
                  <div className="photo-placeholder">
                    <span>Нет фото</span>
                  </div>
                )}
              </div>
              <label className="file-input-label">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="file-input"
                />
                Выбрать фото
              </label>
            </div>
          </div>

          <div className="form-section">
            <h2>Личная информация</h2>
            <div className="form-group">
              <label htmlFor="fullName">ФИО</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="about">О себе</label>
              <textarea
                id="about"
                name="about"
                value={formData.about}
                onChange={handleChange}
                rows="6"
                placeholder="Расскажите о себе, своем опыте и специализации..."
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Профиль на платформе</h2>
            <div className="form-group">
              <label htmlFor="subjectsInput">Предметы (через запятую)</label>
              <input
                type="text"
                id="subjectsInput"
                name="subjectsInput"
                value={formData.subjectsInput}
                onChange={handleChange}
                placeholder="Математика, Физика, Программирование"
              />
            </div>
            <div className="form-group">
              <label htmlFor="hourlyRate">Стоимость занятия (₽/час)</label>
              <input
                type="number"
                id="hourlyRate"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleChange}
                placeholder="1500"
                min="0"
              />
            </div>
            <div className="form-group form-group--checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isPublicProfile}
                  onChange={e => setFormData(prev => ({ ...prev, isPublicProfile: e.target.checked }))}
                />
                <span>Показывать профиль в каталоге репетиторов</span>
              </label>
              <p className="form-hint">Ваш профиль появится в разделе «Репетиторы» для поиска учеников</p>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Settings;

