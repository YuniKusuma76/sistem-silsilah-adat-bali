import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p className={styles.footerContent}>
        &copy; 2026 Sistem Silsilah Adat Bali | DBTC | Bali Culture
      </p>
    </footer>
  );
};

export default Footer;