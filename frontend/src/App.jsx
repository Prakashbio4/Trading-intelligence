import { useState, useEffect } from 'react';
import Nav from './components/Nav.jsx';
import Analyse from './pages/Analyse.jsx';
import Journal from './pages/Journal.jsx';
import Insights from './pages/Insights.jsx';
import Signals from './pages/Signals.jsx';
import Learn from './pages/Learn.jsx';
import Login from './pages/Login.jsx';
import { getMe, pingHealth } from './api/index.js';
import styles from './App.module.css';

const PAGES = { analyse: Analyse, journal: Journal, insights: Insights, signals: Signals, learn: Learn };

export default function App() {
  const [tab, setTab] = useState('analyse');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Ping backend immediately so Railway wakes up before the user needs it
    pingHealth().catch(() => {});

    const token = localStorage.getItem('sipy_token');
    if (!token) {
      setAuthChecked(true);
      return;
    }
    getMe()
      .then(u => setUser(u))
      .catch(() => {
        localStorage.removeItem('sipy_token');
        localStorage.removeItem('sipy_username');
      })
      .finally(() => setAuthChecked(true));
  }, []);

  function handleLogin(u) {
    setUser(u);
  }

  function handleLogout() {
    localStorage.removeItem('sipy_token');
    localStorage.removeItem('sipy_username');
    setUser(null);
  }

  if (!authChecked) return null;
  if (!user) return <Login onLogin={handleLogin} />;

  const Page = PAGES[tab];

  return (
    <div className={styles.app}>
      <Nav active={tab} onNavigate={setTab} user={user} onLogout={handleLogout} />
      <main className={styles.main}>
        <Page />
      </main>
    </div>
  );
}
