import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Droplets,
  Thermometer,
  Wind,
  Sun,
  Activity,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Mic,
  CloudRain,
  Sprout,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = () => {
  const [farms, setFarms] = useState([]);
  const [currentFarm, setCurrentFarm] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/farms`);
      setFarms(response.data);
      if (response.data.length > 0) {
        setCurrentFarm(response.data[0]);
        await loadSensorData(response.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load farms');
    } finally {
      setLoading(false);
    }
  };

  const loadSensorData = async (farmId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/farms/${farmId}/sensors`);
      setSensorData(response.data);
    } catch (error) {
      console.error('Failed to load sensor data:', error);
    }
  };

  const handleRefresh = async () => {
    if (!currentFarm) return;
    setRefreshing(true);
    await loadSensorData(currentFarm.id);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'optimal':
        return 'status-optimal';
      case 'warning':
        return 'status-warning';
      case 'critical':
        return 'status-critical';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'optimal':
        return 'Optimal';
      case 'warning':
        return 'Needs Attention';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">Loading your dashboard...</div>
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Sprout className="w-16 h-16 mx-auto text-primary" />
            <h2 className="font-heading text-2xl font-bold">No Farm Setup</h2>
            <p className="text-muted-foreground">Let's create your first farm profile</p>
            <Link to="/farm-setup">
              <Button className="rounded-full h-12 px-8" data-testid="setup-farm-button">
                Setup Your Farm
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold" data-testid="dashboard-title">
                {currentFarm?.name || 'My Farm'}
              </h1>
              <p className="text-white/90 mt-1">{currentFarm?.crop_type}</p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="secondary"
              size="icon"
              className="rounded-full h-12 w-12"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {sensorData && (
            <div
              className={`${getStatusColor(sensorData.status)} text-white rounded-2xl p-4 flex items-center justify-between`}
              data-testid="farm-status-card"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8" />
                <div>
                  <p className="text-sm opacity-90">Farm Status</p>
                  <p className="text-xl font-bold">{getStatusText(sensorData.status)}</p>
                </div>
              </div>
              {sensorData.status !== 'optimal' && (
                <AlertTriangle className="w-8 h-8" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="sensor-card" data-testid="soil-moisture-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4" />
                Soil Moisture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {sensorData?.soil_moisture || '--'}%
              </p>
            </CardContent>
          </Card>

          <Card className="sensor-card" data-testid="soil-temp-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Soil Temp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-secondary">
                {sensorData?.soil_temperature || '--'}°C
              </p>
            </CardContent>
          </Card>

          <Card className="sensor-card" data-testid="ambient-temp-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Air Temp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-accent">
                {sensorData?.ambient_temperature || '--'}°C
              </p>
            </CardContent>
          </Card>

          <Card className="sensor-card" data-testid="humidity-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Wind className="w-4 h-4" />
                Humidity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {sensorData?.humidity || '--'}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/weather" className="block">
            <Card className="sensor-card hover:border-primary transition-colors h-full" data-testid="weather-quick-link">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100">
                    <CloudRain className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Weather</p>
                    <p className="text-xl font-bold">Forecast</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/crop-health" className="block">
            <Card className="sensor-card hover:border-primary transition-colors h-full" data-testid="crop-health-quick-link">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100">
                    <Sprout className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Crop Health</p>
                    <p className="text-xl font-bold">AI Analysis</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/yield" className="block">
            <Card className="sensor-card hover:border-primary transition-colors h-full" data-testid="yield-quick-link">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <TrendingUp className="w-8 h-8 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Yield</p>
                    <p className="text-xl font-bold">Prediction</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <Link to="/chatbot">
        <Button
          className="voice-fab h-16 w-16 rounded-full shadow-2xl"
          data-testid="voice-assistant-fab"
        >
          <Mic className="w-6 h-6" />
        </Button>
      </Link>
    </div>
  );
};

export default Dashboard;