import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Footer from '../ui/Footer';
import '../legal/LegalPage.css';

function AboutPage() {
  return (
    <>
      <Helmet>
        <title>О платформе — TutorLab</title>
        <meta name="description" content="TutorLab — бесплатный онлайн-инструмент для репетиторов: управление учениками, живые уроки с интерактивной доской, маркетплейс." />
        <link rel="canonical" href="https://tutorlab.onrender.com/about" />
        <meta property="og:title" content="О платформе TutorLab" />
        <meta property="og:description" content="TutorLab — онлайн-инструмент для репетиторов: управление учениками, живые уроки с интерактивной доской и маркетплейс." />
        <meta property="og:url" content="https://tutorlab.onrender.com/about" />
      </Helmet>

      <div className="legal-page">
        <header className="legal-header">
          <Link to="/tutors" className="legal-brand">
            <div className="legal-logo">TL</div>
            <span>TutorLab</span>
          </Link>
        </header>

        <main className="legal-content">
          <h1>О платформе TutorLab</h1>

          <p style={{ fontSize: '17px', lineHeight: 1.7, marginBottom: '40px' }}>
            TutorLab — бесплатный онлайн-инструмент для частных репетиторов. Платформа объединяет
            всё необходимое для работы: управление учениками, планирование расписания, живые
            онлайн-уроки с интерактивной доской и публичный маркетплейс для поиска учеников.
          </p>

          <section>
            <h2>Возможности</h2>
            <ul>
              <li>Управление списком учеников: профили, заметки, история занятий</li>
              <li>Живые онлайн-уроки с синхронной интерактивной доской</li>
              <li>Загрузка PDF-презентаций с автоматическим переводом в слайды</li>
              <li>Видео и аудио связь через WebRTC прямо в браузере</li>
              <li>Расписание занятий с календарным видом</li>
              <li>Личный кабинет ученика с доступом к материалам и истории</li>
              <li>Маркетплейс репетиторов для поиска новых учеников</li>
              <li>AI-саммари урока по его конспекту</li>
            </ul>
          </section>

          <section>
            <h2>Технологии</h2>
            <p>
              Бэкенд: Spring Boot (Java 21) + Redis. Фронтенд: React. Видеосвязь: WebRTC (simple-peer).
              Интерактивная доска: Canvas API + WebSocket (STOMP/SockJS). Хостинг: Render.com.
              AI-функции: Claude API (Anthropic).
            </p>
          </section>

          <section>
            <h2>Для кого</h2>
            <p>
              Платформа создана для частных репетиторов, которые ведут занятия онлайн и хотят
              избавиться от необходимости использовать несколько разных инструментов — отдельно
              для расписания, материалов, видеосвязи и общения с учениками.
            </p>
          </section>

          <section>
            <h2>Контакты</h2>
            <p>
              Поддержка: <a href="mailto:support@tutorlab.ru">support@tutorlab.ru</a>
            </p>
            <p style={{ marginTop: '16px' }}>
              <Link to="/tutors">Найти репетитора →</Link>
            </p>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}

export default AboutPage;