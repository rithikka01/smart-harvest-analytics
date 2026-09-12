import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, MapPin, LocateFixed, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SOILS = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'clay', 'loamy'];
const WATER = ['borewell', 'canal', 'river', 'rain', 'pond', 'drip'];
const SEASONS = ['kharif', 'rabi', 'zaid', 'perennial'];

const empty = { name: '', crop_type: '', field_size: '', area_unit: 'acres', location: { lat: '', lng: '', address: '' }, soil_type: '', water_source: '', season: '', firebase_path: '' };

const FarmSetup = () => {
  const { t } = useTranslation();
  const { farmId } = useParams();
  const { refreshFarms, selectFarm } = useFarm();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!farmId) return;
    axios.get(`${BACKEND_URL}/api/farms/${farmId}`).then((r) => {
      const f = r.data;
      setForm({ ...empty, ...f, field_size: String(f.field_size), location: { lat: String(f.location?.lat ?? ''), lng: String(f.location?.lng ?? ''), address: f.location?.address || '' },
        soil_type: f.soil_type || '', water_source: f.water_source || '', season: f.season || '', firebase_path: f.firebase_path || '' });
    }).catch(() => toast.error(t('common.error')));
  }, [farmId, t]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setLoc = (k, v) => setForm((p) => ({ ...p, location: { ...p.location, [k]: v } }));

  const useGps = () => {
    if (!navigator.geolocation) return toast.error(t('farm.gps_failed'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc('lat', pos.coords.latitude.toFixed(5)); setLoc('lng', pos.coords.longitude.toFixed(5)); setLocating(false); toast.success(t('farm.gps_found')); },
      () => { setLocating(false); toast.error(t('farm.gps_failed')); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const stepValid = [
    form.name.trim() && form.crop_type.trim() && parseFloat(form.field_size) > 0,
    form.location.lat !== '' && form.location.lng !== '' && !isNaN(parseFloat(form.location.lat)) && !isNaN(parseFloat(form.location.lng)),
    true,
  ][step];

  const submit = async () => {
    setLoading(true);
    const payload = {
      name: form.name, crop_type: form.crop_type, field_size: parseFloat(form.field_size), area_unit: form.area_unit,
      location: { lat: parseFloat(form.location.lat), lng: parseFloat(form.location.lng), address: form.location.address },
      soil_type: form.soil_type || null, water_source: form.water_source || null, season: form.season || null, firebase_path: form.firebase_path || null,
    };
    try {
      const res = farmId ? await axios.put(`${BACKEND_URL}/api/farms/${farmId}`, payload) : await axios.post(`${BACKEND_URL}/api/farms`, payload);
      await refreshFarms();
      selectFarm(res.data.id);
      toast.success(t('farm.saved'));
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const steps = [t('farm.step_basics'), t('farm.step_location'), t('farm.step_details')];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl shadow-lg p-6 md:p-8">
          <h1 className="font-heading text-3xl font-bold mb-1" data-testid="farm-setup-title">{farmId ? t('farm.edit_title') : t('farm.setup_title')}</h1>
          <p className="text-muted-foreground mb-6">{t('farm.subtitle')}</p>

          <div className="flex items-center gap-2 mb-8" data-testid="wizard-steps">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${i === step ? 'text-primary' : 'text-muted-foreground'}`}>{s}</span>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); step < 2 ? setStep(step + 1) : submit(); }} className="space-y-6" data-testid="farm-setup-form">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="farmName">{t('farm.name')}</Label>
                  <Input id="farmName" placeholder="e.g., Green Valley Farm" value={form.name} onChange={(e) => set('name', e.target.value)} required className="h-12" data-testid="farm-name-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cropType">{t('farm.crop_type')}</Label>
                  <Input id="cropType" placeholder="e.g., Rice, Wheat, Cotton" value={form.crop_type} onChange={(e) => set('crop_type', e.target.value)} required className="h-12" data-testid="crop-type-input" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="fieldSize">{t('farm.field_size')}</Label>
                    <Input id="fieldSize" type="number" step="0.1" min="0.1" placeholder="e.g., 5.5" value={form.field_size} onChange={(e) => set('field_size', e.target.value)} required className="h-12" data-testid="field-size-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <Select value={form.area_unit} onValueChange={(v) => set('area_unit', v)}>
                      <SelectTrigger className="h-12" data-testid="area-unit-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acres">{t('farm.acres')}</SelectItem>
                        <SelectItem value="hectares">{t('farm.hectares')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" />{t('farm.step_location')}</Label>
                <Button type="button" variant="outline" onClick={useGps} disabled={locating} className="w-full h-12 rounded-full" data-testid="use-gps-button">
                  {locating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LocateFixed className="mr-2 h-5 w-5" />}
                  {t('farm.use_gps')}
                </Button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('farm.latitude')}</Label>
                    <Input type="number" step="any" value={form.location.lat} onChange={(e) => setLoc('lat', e.target.value)} required className="h-12" data-testid="latitude-input" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('farm.longitude')}</Label>
                    <Input type="number" step="any" value={form.location.lng} onChange={(e) => setLoc('lng', e.target.value)} required className="h-12" data-testid="longitude-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('farm.address')} ({t('common.optional')})</Label>
                  <Input value={form.location.address} onChange={(e) => setLoc('address', e.target.value)} className="h-12" data-testid="address-input" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {[['soil_type', SOILS, 'soil'], ['water_source', WATER, 'water'], ['season', SEASONS, 'seasons']].map(([key, opts, ns]) => (
                  <div className="space-y-2" key={key}>
                    <Label>{t(`farm.${key}`)} ({t('common.optional')})</Label>
                    <Select value={form[key]} onValueChange={(v) => set(key, v)}>
                      <SelectTrigger className="h-12" data-testid={`${key.replace('_', '-')}-select`}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => <SelectItem key={o} value={o}>{t(`farm.${ns}.${o}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="firebasePath">{t('farm.firebase_path')} ({t('common.optional')})</Label>
                  <Input id="firebasePath" placeholder="e.g., farms/my-farm/sensors" value={form.firebase_path} onChange={(e) => set('firebase_path', e.target.value)} className="h-12" data-testid="firebase-path-input" />
                  <p className="text-xs text-muted-foreground">{t('farm.firebase_hint')}</p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="h-12 rounded-full px-6" data-testid="wizard-back-button">
                  <ArrowLeft className="mr-2 h-5 w-5" />{t('common.back')}
                </Button>
              )}
              <Button type="submit" disabled={loading || !stepValid} className="flex-1 h-12 rounded-full font-bold shadow-lg" data-testid={step < 2 ? 'wizard-next-button' : 'farm-setup-submit-button'}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {step < 2 ? <>{t('common.next')}<ArrowRight className="ml-2 h-5 w-5" /></> : (farmId ? t('common.save') : t('farm.complete'))}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FarmSetup;
