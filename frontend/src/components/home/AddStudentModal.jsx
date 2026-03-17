import React, { useState } from 'react';
import { studentApi } from '../../services/api';
import './AddStudentModal.css';

const INTERESTS_BY_CATEGORY = {
  'Учёба': [
    'Математика', 'Физика', 'Химия', 'Биология', 'История',
    'Литература', 'География', 'Информатика', 'Обществознание',
    'Геометрия', 'Алгебра', 'Астрономия', 'Экономика', 'Право'
  ],
  'Языки': [
    'Английский язык', 'Русский язык', 'Немецкий язык', 'Французский язык',
    'Испанский язык', 'Китайский язык', 'Японский язык', 'Итальянский язык'
  ],
  'Технологии': [
    'Программирование', 'Веб-разработка', 'Мобильные приложения',
    'Робототехника', 'Кибербезопасность', 'Искусственный интеллект',
    'Дизайн интерфейсов', '3D-моделирование'
  ],
  'Спорт': [
    'Футбол', 'Баскетбол', 'Волейбол', 'Теннис', 'Плавание',
    'Бег', 'Йога', 'Боевые искусства', 'Танцы', 'Гимнастика',
    'Велоспорт', 'Лыжи', 'Хоккей', 'Бокс'
  ],
  'Творчество': [
    'Рисование', 'Музыка', 'Пение', 'Игра на гитаре', 'Игра на фортепиано',
    'Фотография', 'Видеомонтаж', 'Писательство', 'Актерское мастерство',
    'Рукоделие', 'Скульптура', 'Граффити'
  ],
  'Хобби': [
    'Чтение', 'Коллекционирование', 'Настольные игры', 'Шахматы',
    'Готовка', 'Садоводство', 'Путешествия', 'Кино', 'Аниме',
    'Компьютерные игры', 'Косплей', 'Моделирование', 'Оригами'
  ],
  'Наука': [
    'Эксперименты', 'Исследования', 'Научные проекты', 'Олимпиады',
    'Конкурсы', 'Научная литература', 'Документальные фильмы'
  ]
};

function AddStudentModal({ tutorId, onClose, onStudentAdded }) {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    photo: null,
  });
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [showInterests, setShowInterests] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    if (e.target.name === 'photo') {
      const file = e.target.files[0];
      if (file) {
        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
          setError('Пожалуйста, выберите изображение.');
          return;
        }
        // Проверка размера файла (макс 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError('Размер файла не должен превышать 5MB.');
          return;
        }
        setFormData({
          ...formData,
          photo: file,
        });
        // Создаем превью
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoPreview(reader.result);
        };
        reader.readAsDataURL(file);
        setError('');
      }
    } else {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Разделяем полное имя на имя и фамилию
      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      if (!firstName) {
        setError('Пожалуйста, введите имя ученика.');
        setLoading(false);
        return;
      }

      let photoUrl = null;
      
      // Загружаем фото, если оно выбрано
      if (formData.photo) {
        try {
          photoUrl = await studentApi.uploadPhoto(formData.photo);
        } catch (uploadErr) {
          setError('Ошибка при загрузке фотографии. Попробуйте еще раз.');
          setLoading(false);
          return;
        }
      }

      const studentData = {
        firstName: firstName,
        lastName: lastName,
        age: parseInt(formData.age),
        photoUrl: photoUrl,
        interests: selectedInterests,
      };

      await studentApi.createStudent(tutorId, studentData);
      onStudentAdded();
    } catch {
      setError('Ошибка при создании ученика. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => 
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className={`modal-content ${showInterests ? 'expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить ученика</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body-wrapper">
          <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
              <label htmlFor="fullName">Имя и Фамилия *</label>
            <input
              type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
              onChange={handleChange}
                placeholder="Иван Иванов"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="age">Возраст *</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleChange}
              min="1"
              max="100"
                placeholder="12"
              required
            />
          </div>
          <div className="form-group">
              <label htmlFor="photo">Фотография</label>
            <input
                type="file"
                id="photo"
                name="photo"
                accept="image/*"
              onChange={handleChange}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label htmlFor="photo" className="file-upload-label">
                  {formData.photo ? 'Изменить фотографию' : 'Выбрать фотографию'}
                </label>
                {photoPreview && (
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '2px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    alignSelf: 'center',
                  }}>
                    <img
                      src={photoPreview}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}
              </div>
          </div>
          <div className="form-group">
              <button
                type="button"
                className="interests-toggle-btn"
                onClick={() => setShowInterests(!showInterests)}
              >
                {showInterests ? 'Скрыть интересы' : 'Указать интересы'}
                {selectedInterests.length > 0 && (
                  <span className="interests-count">({selectedInterests.length})</span>
                )}
              </button>
              {selectedInterests.length > 0 && (
                <div className="selected-interests">
                  {selectedInterests.map(interest => (
                    <span key={interest} className="selected-interest-tag">
                      {interest}
                      <button
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className="remove-interest-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
          
          {showInterests && (
            <div className="interests-panel">
              <h3>Выберите интересы</h3>
              <div className="interests-categories">
                {Object.entries(INTERESTS_BY_CATEGORY).map(([category, interests]) => (
                  <div key={category} className="interest-category">
                    <h4 className="category-title">{category}</h4>
                    <div className="interests-tags-container">
                      {interests.map(interest => (
                        <button
                          key={interest}
                          type="button"
                          className={`interest-tag ${selectedInterests.includes(interest) ? 'selected' : ''}`}
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddStudentModal;

