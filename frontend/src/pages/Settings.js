import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useFarm } from '@/contexts/FarmContext';
import { LANGUAGES } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Globe, LogOut, Sprout, Tractor, Pencil, Trash2, Plus, Server, CheckCircle2, XCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const StatusRow = ({ label, ok, detail, testId }) => (
  <div className="flex items-center justify-between p-3 bg-muted rounded-lg gap-3" data-testid={testId}>
    <span className="text-sm">{label}</span>
    <span className={`flex items-center gap-1 text-sm font-semibold ${ok ? 'text-green-700' : 'text-amber-700'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}{detail}
    </span>
  </div>
);

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const { farms, currentFarm, selectFarm, refreshFarms } = useFarm();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/system/status`).then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  const changeLanguage = async (lng) => {
    i18n.changeLanguage(lng);
    updateUser({ language: lng });
    try { await axios.put(`${BACKEND_URL}/api/auth/language`, { language: lng }); } catch (e) { /* stored locally anyway */ }
    toast.success(t('settings.language_saved'));
  };

  const deleteFarm = async (farm) => {
    if (!window.confirm(t('farm.delete_confirm'))) return;
    await axios.delete(`${BACKEND_URL}/api/farms/${farm.id}`);
    await refreshFarms();
    toast.success(t('farm.deleted'));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-primary to-green-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="settings-title">{t('settings.title')}</h1>
          <p className="text-white/90">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />{t('settings.profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[['name', user?.name], ['email', user?.email], ['role', t(`roles.${user?.role || 'farmer'}`)]].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">{t(`settings.${k}`)}</span>
                <span className="font-semibold" data-testid={`profile-${k}`}>{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />{t('settings.language_pref')}</CardTitle></CardHeader>
          <CardContent>
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="h-12" data-testid="language-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code} data-testid={`language-option-${l.code}`}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">{t('settings.language_hint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Tractor className="w-5 h-5" />{t('settings.manage_farms')}</span>
              <Link to="/farm-setup"><Button size="sm" className="rounded-full" data-testid="settings-add-farm"><Plus className="w-4 h-4 mr-1" />{t('common.add_farm')}</Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {farms.map((f) => (
              <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border ${currentFarm?.id === f.id ? 'border-primary bg-primary/5' : 'bg-muted'}`} data-testid={`farm-row-${f.id}`}>
                <button className="text-left flex-1" onClick={() => selectFarm(f.id)}>
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.crop_type} · {f.field_size} {t(`farm.${f.area_unit || 'acres'}`)}{f.location?.address ? ` · ${f.location.address}` : ''}</p>
                </button>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/farm-setup/${f.id}`)} data-testid={`edit-farm-${f.id}`}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteFarm(f)} data-testid={`delete-farm-${f.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {status && (
          <Card data-testid="system-status-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" />{t('settings.integrations')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <StatusRow label="Firebase IoT (Realtime DB)" ok={status.firebase.connected} testId="status-firebase"
                detail={status.firebase.connected ? t('settings.connected') : `${t('settings.not_connected')} · ${t('common.simulated')}`} />
              <StatusRow label="Weather (weatherapi.com)" ok={status.weather.configured} detail={status.weather.configured ? t('settings.configured') : t('settings.not_connected')} testId="status-weather" />
              <StatusRow label={`AI chat (${status.ai.chat_model})`} ok={status.ai.configured} detail={status.ai.configured ? t('settings.configured') : t('settings.not_connected')} testId="status-ai" />
              <StatusRow label="Voice (Whisper STT / TTS-1)" ok={status.ai.configured} detail={status.ai.configured ? t('settings.configured') : 'Browser fallback'} testId="status-voice" />
              <StatusRow label="ML crop recommendation (Random Forest)" ok={status.ml.classifier_loaded} detail={status.ml.classifier_loaded ? 'Loaded' : 'Missing'} testId="status-ml" />
              {status.firebase.error && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2" data-testid="firebase-error">{status.firebase.error}</p>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sprout className="w-5 h-5" />{t('settings.about')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{t('settings.about_text')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.version')} 2.0.0</p>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardContent className="pt-6">
            <Button onClick={handleLogout} variant="destructive" className="w-full h-12 rounded-full font-bold" data-testid="logout-button">
              <LogOut className="mr-2 w-5 h-5" />{t('common.logout')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
