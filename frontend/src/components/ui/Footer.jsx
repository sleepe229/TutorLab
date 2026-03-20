import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__logo">TL</div>
          <span className="site-footer__name">TutorLab</span>
        </div>
        <nav className="site-footer__links" aria-label="Нижнее меню">
          <Link to="/tutors">Репетиторы</Link>
          <Link to="/about">О платформе</Link>
          <Link to="/privacy">Политика конфиденциальности</Link>
          <Link to="/terms">Условия использования</Link>
          <a href="mailto:support@tutorlab.ru">Поддержка</a>
        </nav>
        <p className="site-footer__copy">© {new Date().getFullYear()} TutorLab. Все права защищены.</p>
      </div>
    </footer>
  );
}

export default Footer;