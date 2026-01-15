import { useReaderStore } from '../store';

export default function ProgressBar() {
  const { document, currentBlockIndex } = useReaderStore();

  if (!document || document.blocks.length === 0) {
    return null;
  }

  const progress = ((currentBlockIndex + 1) / document.blocks.length) * 100;

  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
