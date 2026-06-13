import styles from './Placeholder.module.css';

export default function Narrative() {
  return (
    <div className={styles.wrap}>
      <div className={styles.tag}>Module 2</div>
      <h1 className={styles.title}>Narrative Builder</h1>
      <p className={styles.desc}>
        Available in Phase 3 — once you have built pattern recognition through Module 1.
        <br />Complete 20+ Module 1 sessions to unlock.
      </p>
    </div>
  );
}
