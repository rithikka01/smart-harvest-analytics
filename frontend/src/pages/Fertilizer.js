import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FlaskConical, Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const NUTRIENTS = ['nitrogen', 'phosphorus', 'potassium'];
const STATUS_STYLE = { low: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-green-100 text-green-700', unknown: 'bg-gray-100 text-gray-600' };

const Fertilizer = () => {
  const { t, i18n } = useTranslation();
  const { currentFarm } = useFarm();
  const [form, setForm] = useState({ nitrogen: '', phosphorus: '', potassium: '' });
  const [includeAi, setIncludeAi] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!currentFarm) return toast.error(t('common.no_farm'));
    setLoading(true);
    try {
      const body = { farm_id: currentFarm.id, include_ai: includeAi, language: i18n.language };
      NUTRIENTS.forEach((n) => { body[n] = form[n] === '' ? null : parseFloat(form[n]); });
      const r = await axios.post(`${BACKEND_URL}/api/fertilizer/recommend`, body);
      setResult(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-purple-700 to-purple-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-1" data-testid="fertilizer-title">{t('fert.title')}</h1>
            <p className="text-white/90">{t('fert.subtitle')}</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="space-y-5" data-testid="fertilizer-form">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {NUTRIENTS.map((n) => (
                  <div className="space-y-2" key={n}>
                    <Label>{t(`fert.${n}`)}</Label>
                    <Input type="number" step="1" min="0" placeholder={t('fert.unit')} value={form[n]} onChange={(e) => setForm({ ...form, [n]: e.target.value })} className="h-12" data-testid={`${n}-input`} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('fert.unit')}</p>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-600" />{t('fert.include_ai')}</Label>
                <Switch checked={includeAi} onCheckedChange={setIncludeAi} data-testid="include-ai-switch" />
              </div>
              <Button type="submit" disabled={loading || !currentFarm} className="w-full h-12 rounded-full font-bold bg-purple-700 hover:bg-purple-800" data-testid="fertilizer-submit-button">
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FlaskConical className="mr-2 h-5 w-5" />}
                {t('fert.get')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4" data-testid="fertilizer-result">
            <Card>
              <CardHeader><CardTitle>{t('fert.status')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {NUTRIENTS.map((n) => (
                    <div key={n} className={`rounded-xl p-4 text-center ${STATUS_STYLE[result.status[n]]}`} data-testid={`${n}-status`}>
                      <p className="text-xs font-medium uppercase opacity-80">{t(`fert.${n}`).split(' ')[0]}</p>
                      <p className="text-xl font-bold">{t(`fert.${result.status[n]}`)}</p>
                      <p className="text-xs">{result.inputs[n] ?? '--'} kg/ha</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">{result.rating_reference}</p>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary">
              <CardHeader><CardTitle className="text-primary">{t('common.recommendations')}</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2"><CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" /><span>{r}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {(result.ai_advice || result.ai_note) && (
              <Card className="border-purple-300" data-testid="ai-advice-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700"><Sparkles className="w-5 h-5" />{t('fert.ai_advice')}
                    <span className="text-xs font-normal bg-purple-100 text-purple-800 rounded-full px-2 py-0.5">{t('common.ai_generated')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.ai_advice && <p className="whitespace-pre-wrap text-sm">{result.ai_advice}</p>}
                  {result.ai_note && <p className="text-xs text-muted-foreground">{result.ai_note}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fertilizer;
