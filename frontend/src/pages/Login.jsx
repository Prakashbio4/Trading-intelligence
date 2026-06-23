import { useState } from 'react';
import { login } from '../api/index.js';
import styles from './Login.module.css';

async function loginWithRetry(username, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await login(username);
    } catch (err) {
      const isNetworkErr = err.message === 'Failed to fetch' || err.message?.includes('NetworkError');
      if (isNetworkErr && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return setError('Please enter a username.');
    if (!/^[a-z0-9_]{2,20}$/.test(trimmed)) {
      return setError('Username must be 2-20 characters: letters, numbers, underscores only.');
    }

    setLoading(true);
    try {
      const data = await loginWithRetry(trimmed);
      localStorage.setItem('sipy_token', data.token);
      localStorage.setItem('sipy_username', data.user.username);
      onLogin(data.user);
    } catch (err) {
      const isNetwork = err.message === 'Failed to fetch' || err.message?.includes('NetworkError');
      setError(isNetwork
        ? 'Server is starting up — please wait a moment and try again.'
        : (err.message || 'Login failed. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandName}>SIPY</span>
          <span className={styles.brandSub}>Capital</span>
        </div>
        <p className={styles.tagline}>Type your name to get started</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
