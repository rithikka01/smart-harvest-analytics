import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TrendingUp, Loader2, BarChart3, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFarm } from '@/contexts/FarmContext';
import { FarmSwitcher } from '@/components/FarmSwitcher';
import { SourceBadge } from '@/components/SourceBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const YieldPrediction = () => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const { currentFarm } = useFarm();
  const farmId = currentFarm?.id;

  React.useEffect(() => { setPrediction(null); }, [farmId]);

  const predictYield = async () => {
    if (!farmId) {
      toast.error('No farm found');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/yield/predict?farm_id=${farmId}`);
      setPrediction(response.data);
      toast.success('Yield predicted successfully');
    } catch (error) {
      toast.error('Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const chartData = prediction
    ? [
        { name: 'Reference (2.5 t/acre)', value: prediction.comparison?.regional_average || 0 },
        { name: 'Estimated', value: prediction.estimated_yield },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-accent to-yellow-500 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="yield-prediction-title">
              Yield Estimate
            </h1>
            <p className="text-white/90">Heuristic estimate from current conditions (not a validated ML yield model)</p>
          </div>
          <FarmSwitcher light />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-accent mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-2">Predict Your Harvest</h2>
            <p className="text-muted-foreground mb-6">
              Get AI-based yield estimates based on current conditions and historical data
            </p>
            <Button
              onClick={predictYield}
              disabled={loading || !farmId}
              className="h-12 px-8 rounded-full font-bold bg-accent hover:bg-accent/90"
              data-testid="predict-yield-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Predicting...
                </>
              ) : (
                'Predict Yield'
              )}
            </Button>
          </CardContent>
        </Card>

        {prediction && (
          <div className="space-y-6" data-testid="yield-prediction-results">
            <Card className="bg-gradient-to-br from-accent/10 to-yellow-50 border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Yield</p>
                    <p className="text-4xl font-bold text-accent">
                      {prediction.estimated_yield} {prediction.unit}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                  <span className="flex items-center gap-1"><Target className="w-4 h-4" />Method: {prediction.method}</span>
                  <SourceBadge source={prediction.data_source} />
                </div>
                <p className="text-xs text-muted-foreground mt-2" data-testid="yield-disclaimer">{prediction.disclaimer}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Yield Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#FBC02D" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prediction.comparison?.regional_average && (
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-muted-foreground">vs 2.5 t/acre reference</span>
                      <span className="font-semibold">
                        {prediction.estimated_yield > prediction.comparison.regional_average
                          ? '+'
                          : ''}
                        {(
                          ((prediction.estimated_yield - prediction.comparison.regional_average) /
                            prediction.comparison.regional_average) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
                  {prediction.water_efficiency && (
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-muted-foreground">ML water-efficiency factor (RandomForestRegressor)</span>
                      <span className="font-semibold">{prediction.water_efficiency}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default YieldPrediction;