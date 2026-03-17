import React, { useEffect, useState } from 'react';
import Joyride, { EVENTS, STATUS } from 'react-joyride';

const STORAGE_KEY = 'hasSeenOnboarding';

const STEPS = [
  {
    target: '.page-title',
    title: 'Добро пожаловать в TutorLab! 👋',
    content: 'Здесь вы можете управлять учениками и проводить онлайн-уроки с доской и PDF-презентациями.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.page-header-actions',
    title: 'Начать урок или добавить ученика',
    content: '«Начать урок» — откроет интерактивную доску с WebRTC-аудио. «+ Добавить ученика» — создаёт карточку с материалами и датами занятий.',
    placement: 'bottom',
  },
  {
    target: '.student-grid',
    title: 'Ваши ученики',
    content: 'Нажмите на карточку, чтобы открыть профиль ученика с историей уроков и материалами. Звёздочка добавляет в избранное.',
    placement: 'top',
  },
  {
    target: '[aria-label="Настройки профиля"]',
    title: 'Настройки профиля',
    content: 'Здесь можно изменить имя, добавить фото и описание.',
    placement: 'left',
  },
];

export default function Onboarding({ enabled = false }) {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setRun(true);
  }, [enabled]);

  const handleCallback = ({ type, status }) => {
    if (type === EVENTS.TOUR_END || status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(STORAGE_KEY, '1');
      setRun(false);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      callback={handleCallback}
      locale={{
        back: 'Назад',
        close: 'Закрыть',
        last: 'Готово',
        next: 'Далее',
        skip: 'Пропустить',
      }}
      styles={{
        options: {
          primaryColor: 'var(--accent-blue, #60a5fa)',
          textColor: '#1e293b',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        },
        tooltipTitle: {
          fontSize: '16px',
          fontWeight: 700,
        },
        buttonNext: {
          borderRadius: '8px',
          fontWeight: 600,
        },
        buttonBack: {
          borderRadius: '8px',
          fontWeight: 600,
        },
        buttonSkip: {
          borderRadius: '8px',
        },
      }}
    />
  );
}