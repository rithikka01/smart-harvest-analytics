import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Droplets, Thermometer, Wind, Sun, Activity, TrendingUp, AlertTriangle, RefreshCw, Mic, CloudRain, Sprout, Award,
  FlaskConical, Wheat, BarChart3, Bell, CheckCircle, Clock, Leaf, Info,
} from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { SourceBadge, statusClasses } from '@/components/SourceBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SENSORS = [
  { key: 'soil_moisture', label: 'dashboard.soil_moisture', unit: '%', icon: Droplets, color: 'text-primary' },
  { key: 'soil_temperature', label: 'dashboard.soil_temp', unit: '°C', icon: Thermometer, color: 'text-secondary' },
  { key: 'ambient_temperature', label: 'dashboard.air_temp', unit: '°C', icon: Thermometer, color: 'text-accent' },
  { key: 'humidity', label: 'dashboard.humidity', unit: '%', icon: Wind, color: 'text-blue-600' },
  { key: 'light_intensity', label: 'dashboard.light', unit: ' lux', icon: Sun, color: 'text-yellow-600' },
];

const TOOLS = [
  { to: '/weather', icon: CloudRain, bg: 'bg-blue-100', fg: 'text-blue-600', small: 'dashboard.weather', big: 'dashboard.forecast', id: 'weather' },
  { to: '/crop-health', icon: Sprout, bg: 'bg-green-100', fg: 'text-green-600', small: 'dashboard.crop_health_link', big: 'dashboard.ai_analysis', id: 'crop-health' },
  { to: '/yield', icon: TrendingUp, bg: 'bg-yellow-100', fg: 'text-yellow-600', small: 'dashboard.yield', big: 'dashboard.prediction', id: 'yield' },
  { to: '/schemes', icon: Award, bg: 'bg-orange-100', fg: 'text-orange-600', small: 'dashboard.government', big: 'dashboard.schemes', id: 'schemes' },
  { to: '/irrigation', icon: Droplets, bg: 'bg-cyan-100', fg: 'text-cyan-700', small: 'nav.tools', big: 'dashboard.irrigation', id: 'irrigation' },
  { to: '/crop-recommend', icon: Wheat, bg: 'bg-lime-100', fg: 'text-lime-700', small: 'nav.tools', big: 'dashboard.crop_recommend', id: 'crop-recommend' },
  { to: '/fertilizer', icon: FlaskConical, bg: 'bg-purple-100', fg: 'text-purple-700', small: 'nav.tools', big: 'dashboard.fertilizer', id: 'fertilizer' },
  { to: '/analytics', icon: BarChart3, bg: 'bg-slate-200', fg: 'text-slate-700', small: 'nav.tools', big: 'dashboard.analytics', id: 'analytics' },
];

