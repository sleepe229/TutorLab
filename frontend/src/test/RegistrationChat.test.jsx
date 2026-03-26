import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock GoogleAuthButton — it requires @react-oauth/google in the real component
vi.mock('../components/registration/GoogleAuthButton.jsx', () => ({
  default: ({ onSuccess, disabled }) => (
    <button data-testid="google-auth-btn" disabled={disabled} onClick={() => onSuccess({ id: 'g1' })}>
      Google
    </button>
  ),
}));

vi.mock('../services/api', () => ({
  tutorApi: {
    register: vi.fn(),
    login: vi.fn(),
  },
  studentAccountApi: {
    register: vi.fn(),
    login: vi.fn(),
  },
}));

import { tutorApi, studentAccountApi } from '../services/api';
import RegistrationChat from '../components/registration/RegistrationChat.jsx';

// Helper: advance all pending timers and flush async operations
async function flushTimers() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe('RegistrationChat', () => {
  const onRegister = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial render ──────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    // Header is always visible
    expect(screen.getByText('Добро пожаловать')).toBeInTheDocument();
  });

  it('shows tutor role label for tutor role', () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    expect(screen.getByText('Кабинет преподавателя')).toBeInTheDocument();
  });

  it('shows student role label for student role', () => {
    render(<RegistrationChat onRegister={onRegister} role="student" />);
    expect(screen.getByText('Кабинет ученика')).toBeInTheDocument();
  });

  it('shows Register/Login buttons after initial greeting fires', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    expect(screen.getByText('Зарегистрироваться')).toBeInTheDocument();
    expect(screen.getByText('Войти')).toBeInTheDocument();
  });

  it('shows Google auth button after initial greeting fires', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();
    expect(screen.getByTestId('google-auth-btn')).toBeInTheDocument();
  });

  it('renders back button when onBack prop is provided', () => {
    const onBack = vi.fn();
    render(<RegistrationChat onRegister={onRegister} role="tutor" onBack={onBack} />);
    const backBtn = screen.getByText('← Назад');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  // ── Mode selection ──────────────────────────────────────────────────────────

  it('shows input form after clicking Зарегистрироваться', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await flushTimers();

    // Input field should now be visible
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows input form after clicking Войти', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Войти'));
    await flushTimers();

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows "Уже есть аккаунт? Войти" link in register mode', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await flushTimers();

    expect(screen.getByText(/Уже есть аккаунт/)).toBeInTheDocument();
  });

  it('shows "Нет аккаунта? Зарегистрироваться" link in login mode', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Войти'));
    await flushTimers();

    expect(screen.getByText(/Нет аккаунта/)).toBeInTheDocument();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it('shows error on empty field submit', async () => {
    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await flushTimers();

    // Submit without typing anything
    const form = screen.getByRole('textbox').closest('form');
    fireEvent.submit(form);

    expect(screen.getByText('Пожалуйста, заполните это поле')).toBeInTheDocument();
  });

  // ── Tutor registration flow ─────────────────────────────────────────────────

  it('calls tutorApi.register with correct data after completing all steps', async () => {
    tutorApi.register.mockResolvedValue({
      data: { id: 't1', fullName: 'Иван', sessionToken: 'jwt', refreshToken: 'refresh' },
    });

    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    // Select register mode
    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await flushTimers();

    // Step 1: ФИО
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Иван Петров' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    // Step 2: Логин
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ivanpetrov' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    // Step 3: Пароль
    const passwordInput3 = document.querySelector('input[type="password"]') || screen.getByPlaceholderText(/пароль/i);
    fireEvent.change(passwordInput3, { target: { value: 'password123' } });
    fireEvent.submit(passwordInput3.closest('form'));
    await flushTimers();

    // Step 4: Подтверждение пароля
    const passwordInput4 = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput4, { target: { value: 'password123' } });
    fireEvent.submit(passwordInput4.closest('form'));
    await flushTimers();

    expect(tutorApi.register).toHaveBeenCalledWith({
      fullName: 'Иван Петров',
      login: 'ivanpetrov',
      password: 'password123',
    });
  });

  // ── Student registration flow ───────────────────────────────────────────────

  it('calls studentAccountApi.register after completing student steps', async () => {
    studentAccountApi.register.mockResolvedValue({
      data: { id: 'sa1', email: 'alice@example.com', studentToken: 'jwt' },
    });

    render(<RegistrationChat onRegister={onRegister} role="student" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Зарегистрироваться'));
    await flushTimers();

    // Step 1: Имя
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Алиса Иванова' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    // Step 2: Email
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alice@example.com' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    // Step 3: Пароль
    const pwd = document.querySelector('input[type="password"]');
    fireEvent.change(pwd, { target: { value: 'securepass' } });
    fireEvent.submit(pwd.closest('form'));
    await flushTimers();

    // Step 4: Подтверждение пароля
    const confirmPwd = document.querySelector('input[type="password"]');
    fireEvent.change(confirmPwd, { target: { value: 'securepass' } });
    fireEvent.submit(confirmPwd.closest('form'));
    await flushTimers();

    expect(studentAccountApi.register).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'securepass',
      firstName: 'Алиса',
      lastName: 'Иванова',
    });
  });

  // ── Login flow ──────────────────────────────────────────────────────────────

  it('calls tutorApi.login after completing login steps', async () => {
    tutorApi.login.mockResolvedValue({
      data: { id: 't1', sessionToken: 'jwt' },
    });

    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Войти'));
    await flushTimers();

    // Step 1: Логин
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mylogin' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    // Step 2: Пароль
    const pwd = document.querySelector('input[type="password"]');
    fireEvent.change(pwd, { target: { value: 'mypassword' } });
    fireEvent.submit(pwd.closest('form'));
    await flushTimers();

    expect(tutorApi.login).toHaveBeenCalledWith({
      login: 'mylogin',
      password: 'mypassword',
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('shows server error message when API returns 401 on login', async () => {
    tutorApi.login.mockRejectedValue({ response: { status: 401 } });

    render(<RegistrationChat onRegister={onRegister} role="tutor" />);
    await flushTimers();

    fireEvent.click(screen.getByText('Войти'));
    await flushTimers();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mylogin' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form'));
    await flushTimers();

    const pwd = document.querySelector('input[type="password"]');
    fireEvent.change(pwd, { target: { value: 'wrongpass' } });
    fireEvent.submit(pwd.closest('form'));
    await flushTimers();

    expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument();
  });
});
