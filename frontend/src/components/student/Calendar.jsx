import React, { useState } from 'react';
import './Calendar.css';

function Calendar({ lessons = [], onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  // Преобразуем день недели: воскресенье (0) -> 6, остальные дни сдвигаем на -1
  let startingDayOfWeek = firstDayOfMonth.getDay();
  startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  
  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  const formatDateKey = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const hasLesson = (day) => {
    const dateStr = formatDateKey(new Date(year, month, day));
    return lessons.some(lesson => lesson.date === dateStr);
  };
  
  const getLesson = (day) => {
    const dateStr = formatDateKey(new Date(year, month, day));
    return lessons.find(lesson => lesson.date === dateStr);
  };
  
  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };
  
  const isPast = (day) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  const handleDateClick = (day) => {
    if (isPast(day)) return;
    const dateStr = formatDateKey(new Date(year, month, day));
    onDateClick(dateStr, getLesson(day));
  };
  
  const renderCalendarDays = () => {
    const days = [];
    
    // Пустые ячейки для дней до начала месяца
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="calendar-day empty"></div>
      );
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const lesson = getLesson(day);
      const hasLessonOnDay = hasLesson(day);
      const dayIsToday = isToday(day);
      const dayIsPast = isPast(day);
      
      days.push(
        <div
          key={day}
          className={`calendar-day ${hasLessonOnDay ? 'has-lesson' : ''} ${dayIsToday ? 'today' : ''} ${dayIsPast ? 'past' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          <span className="day-number">{day}</span>
          {hasLessonOnDay && (
            <div className="lesson-indicator">
              <span className="lesson-time">{lesson.time}</span>
            </div>
          )}
        </div>
      );
    }
    
    return days;
  };
  
  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={goToPreviousMonth}>
          ←
        </button>
        <div className="calendar-month-year">
          <h3>{monthNames[month]} {year}</h3>
          <button className="today-btn" onClick={goToToday}>Сегодня</button>
        </div>
        <button className="calendar-nav-btn" onClick={goToNextMonth}>
          →
        </button>
      </div>
      
      <div className="calendar-weekdays">
        {weekDays.map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>
      
      <div className="calendar-grid">
        {renderCalendarDays()}
      </div>
    </div>
  );
}

export default Calendar;

