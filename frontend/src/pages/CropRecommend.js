import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wheat, Loader2, Wand2, Info } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const FIELDS = [
  { key: 'temperature', label: 'reco.temperature', step: '0.1' },
  { key: 'humidity', label: 'reco.humidity', step: '0.1' },
  { key: 'ph', label: 'reco.ph', step: '0.1' },
  { key: 'rainfall', label: 'reco.rainfall', step: '1' },
];

const CropRecommend = () => {
  const { t } = useTranslation();
  const { currentFarm } = useFarm();
  const [form, setForm] = useState({ temperature: '', humidity: '', ph: '', rainfall: '' });
  const [sources, setSources] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filling, setFilling] = useState(false);

  const autofill = async () => {
    if (!currentFarm) return toast.error(t('common.no_farm'));
    setFilling(true);
    try {
      const r = await axios.get(`${BACKEND_URL}/api/farms/${currentFarm.id}/recommend-autofill`);
      setForm((p) => ({
        temperature: r.data.temperature ?? p.temperature, humidity: r.data.humidity ?? p.humidity,
        ph: r.data.ph ?? p.ph, rainfall: r.data.rainfall ?? p.rainfall,
      }));
      setSources(r.data.sources);
    } catch (e) {
      toast.error(t('common.error'));
    } finally {
      setFilling(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parseFloat(v)]));
      const r = await axios.post(`${BACKEND_URL}/api/crop/recommend`, body);
      setResult(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-lime-700 to-lime-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1" data-testid="crop-recommend-title">{t('reco.title')}</h1>
          <p className="text-white/90">{t('reco.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-5" data-testid="crop-recommend-form">
              <Button type="button" variant="outline" onClick={autofill} disabled={filling || !currentFarm} className="w-full h-12 rounded-full" data-testid="autofill-button">
                {filling ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                {t('reco.autofill')} {currentFarm ? `(${currentFarm.name})` : ''}
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <div className="space-y-2" key={f.key}>
                    <Label>{t(f.label)}</Label>
                    <Input type="number" step={f.step} required value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="h-12" data-testid={`${f.key}-input`} />
                    {sources?.[f.key] && <p className="text-xs text-muted-foreground">{t('common.source')}: {sources[f.key]}</p>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3.5 h-3.5" />{t('reco.ph_hint')}</p>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-full font-bold bg-lime-700 hover:bg-lime-800" data-testid="recommend-button">
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wheat className="mr-2 h-5 w-5" />}
                {t('reco.recommend')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-2 border-lime-600" data-testid="recommend-result">
            <CardHeader>
              <CardTitle>
                <p className="text-sm text-muted-foreground font-normal">{t('reco.best')}</p>
                <p className="text-4xl font-bold text-lime-700 capitalize" data-testid="recommended-crop">{result.recommended_crop}</p>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('reco.top5')}</h3>
                <ul className="space-y-2">
                  {result.top_recommendations.map((r, i) => (
                    <li key={r.crop} className="flex items-center gap-3" data-testid={`top-crop-${i}`}>
                      <span className="w-28 capitalize font-medium">{r.crop}</span>
                      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-lime-600 rounded-full transition-all" style={{ width: `${Math.max(2, r.confidence * 100)}%` }} />
                      </div>
                      <span className="w-14 text-right text-sm font-semibold">{(r.confidence * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              {result.warnings?.map((w) => <p key={w} className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">{w}</p>)}
              <p className="text-xs text-muted-foreground" data-testid="model-metrics">
                {result.model} · {t('reco.accuracy')}: {(result.metrics.test_accuracy * 100).toFixed(1)}% (held-out {result.metrics.test_rows} rows)
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CropRecommend;
