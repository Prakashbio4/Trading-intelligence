import { useState } from 'react';
import Nav from './components/Nav.jsx';
import Learn from './pages/Learn.jsx';
import Narrative from './pages/Narrative.jsx';
import Validate from './pages/Validate.jsx';
import Journal from './pages/Journal.jsx';
import Insights from './pages/Insights.jsx';
import styles from './App.module.css';

const PAGES = { learn: Learn, narrative: Narrative, validate: Validate, journal: Journal, insights: Insights };

export default function App() {
  const [tab, setTab] = useState('learn');
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
