import { useState, type ReactNode } from 'react';
import { coverUrl } from '../api';
import { useI18n } from '../i18n';
import { Icon, type IconName } from './Icon';

export function Cover({ albumId, hasCover, alt = '', round = false }: { albumId: number | null; hasCover: boolean | number; alt?: string; round?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = `cover${round ? ' cover-round' : ''}`;
  if (!albumId || !hasCover || failed) {
    return (
      <div className={`${className} cover-empty`} aria-hidden="true">
        <Icon name="music" size={28} />
      </div>
    );
  }
  return <img className={className} src={coverUrl(albumId)} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export function Loading() {
  const { t } = useI18n();
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{t.loading}</span>
    </div>
  );
}

export function ErrorState({ onRetry, notFound = false }: { onRetry?: () => void; notFound?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="state">
      <p>{notFound ? t.notFound : t.error}</p>
      {onRetry && !notFound && (
        <button className="button button-secondary" onClick={onRetry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active = false,
  size = 20,
  className = '',
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button${active ? ' is-active' : ''} ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
