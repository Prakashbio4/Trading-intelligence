import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
        Charts powered by TradingView
      </a>
    </footer>
  );
}
