import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CloudRain, Droplets, Wind, Sun, AlertTriangle, Calendar } from 'lucide-react';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Weather = () => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentFarm, loading: farmsLoading } = useFarm();

  useEffect(() => {
    if (farmsLoading) return;
    if (!currentFarm) { setLoading(false); return; }
    setLoading(true);
    loadWeather(currentFarm);
  }, [currentFarm?.id, farmsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadWeather = async (farm) => {
    try {
      const weatherRes = await axios.get(`${BACKEND_URL}/api/weather`, {
        params: { lat: farm.location.lat, lon: farm.location.lng },
      });
      setWeather(weatherRes.data);
    } catch (error) {
      toast.error('Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">Loading weather...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="weather-gradient text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="weather-title">
              Weather Forecast
            </h1>
            <p className="text-white/90">7-day outlook{weather?.location ? ` · ${weather.location}` : ''} · weatherapi.com</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {weather?.current && (
          <Card className="weather-gradient text-white border-none" data-testid="current-weather-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Current Weather</p>
                  <p className="text-5xl font-bold mt-2">{weather.current.temp_c}°C</p>
                  <p className="text-xl mt-2">{weather.current.condition}</p>
                </div>
                <img
                  src={`https:${weather.current.icon}`}
                  alt="weather icon"
                  className="w-24 h-24"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5" />
                  <div>
                    <p className="text-sm opacity-90">Humidity</p>
                    <p className="text-lg font-semibold">{weather.current.humidity}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5" />
                  <div>
                    <p className="text-sm opacity-90">Wind</p>
                    <p className="text-lg font-semibold">{weather.current.wind_kph} km/h</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {weather?.alerts && weather.alerts.length > 0 && (
          <Card className="border-destructive bg-destructive/10" data-testid="weather-alerts-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Weather Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weather.alerts.map((alert, index) => (
                <div key={index} className="mb-2 last:mb-0">
                  <p className="font-semibold">{alert.headline}</p>
                  <p className="text-sm text-muted-foreground">{alert.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="font-heading text-2xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            7-Day Forecast
          </h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {weather?.forecast?.map((day, index) => (
              <Card key={index} className="sensor-card" data-testid={`forecast-day-${index}`}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <img
                      src={`https:${day.icon}`}
                      alt="weather icon"
                      className="w-16 h-16 mx-auto"
                    />
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-2xl font-bold">{day.max_temp}°</span>
                      <span className="text-lg text-muted-foreground">{day.min_temp}°</span>
                    </div>
                    <p className="text-sm mt-2">{day.condition}</p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-blue-600">
                      <Droplets className="w-4 h-4" />
                      <span className="text-sm">{day.rain_chance}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Weather;