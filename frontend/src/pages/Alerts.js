import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/alerts`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <Info className="w-5 h-5 text-accent" />;
      default:
        return <CheckCircle className="w-5 h-5 text-primary" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="alerts-title">
            Alerts & Notifications
          </h1>
          <p className="text-white/90">Stay updated with farm activities</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {alerts.length === 0 ? (
          <Card data-testid="no-alerts-card">
            <CardContent className="pt-6 text-center">
              <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="font-heading text-2xl font-bold mb-2">No Alerts</h2>
              <p className="text-muted-foreground">You're all caught up! No new notifications.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, index) => (
              <Card
                key={alert.id || index}
                className={`${alert.read ? 'opacity-60' : ''}`}
                data-testid={`alert-${index}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getSeverityIcon(alert.severity)}
                      <span className="capitalize">{alert.type}</span>
                    </div>
                    <Badge variant={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{alert.message}</p>
                  {alert.created_at && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;