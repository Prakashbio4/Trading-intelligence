import styles from './Nav.module.css';

const TABS = [
  { id: 'analyse',  label: 'Analyse',  sub: null },
  { id: 'journal',  label: 'Journal',  sub: null },
  { id: 'insights', label: 'Insights', sub: null },
];

export default function Nav({ active, onNavigate }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandName}>SIPY</span>
        <span className={styles.brandSub}>Capital</span>
      </div>
      <nav className={styles.nav}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.label}
            {tab.sub && <span className={styles.tabSub}>{tab.sub}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}
