import React, { useState, useEffect, useRef } from 'react';
import { tutorApi, studentAccountApi } from '../../services/api';
import './RegistrationChat.css';

function RegistrationChat({ onRegister, role = 'tutor', onBack }) {
  const isStudent = role === 'student';

  const [mode, setMode] = useState(null); // 'register' | 'login'
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    fullName: '', login: '', email: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tutorRegisterSteps = [
    { question: 'Отлично! Начнём регистрацию. Как вас зовут?', field: 'fullName', label: 'ФИО', isPassword: false },
    { question: 'Придумайте логин:', field: 'login', label: 'Логин', isPassword: false },
    { question: 'Придумайте надёжный пароль:', field: 'password', label: 'Пароль', isPassword: true },
    { question: 'Подтвердите пароль:', field: 'confirmPassword', label: 'Подтверждение пароля', isPassword: true },
  ];
  const tutorLoginSteps = [
    { question: 'Введите логин:', field: 'login', label: 'Логин', isPassword: false },
    { question: 'Введите пароль:', field: 'password', label: 'Пароль', isPassword: true },
  ];
  const studentRegisterSteps = [
    { question: 'Как вас зовут?', field: 'fullName', label: 'Имя', isPassword: false },
    { question: 'Введите электронную почту:', field: 'email', label: 'Email', isPassword: false },
    { question: 'Придумайте пароль:', field: 'password', label: 'Пароль', isPassword: true },
    { question: 'Подтвердите пароль:', field: 'confirmPassword', label: 'Подтверждение', isPassword: true },
  ];
  const studentLoginSteps = [
    { question: 'Введите вашу почту:', field: 'email', label: 'Email', isPassword: false },
    { question: 'Введите пароль:', field: 'password', label: 'Пароль', isPassword: true },
  ];

  const getSteps = (m) => {
    if (!m) return [];
    if (isStudent) return m === 'register' ? studentRegisterSteps : studentLoginSteps;
    return m === 'register' ? tutorRegisterSteps : tutorLoginSteps;
  };
  const steps = getSteps(mode);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const addSystemMessage = (text, fast = false) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { type: 'system', text, timestamp: Date.now() }]);
      setIsTyping(false);
    }, fast ? 350 : 1000);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const greeting = isStudent
        ? 'Привет! Войдите или создайте аккаунт ученика.'
        : 'Привет! Начнём регистрацию или вы уже с нами?';
      addSystemMessage(greeting);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollToBottom();
    if (currentStep < steps.length && messages.length > 0) inputRef.current?.focus();
  }, [messages, currentStep, steps.length]);

  const addUserMessage = (text, isPasswordField = false) => {
    const display = isPasswordField ? '*'.repeat(text.length) : text;
    setMessages(prev => [...prev, { type: 'user', text: display, timestamp: Date.now() }]);
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    setCurrentStep(0);
    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    addUserMessage(selectedMode === 'register' ? 'Зарегистрироваться' : 'Войти');
    const fast = selectedMode === 'login';
    const stepsForMode = getSteps(selectedMode);
    setTimeout(() => addSystemMessage(stepsForMode[0].question, fast), fast ? 400 : 800);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setCurrentStep(0);
    setError('');
    setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    const stepsForMode = getSteps(newMode);
    addUserMessage(newMode === 'register' ? 'Зарегистрироваться' : 'Войти');
    setTimeout(() => addSystemMessage(stepsForMode[0].question, true), 400);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [steps[currentStep].field]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mode) return;

    const currentField = steps[currentStep].field;
    const value = formData[currentField].trim();
    if (!value) { setError('Пожалуйста, заполните это поле'); return; }

    if (mode === 'register' && currentField === 'confirmPassword' && value !== formData.password) {
      setError('Пароли не совпадают. Попробуйте ещё раз.');
      return;
    }

    setError('');
    addUserMessage(value, steps[currentStep].isPassword);

    if (currentStep < steps.length - 1) {
      const fast = mode === 'login';
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        addSystemMessage(getSteps(mode)[currentStep + 1].question, fast);
        setShowPassword(false);
        setShowConfirmPassword(false);
      }, fast ? 400 : 800);
    } else {
      setLoading(true);
      try {
        let response;
        if (isStudent) {
          if (mode === 'register') {
            const [firstName, ...rest] = formData.fullName.trim().split(' ');
            response = await studentAccountApi.register({
              email: formData.email.trim(),
              password: formData.password,
              firstName,
              lastName: rest.join(' '),
            });
          } else {
            response = await studentAccountApi.login({
              email: formData.email.trim(),
              password: formData.password,
            });
          }
        } else {
          if (mode === 'register') {
            response = await tutorApi.register({
              fullName: formData.fullName,
              login: formData.login,
              password: formData.password,
            });
          } else {
            response = await tutorApi.login({
              login: formData.login,
              password: formData.password,
            });
          }
        }
        addSystemMessage('Добро пожаловать! 🎉');
        setTimeout(() => onRegister(response.data), 1500);
      } catch (err) {
        const status = err.response?.status;
        const serverMsg = err.response?.data?.error || err.response?.data?.message;
        let errorText;
        if (mode === 'login') {
          errorText = (status === 401 || status === 403)
            ? (isStudent ? 'Неверный email или пароль' : 'Неверный логин или пароль')
            : 'Ошибка при входе. Попробуйте позже.';
        } else {
          if (serverMsg?.toLowerCase().includes('already') || serverMsg?.toLowerCase().includes('registered') || status === 409) {
            errorText = 'Аккаунт с таким email уже зарегистрирован';
          } else if (serverMsg?.toLowerCase().includes('password') || serverMsg?.toLowerCase().includes('пароль')) {
            errorText = 'Пароль должен содержать не менее 8 символов';
          } else if (status === 400) {
            errorText = serverMsg || 'Неверные данные. Проверьте введённые поля.';
          } else {
            errorText = 'Ошибка при регистрации. Попробуйте позже.';
          }
        }
        setError(errorText);
        addSystemMessage('Попробуйте ещё раз.', true);
        setCurrentStep(0);
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setLoading(false);
      }
    }
  };

  const currentField = steps[currentStep]?.field;
  const currentValue = formData[currentField] || '';
  const isPasswordField = steps[currentStep]?.isPassword || false;
  const shouldShowEye = isPasswordField && currentValue.length > 0;
  const isPasswordVisible = (currentField === 'password' && showPassword) ||
    (currentField === 'confirmPassword' && showConfirmPassword);

  const togglePasswordVisibility = () => {
    if (currentField === 'password') setShowPassword(!showPassword);
    else if (currentField === 'confirmPassword') setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="registration-chat-overlay">
      <div className="registration-chat-container">
        <div className="registration-chat-header">
          {onBack && (
            <button className="reg-back-btn" onClick={onBack} type="button">← Назад</button>
          )}
          <h1>
            {mode === 'login' ? 'Вход' : mode === 'register' ? 'Регистрация' : 'Добро пожаловать'}
          </h1>
          <p className="reg-role-label">
            {isStudent ? 'Кабинет ученика' : 'Кабинет преподавателя'}
          </p>
        </div>

        <div className="chat-messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.type === 'system' ? 'message-system' : 'message-user'}`}>
              <div className="message-content">{message.text}</div>
            </div>
          ))}

          {!mode && messages.length > 0 && !isTyping && (
            <div className="message message-system">
              <div className="message-content mode-buttons">
                <button type="button" className="mode-btn register-btn"
                  onClick={() => handleModeSelect('register')} disabled={loading}>
                  Зарегистрироваться
                </button>
                <button type="button" className="mode-btn login-btn"
                  onClick={() => handleModeSelect('login')} disabled={loading}>
                  Войти
                </button>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="message message-system">
              <div className="message-content typing-indicator">
                <span/><span/><span/>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {mode && (
          <form onSubmit={handleSubmit} className="chat-input-form">
            {error && <div className="error-message">{error}</div>}
            {isPasswordField && currentField === 'password' && currentValue.length > 0 && currentValue.length < 8 && (
              <div className="reg-password-hint">Минимум 8 символов</div>
            )}
            <div className="input-wrapper">
              <div className="input-container">
                <input
                  ref={inputRef}
                  type={isPasswordField && !isPasswordVisible ? 'password' : 'text'}
                  value={currentValue}
                  onChange={handleInputChange}
                  placeholder={`Введите ${steps[currentStep]?.label.toLowerCase()}`}
                  disabled={loading || isTyping}
                  className="chat-input"
                  autoFocus
                />
                {shouldShowEye && (
                  <button type="button" onClick={togglePasswordVisibility}
                    className="password-toggle-btn" tabIndex={-1}>
                    {isPasswordVisible ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M1 1l22 22M23 1L1 23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <button type="submit"
                disabled={loading || isTyping || !currentValue.trim()}
                className="chat-submit-btn"
                aria-label="Отправить">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="13 6 19 12 13 18"/>
                </svg>
              </button>
            </div>
            {mode === 'register' && (
              <button type="button" className="reg-switch-mode" onClick={() => switchMode('login')}>
                Уже есть аккаунт? Войти
              </button>
            )}
            {mode === 'login' && (
              <button type="button" className="reg-switch-mode" onClick={() => switchMode('register')}>
                Нет аккаунта? Зарегистрироваться
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default RegistrationChat;
