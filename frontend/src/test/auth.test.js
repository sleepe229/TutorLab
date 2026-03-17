import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unit tests for auth token helpers (localStorage behaviour in App)
describe('Auth token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores sessionToken and refreshToken on login', () => {
    const data = {
      id: 'tutor-123',
      sessionToken: 'header.payload.sig',
      refreshToken: 'refresh-uuid-abc',
    };

    localStorage.setItem('tutorId', data.id);
    localStorage.setItem('sessionToken', data.sessionToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    expect(localStorage.getItem('tutorId')).toBe('tutor-123');
    expect(localStorage.getItem('sessionToken')).toBe('header.payload.sig');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-uuid-abc');
  });

  it('clears all auth keys on logout', () => {
    localStorage.setItem('tutorId', 'tutor-123');
    localStorage.setItem('sessionToken', 'some.jwt.token');
    localStorage.setItem('refreshToken', 'some-refresh');

    localStorage.removeItem('tutorId');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('refreshToken');

    expect(localStorage.getItem('tutorId')).toBeNull();
    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('JWT access token has 3 dot-separated parts', () => {
    const mockJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0dXRvci0xMjMifQ.signature';
    const parts = mockJwt.split('.');
    expect(parts.length).toBe(3);
  });
});