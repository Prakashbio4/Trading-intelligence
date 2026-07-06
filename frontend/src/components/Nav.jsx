import styles from './Nav.module.css';

const TABS = [
  { id: 'analyse',  label: 'Analyse'  },
  { id: 'journal',  label: 'Journal'  },
  { id: 'learn',    label: 'Learn' },
  { id: 'insights', label: 'Insights' },
  { id: 'signals',  label: 'Signals' },
];

export default function Nav({ active, onNavigate, user, onLogout }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandName}>SIPY</span>
        <span className={styles.brandSub}>Wick</span>
      </div>
      <nav className={styles.nav}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {user && (
        <div className={styles.userArea}>
          <span className={styles.username}>{user.username}</span>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      )}
    </header>
  );
}
