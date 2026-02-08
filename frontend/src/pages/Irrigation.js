import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Droplets, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Irrigation = () => {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [farmId, setFarmId] = useState(null);

  React.useEffect(() => {
    loadFarm();
  }, []);

  const loadFarm = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/farms`);
      if (response.data.length > 0) {
        setFarmId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load farm');
    }
  };

  const getRecommendation = async () => {
    if (!farmId) {
      toast.error('No farm found');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/irrigation/recommend?farm_id=${farmId}`);
      setRecommendation(response.data);
      toast.success('Recommendation ready');
    } catch (error) {
      toast.error('Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="irrigation-title">
            Smart Irrigation
          </h1>
          <p className="text-white/90">Optimize water usage</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Droplets className="w-16 h-16 mx-auto text-blue-600 mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-2">Check Irrigation Needs</h2>
            <p className="text-muted-foreground mb-6">
              Get smart recommendations based on soil moisture and weather conditions
            </p>
            <Button
              onClick={getRecommendation}
              disabled={loading || !farmId}
              className="h-12 px-8 rounded-full font-bold bg-blue-600 hover:bg-blue-700"
              data-testid="check-irrigation-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check Now'
              )}
            </Button>
          </CardContent>
        </Card>

        {recommendation && (
          <Card
            className={`border-2 ${
              recommendation.should_irrigate ? 'border-blue-600 bg-blue-50' : 'border-green-600 bg-green-50'
            }`}
            data-testid="irrigation-recommendation-card"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {recommendation.should_irrigate ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-blue-600" />
                    <span className="text-blue-600">Irrigation Needed</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <span className="text-green-600">No Irrigation Needed</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">{recommendation.reason}</p>
              {recommendation.water_amount && (
                <div className="p-4 bg-white rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-1">Recommended Water Amount</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {recommendation.water_amount.toFixed(0)} liters
                  </p>
                </div>
              )}
              {recommendation.should_irrigate && (
                <Button
                  className="w-full h-12 rounded-full font-bold"
                  data-testid="water-now-button"
                >
                  Water Now
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Irrigation;