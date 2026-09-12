import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Loader2, BarChart3 } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { SourceBadge } from '@/components/SourceBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const METRICS = [
  { key: 'soil_moisture', label: 'dashboard.soil_moisture', color: '#2E7D32', unit: '%' },
  { key: 'humidity', label: 'dashboard.humidity', color: '#1E88E5', unit: '%' },
  { key: 'ambient_temperature', label: 'dashboard.air_temp', color: '#F9A825', unit: '°C' },
  { key: 'soil_temperature', label: 'dashboard.soil_temp', color: '#8D6E63', unit: '°C' },
  { key: 'light_intensity', label: 'dashboard.light', color: '#FB8C00', unit: ' lux' },
];

const Analytics = () => {
  const { t, i18n } = useTranslation();
  const { currentFarm } = useFarm();
  const [hours, setHours] = useState(24);
  const [history, setHistory] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!currentFarm) return;
    setHistory(null);
    axios.get(`${BACKEND_URL}/api/farms/${currentFarm.id}/sensors/history`, { params: { hours } })
      .then((r) => setHistory(r.data)).catch(() => toast.error(t('common.error')));
  }, [currentFarm?.id, hours]); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    if (!currentFarm) return;
    setDownloading(true);
    toast.message(t('analytics.downloading'));
    try {
      const res = await axios.get(`${BACKEND_URL}/api/farms/${currentFarm.id}/report`, { responseType: 'blob', timeout: 60000 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentFarm.name.replace(/[^a-z0-9]+/gi, '_')}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('analytics.downloaded'));
    } catch (e) {
      toast.error(t('common.error'));
    } finally {
      setDownloading(false);
    }
  };

  const data = (history?.points || []).map((p) => ({
    ...p,
    time: new Date(p.recorded_at).toLocaleString(i18n.language, hours <= 48 ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short', hour: '2-digit' }),
  }));

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-slate-700 to-slate-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1" data-testid="analytics-title">{t('analytics.title')}</h1>
            <p className="text-white/90">{t('analytics.subtitle')}</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[24, 168].map((h) => (
              <Button key={h} variant={hours === h ? 'default' : 'outline'} onClick={() => setHours(h)} className="rounded-full h-10" data-testid={`range-${h}h`}>
                {h === 24 ? t('analytics.range_24h') : t('analytics.range_7d')}
              </Button>
            ))}
            {history && <SourceBadge source={history.source} note={history.note} />}
          </div>
          <Button onClick={downloadPdf} disabled={downloading || !currentFarm} className="rounded-full h-11 px-5 font-bold" data-testid="download-pdf-button">
            {downloading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
            {t('analytics.download_pdf')}
          </Button>
        </div>

        {history?.source === 'simulated' && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-3" data-testid="analytics-simulated-note">{t('common.simulated_note')}</p>
        )}

        {!history && <div className="loading-pulse text-primary text-center py-12">{t('common.loading')}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {history && METRICS.map((m) => (
            <Card key={m.key} data-testid={`chart-${m.key}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" style={{ color: m.color }} />{t(m.label)}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} width={m.key === 'light_intensity' ? 56 : 36} />
                    <Tooltip formatter={(v) => `${v}${m.unit}`} />
                    <Line type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
