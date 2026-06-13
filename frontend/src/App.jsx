import { useState } from 'react';
import Nav from './components/Nav.jsx';
import Analyse from './pages/Analyse.jsx';
import Journal from './pages/Journal.jsx';
import Insights from './pages/Insights.jsx';
import styles from './App.module.css';

const PAGES = { analyse: Analyse, journal: Journal, insights: Insights };

export default function App() {
  const [tab, setTab] = useState('analyse');
  const Page = PAGES[tab];

  return (
    <div className={styles.app}>
      <Nav active={tab} onNavigate={setTab} />
      <main className={styles.main}>
        <Page />
      </main>
    </div>
  );
}
