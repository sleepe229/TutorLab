import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LegalModal from '../legal/LegalModal';
import './Footer.css';

function Footer() {
  const [modal, setModal] = useState(null);

  return (
    <>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <div className="site-footer__logo">TL</div>
            <span className="site-footer__name">TutorLab</span>
          </div>
          <nav className="site-footer__links" aria-label="Нижнее меню">
            <Link to="/tutors">Репетиторы</Link>
            <button onClick={() => setModal('about')}>О платформе</button>
            <button onClick={() => setModal('privacy')}>Политика конфиденциальности</button>
            <button onClick={() => setModal('terms')}>Условия использования</button>
            <a href="mailto:support@tutorlab.ru">Поддержка</a>
          </nav>
          <p className="site-footer__copy">© {new Date().getFullYear()} TutorLab. Все права защищены.</p>
        </div>
      </footer>

      {modal && <LegalModal type={modal} onClose={() => setModal(null)} />}
    </>
  );
}

export default Footer;
