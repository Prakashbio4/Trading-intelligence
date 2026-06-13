import styles from './Placeholder.module.css';

export default function Insights() {
  return (
    <div className={styles.wrap}>
      <div className={styles.tag}>Insights</div>
      <h1 className={styles.title}>Aggregated Learning Data</h1>
      <p className={styles.desc}>
        Unlocks after 20 journal entries. Complete more sessions to activate your personal weakness map and pattern stats.
      </p>
    </div>
  );
}
