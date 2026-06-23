import { useRef, useState } from 'react';
import styles from './UploadZone.module.css';

export default function UploadZone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
        disabled={disabled}
      />
      {preview ? (
        <img src={preview} alt="chart preview" className={styles.preview} />
      ) : (
        <div className={styles.prompt}>
          <span className={styles.icon}>↑</span>
          <span className={styles.label}>Drop chart here or click to upload</span>
          <span className={styles.hint}>Side-by-side screenshot — last 7–10 candles on the left, 1-year chart with indicators on the right</span>
        </div>
      )}
    </div>
  );
}
