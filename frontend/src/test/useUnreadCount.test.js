import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnreadCount } from '../hooks/useUnreadCount.js';

// Mock the api module
vi.mock('../services/api', () => ({
  chatApi: {
    getTutorChats: vi.fn(),
    getStudentChats: vi.fn(),
  },
}));

import { chatApi } from '../services/api';

// Flush all pending microtasks and React state updates
async function flushAsync() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('useUnreadCount', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // reset implementations + call history
  });

  it('returns 0 before the first fetch completes', () => {
    chatApi.getTutorChats.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useUnreadCount('TUTOR', 'tutor-1', null));
    expect(result.current).toBe(0);
  });

  it('returns 0 when senderId is not provided', async () => {
    const { result } = renderHook(() => useUnreadCount('TUTOR', null, null));
    await flushAsync();
    expect(result.current).toBe(0);
    expect(chatApi.getTutorChats).not.toHaveBeenCalled();
  });

  it('aggregates unreadCountTutor for TUTOR role', async () => {
    chatApi.getTutorChats.mockResolvedValue({
      data: [
        { id: 'c1', unreadCountTutor: 3 },
        { id: 'c2', unreadCountTutor: 5 },
        { id: 'c3', unreadCountTutor: 0 },
      ],
    });

    const { result } = renderHook(() => useUnreadCount('TUTOR', 'tutor-1', null));
    await flushAsync();

    expect(result.current).toBe(8);
  });

  it('aggregates unreadCountStudent for STUDENT role', async () => {
    chatApi.getStudentChats.mockResolvedValue({
      data: [
        { id: 'c1', unreadCountStudent: 2 },
        { id: 'c2', unreadCountStudent: 4 },
      ],
    });

    const { result } = renderHook(() =>
      useUnreadCount('STUDENT', 'student-account-1', 'jwt-token')
    );
    await flushAsync();

    expect(result.current).toBe(6);
    expect(chatApi.getStudentChats).toHaveBeenCalledWith('student-account-1', 'jwt-token');
  });

  it('calls getTutorChats with the correct senderId', async () => {
    chatApi.getTutorChats.mockResolvedValue({ data: [] });
    renderHook(() => useUnreadCount('TUTOR', 'tutor-99', null));
    await flushAsync();
    expect(chatApi.getTutorChats).toHaveBeenCalledWith('tutor-99');
  });

  it('silently ignores API errors and returns 0', async () => {
    chatApi.getTutorChats.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useUnreadCount('TUTOR', 'tutor-1', null));
    await flushAsync();
    expect(result.current).toBe(0);
  });

  it('polls every 30 seconds via setInterval', async () => {
    vi.useFakeTimers();
    try {
      chatApi.getTutorChats
        .mockResolvedValueOnce({ data: [{ id: 'c1', unreadCountTutor: 1 }] })
        .mockResolvedValueOnce({ data: [{ id: 'c1', unreadCountTutor: 7 }] });

      const { result } = renderHook(() => useUnreadCount('TUTOR', 'tutor-1', null));

      // Flush initial effect (first call) using advanceTimersByTimeAsync to avoid infinite loop
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(result.current).toBe(1);

      // Advance timer by 30 seconds to trigger second poll
      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(result.current).toBe(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears polling interval on unmount', async () => {
    chatApi.getTutorChats.mockResolvedValue({ data: [] });
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() => useUnreadCount('TUTOR', 'tutor-1', null));
    await flushAsync();
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
