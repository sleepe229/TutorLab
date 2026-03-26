import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// api.js reads API_BASE from config.js which reads VITE_API_URL.
// In the test environment this is undefined, so API_BASE resolves to '' or undefined.
// We import the module and let the interceptors run against mocked axios responses.
let api, tutorApi, studentApi;

describe('API axios interceptors', () => {
  let mock;

  beforeEach(async () => {
    // Reset module registry so each describe block gets fresh interceptor state
    vi.resetModules();
    localStorage.clear();

    // Mock config.js to avoid VITE env var issues
    vi.doMock('../config.js', () => ({ API_BASE: '', WS_URL: '' }));

    const module = await import('../services/api.js');
    api = module.default;
    tutorApi = module.tutorApi;
    studentApi = module.studentApi;

    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.restore();
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Request interceptor ────────────────────────────────────────────────────

  it('attaches X-Session-Token from localStorage if present', async () => {
    localStorage.setItem('sessionToken', 'my.jwt.token');
    mock.onGet('/api/tutors/me').reply((config) => {
      expect(config.headers['X-Session-Token']).toBe('my.jwt.token');
      return [200, { id: '1' }];
    });
    await api.get('/api/tutors/me');
  });

  it('does NOT attach X-Session-Token if localStorage is empty', async () => {
    mock.onGet('/api/tutors/me').reply((config) => {
      expect(config.headers['X-Session-Token']).toBeUndefined();
      return [200, {}];
    });
    await api.get('/api/tutors/me');
  });

  // ── Response interceptor – auth endpoints skip refresh ────────────────────

  it('does NOT trigger refresh on 401 from /tutors/login', async () => {
    mock.onPost('/api/tutors/login').reply(401, { error: 'Invalid credentials' });
    // No refreshToken in localStorage — if refresh were attempted it would throw
    await expect(api.post('/api/tutors/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('does NOT trigger refresh on 401 from /tutors/register', async () => {
    mock.onPost('/api/tutors/register').reply(401, { error: 'err' });
    await expect(api.post('/api/tutors/register', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  // ── Tutor token — 401 handling without refreshToken ──────────────────────

  it('clears tutor auth if no refreshToken in localStorage on 401', async () => {
    localStorage.setItem('sessionToken', 'expired.token');
    // No refreshToken set
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/' },
    });

    mock.onGet('/api/students').replyOnce(401);

    await expect(api.get('/api/students')).rejects.toBeDefined();
    expect(localStorage.getItem('sessionToken')).toBeNull();
  });

  // ── Student token — 401 without studentRefreshToken clears auth ───────────

  it('clears student auth if no studentRefreshToken on 401 student request', async () => {
    localStorage.setItem('studentToken', 'expired.student.token');
    // No studentRefreshToken set
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '/tutors' },
    });

    mock.onGet('/api/chat-resource').replyOnce(401);

    await expect(
      api.get('/api/chat-resource', {
        headers: { 'X-Student-Token': 'expired.student.token' },
      })
    ).rejects.toBeDefined();

    expect(localStorage.getItem('studentToken')).toBeNull();
    expect(localStorage.getItem('studentAccountId')).toBeNull();
  });
});

// ── tutorApi helpers ─────────────────────────────────────────────────────────
describe('tutorApi surface', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    vi.doMock('../config.js', () => ({ API_BASE: '', WS_URL: '' }));
    const module = await import('../services/api.js');
    tutorApi = module.tutorApi;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('tutorApi exposes register, login, getTutor, updateTutor, uploadPhoto', () => {
    expect(typeof tutorApi.register).toBe('function');
    expect(typeof tutorApi.login).toBe('function');
    expect(typeof tutorApi.getTutor).toBe('function');
    expect(typeof tutorApi.updateTutor).toBe('function');
    expect(typeof tutorApi.uploadPhoto).toBe('function');
  });
});

// ── studentApi helpers ────────────────────────────────────────────────────────
describe('studentApi surface', () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    vi.doMock('../config.js', () => ({ API_BASE: '', WS_URL: '' }));
    const module = await import('../services/api.js');
    studentApi = module.studentApi;
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('studentApi exposes createStudent, getStudent, getStudentsByTutor, deleteStudent, addLessonDate', () => {
    expect(typeof studentApi.createStudent).toBe('function');
    expect(typeof studentApi.getStudent).toBe('function');
    expect(typeof studentApi.getStudentsByTutor).toBe('function');
    expect(typeof studentApi.deleteStudent).toBe('function');
    expect(typeof studentApi.addLessonDate).toBe('function');
  });
});