const healthKey = (s) => (s || '').toLowerCase().replace(' ', '_');

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { farms, currentFarm, loading: farmsLoading } = useFarm();
  const [sensorData, setSensorData] = useState(null);
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (farmId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/farms/${farmId}/sensors`);
      setSensorData(res.data);
    } catch (e) {
      console.error('Failed to load sensor data:', e);
    }
    axios.post(`${BACKEND_URL}/api/crop/analyze?farm_id=${farmId}`).then((r) => setHealth(r.data)).catch(() => setHealth(null));
    axios.get(`${BACKEND_URL}/api/farms/${farmId}/alerts`).then((r) => setAlerts(r.data.alerts)).catch(() => setAlerts(null));
  }, []);

  useEffect(() => {
    if (currentFarm) {
      setSensorData(null);
      setHealth(null);
      setAlerts(null);
      load(currentFarm.id);
    }
  }, [currentFarm?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    if (!currentFarm) return;
    setRefreshing(true);
    await load(currentFarm.id);
    setRefreshing(false);
    toast.success(t('dashboard.data_refreshed'));
  };

  if (farmsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">{t('common.loading')}</div>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Sprout className="w-16 h-16 mx-auto text-primary" />
            <h2 className="font-heading text-2xl font-bold">{t('common.no_farm')}</h2>
            <p className="text-muted-foreground">{t('common.no_farm_hint')}</p>
            <Link to="/farm-setup">
              <Button className="rounded-full h-12 px-8" data-testid="setup-farm-button">{t('common.setup_farm')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusKey = sensorData?.status || 'unknown';
  const statusBg = { optimal: 'status-optimal', warning: 'status-warning', critical: 'status-critical' }[statusKey] || 'bg-gray-500';
  const readingTime = sensorData?.timestamp ? new Date(sensorData.timestamp).toLocaleString(i18n.language) : '--';

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold" data-testid="dashboard-title">{currentFarm?.name}</h1>
              <p className="text-white/90 mt-1">{currentFarm?.crop_type} · {currentFarm?.field_size} {t(`farm.${currentFarm?.area_unit || 'acres'}`)}</p>
            </div>
            <div className="flex items-center gap-2">
              <FarmSwitcher light />
              <Button onClick={handleRefresh} disabled={refreshing} variant="secondary" size="icon" className="rounded-full h-11 w-11" data-testid="refresh-button">
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {sensorData && (
            <div className={`${statusBg} text-white rounded-2xl p-4`} data-testid="farm-status-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8" />
                  <div>
                    <p className="text-sm opacity-90">{t('dashboard.farm_status')}</p>
                    <p className="text-xl font-bold" data-testid="farm-status-text">{t(`status.${statusKey}`)}</p>
                  </div>
                </div>
                {statusKey !== 'optimal' && <AlertTriangle className="w-8 h-8" />}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/25 text-xs">
                <SourceBadge source={sensorData.source} note={sensorData.source_note} />
                <span className="inline-flex items-center gap-1 opacity-90" data-testid="last-updated">
                  <Clock className="w-3.5 h-3.5" /> {t('dashboard.reading_time')}: {readingTime}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {sensorData?.source === 'simulated' && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm" data-testid="simulated-banner">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{t('common.simulated_note')}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {SENSORS.map((s) => {
            const Icon = s.icon;
            const st = sensorData?.metric_status?.[s.key] || 'unknown';
            const cls = statusClasses(st);
            const val = sensorData?.[s.key];
            return (
              <Card key={s.key} className={`sensor-card border-2 ${cls.bg}`} data-testid={`${s.key.replace('_', '-')}-card`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1.5"><Icon className="w-4 h-4" />{t(s.label)}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${cls.dot}`} />
                  </div>
                  <p className={`text-2xl md:text-3xl font-bold ${s.color}`} data-testid={`${s.key}-value`}>
                    {val !== undefined && val !== null ? (s.key === 'light_intensity' ? Math.round(val).toLocaleString() : val) : '--'}
                    <span className="text-base font-semibold">{s.unit}</span>
                  </p>
                  <p className={`text-xs font-semibold mt-1 ${cls.text}`} data-testid={`${s.key}-status`}>{t(`status.${st}`)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2" data-testid="crop-health-card">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2"><Leaf className="w-5 h-5 text-primary" />{t('dashboard.crop_health')}</h3>
                <Link to="/crop-health" className="text-sm text-primary font-semibold hover:underline">{t('dashboard.ai_analysis')} →</Link>
              </div>
              {health ? (
                <div>
                  <div className="flex items-center gap-3">
                    {healthKey(health.health_status) === 'healthy' ? <CheckCircle className="w-9 h-9 text-green-600" /> : <AlertTriangle className={`w-9 h-9 ${healthKey(health.health_status) === 'high_stress' ? 'text-red-600' : 'text-yellow-600'}`} />}
                    <div>
                      <p className={`text-2xl font-bold ${{ healthy: 'text-green-700', moderate_stress: 'text-yellow-700', high_stress: 'text-red-700' }[healthKey(health.health_status)] || ''}`} data-testid="crop-health-status">
                        {t(`status.${healthKey(health.health_status)}`, health.health_status)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('common.confidence')}: {Math.round((health.confidence || 0) * 100)}% · {t('common.method')}: {health.method}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {health.reasons?.slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('dashboard.analyzing')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2" data-testid="alerts-panel">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold text-lg flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />{t('dashboard.alerts')}</h3>
                <Link to="/alerts" className="text-sm text-primary font-semibold hover:underline">→</Link>
              </div>
              <ul className="space-y-2">
                {(alerts || []).map((a) => {
                  const cls = statusClasses(a.severity);
                  return (
                    <li key={a.id} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm ${cls.bg}`} data-testid={`alert-${a.severity}`}>
                      {a.severity === 'ok' ? <CheckCircle className={`w-4 h-4 mt-0.5 ${cls.text}`} /> : <AlertTriangle className={`w-4 h-4 mt-0.5 ${cls.text}`} />}
                      <span>
                        <span className={`font-bold uppercase text-xs mr-1 ${cls.text}`}>{t(`status.${a.severity}`)}</span>
                        {a.severity === 'ok' ? t('dashboard.all_ok') : a.message}
                      </span>
                    </li>
                  );
                })}
                {!alerts && <li className="text-sm text-muted-foreground">{t('common.loading')}</li>}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-heading text-xl font-bold mb-3">{t('dashboard.quick_tools')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.to} to={tool.to} className="block">
                  <Card className="sensor-card hover:border-primary transition-colors h-full" data-testid={`${tool.id}-quick-link`}>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${tool.bg}`}><Icon className={`w-7 h-7 ${tool.fg}`} /></div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t(tool.small)}</p>
                          <p className="text-base font-bold leading-tight">{t(tool.big)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <Link to="/chatbot">
        <Button className="voice-fab h-16 w-16 rounded-full shadow-2xl" data-testid="voice-assistant-fab">
          <Mic className="w-6 h-6" />
        </Button>
      </Link>
    </div>
  );
};

export default Dashboard;
