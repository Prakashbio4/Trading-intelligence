import styles from './Nav.module.css';

const TABS = [
  { id: 'learn',     label: 'Learn',     sub: 'Module 1' },
  { id: 'narrative', label: 'Narrative', sub: 'Module 2' },
  { id: 'validate',  label: 'Validate',  sub: 'Module 3' },
  { id: 'journal',   label: 'Journal',   sub: null },
  { id: 'insights',  label: 'Insights',  sub: null },
];

export default function Nav({ active, onNavigate, user, onLogout }) {
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
      {user && (
        <div className={styles.userArea}>
          <span className={styles.username}>{user.username}</span>
          <button className={styles.logoutBtn} onClick={onLogout}>Logout</button>
        </div>
      )}
    </header>
  );
}
