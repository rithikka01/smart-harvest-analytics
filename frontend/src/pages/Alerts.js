import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { SourceBadge } from '@/components/SourceBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Alerts = () => {
  const { t } = useTranslation();
  const { currentFarm, loading: farmsLoading } = useFarm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (farmsLoading) return;
    if (!currentFarm) { setLoading(false); return; }
    setLoading(true);
    axios.get(`${BACKEND_URL}/api/farms/${currentFarm.id}/alerts`)
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [currentFarm?.id, farmsLoading]);

  const icon = (s) => s === 'critical' ? <AlertTriangle className="w-5 h-5 text-destructive" /> : s === 'warning' ? <Info className="w-5 h-5 text-accent" /> : <CheckCircle className="w-5 h-5 text-primary" />;
  const variant = (s) => s === 'critical' ? 'destructive' : s === 'warning' ? 'secondary' : 'default';
  const alerts = data?.alerts || [];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="alerts-title">{t('dashboard.alerts')}</h1>
            <p className="text-white/90">{currentFarm?.name}</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-4">
        {loading && <div className="loading-pulse text-primary text-center py-12">{t('common.loading')}</div>}
        {data && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SourceBadge source={data.source} /> {t('common.last_updated')}: {new Date(data.generated_at).toLocaleString()}
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <Card data-testid="no-alerts-card">
            <CardContent className="pt-6 text-center">
              <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="font-heading text-2xl font-bold mb-2">{t('dashboard.all_ok')}</h2>
            </CardContent>
          </Card>
        )}
        {alerts.map((alert, index) => (
          <Card key={alert.id || index} data-testid={`alert-${index}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {icon(alert.severity)}
                  <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                </div>
                <Badge variant={variant(alert.severity)}>{t(`status.${alert.severity}`)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{alert.severity === 'ok' ? t('dashboard.all_ok') : alert.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
