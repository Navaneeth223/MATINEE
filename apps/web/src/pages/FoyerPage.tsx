import { useTranslation } from 'react-i18next';

export default function FoyerPage() {
  const { t } = useTranslation();
  
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{t('app_name')} — Foyer</h1>
      <p>{t('tagline')}</p>
    </div>
  );
}
