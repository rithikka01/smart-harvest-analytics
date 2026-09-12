import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Droplets, Loader2, CheckCircle, AlertCircle, Clock, PauseCircle } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { SourceBadge } from '@/components/SourceBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const DECISION = {
  water_now: { icon: AlertCircle, cls: 'border-blue-600 bg-blue-50', text: 'text-blue-700', label: 'irrigation.water_now' },
  wait: { icon: PauseCircle, cls: 'border-yellow-500 bg-yellow-50', text: 'text-yellow-700', label: 'irrigation.wait' },
  not_needed: { icon: CheckCircle, cls: 'border-green-600 bg-green-50', text: 'text-green-700', label: 'irrigation.not_needed' },
};

const Irrigation = () => {
  const { t } = useTranslation();
  const { currentFarm } = useFarm();
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!currentFarm) return toast.error(t('common.no_farm'));
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/irrigation/recommend?farm_id=${currentFarm.id}`);
      setRec(res.data);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const d = rec ? DECISION[rec.decision] || DECISION.not_needed : null;
  const Icon = d?.icon;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1" data-testid="irrigation-title">{t('irrigation.title')}</h1>
            <p className="text-white/90">{t('irrigation.subtitle')}</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Droplets className="w-16 h-16 mx-auto text-blue-600 mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-2">{t('irrigation.check_title')}</h2>
            <p className="text-muted-foreground mb-6">{t('irrigation.check_hint')}</p>
            <Button onClick={check} disabled={loading || !currentFarm} className="h-12 px-8 rounded-full font-bold bg-blue-600 hover:bg-blue-700" data-testid="check-irrigation-button">
              {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('common.loading')}</> : t('irrigation.check')}
            </Button>
          </CardContent>
        </Card>

        {rec && (
          <Card className={`border-2 ${d.cls}`} data-testid="irrigation-recommendation-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
                <span className={`flex items-center gap-3 ${d.text}`}><Icon className="w-8 h-8" /><span data-testid="irrigation-decision">{t(d.label)}</span></span>
                <SourceBadge source={rec.data_source} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg" data-testid="irrigation-reason">{rec.reason}</p>
              {rec.water_amount && (
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">{t('irrigation.water_amount')} <span className="text-xs">({t('common.estimate')})</span></p>
                  <p className="text-3xl font-bold text-blue-600" data-testid="water-amount">{rec.water_amount.toLocaleString()} {t('irrigation.liters')} <span className="text-base text-muted-foreground">≈ {rec.water_m3} m³</span></p>
                  <p className="text-xs text-muted-foreground mt-2">{rec.estimate_note}</p>
                </div>
              )}
              <div className="flex items-start gap-2 text-sm"><Clock className="w-4 h-4 mt-0.5 text-blue-600" /><span><b>{t('irrigation.timing')}:</b> {rec.timing}</span></div>
              <div>
                <p className="text-sm font-semibold mb-1">{t('irrigation.factors')}</p>
                <ul className="text-sm text-muted-foreground space-y-1">{rec.factors.map((f) => <li key={f}>• {f}</li>)}</ul>
              </div>
              <p className="text-xs text-muted-foreground">{t('common.method')}: {rec.method}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Irrigation;
