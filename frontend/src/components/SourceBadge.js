import React from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, FlaskConical } from 'lucide-react';

export const SourceBadge = ({ source, note, className = '' }) => {
  const { t } = useTranslation();
  const live = source === 'firebase';
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        live ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
      } ${className}`}
      title={note || (live ? t('common.live') : t('common.simulated_note'))}
      data-testid="data-source-badge"
    >
      {live ? <Radio className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
      {live ? t('common.live') : t('common.simulated')}
    </div>
  );
};

export const statusClasses = (status) => {
  switch (status) {
    case 'normal':
    case 'ok':
    case 'optimal':
      return { bg: 'bg-green-50 border-green-300', text: 'text-green-700', dot: 'bg-green-500' };
    case 'warning':
      return { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-500' };
    case 'critical':
      return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', dot: 'bg-red-500' };
    default:
      return { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', dot: 'bg-gray-400' };
  }
};
