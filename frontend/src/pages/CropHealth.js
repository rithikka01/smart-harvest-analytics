import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sprout, AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CropHealth = () => {
  const [analysis, setAnalysis] = useState(null);
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

  const analyzeCrop = async () => {
    if (!farmId) {
      toast.error('No farm found');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/crop/analyze?farm_id=${farmId}`);
      setAnalysis(response.data);
      toast.success('Crop health analyzed');
    } catch (error) {
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    if (status?.toLowerCase().includes('healthy')) return 'text-green-600';
    if (status?.toLowerCase().includes('moderate')) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthIcon = (status) => {
    if (status?.toLowerCase().includes('healthy')) return <CheckCircle className="w-8 h-8 text-green-600" />;
    return <AlertCircle className="w-8 h-8 text-yellow-600" />;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-green-600 to-green-500 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="crop-health-title">
            Crop Health Analysis
          </h1>
          <p className="text-white/90">AI-powered crop monitoring</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <Sprout className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="font-heading text-2xl font-bold mb-2">Analyze Your Crop</h2>
            <p className="text-muted-foreground mb-6">
              Get AI-powered insights about your crop health based on real-time sensor data
            </p>
            <Button
              onClick={analyzeCrop}
              disabled={loading || !farmId}
              className="h-12 px-8 rounded-full font-bold"
              data-testid="analyze-crop-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze Crop Health'
              )}
            </Button>
          </CardContent>
        </Card>

        {analysis && (
          <div className="space-y-6" data-testid="crop-analysis-results">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {getHealthIcon(analysis.health_status)}
                  <div>
                    <p className="text-sm text-muted-foreground">Health Status</p>
                    <p className={`text-2xl font-bold ${getHealthColor(analysis.health_status)}`}>
                      {analysis.health_status}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>Confidence: {Math.round(analysis.confidence * 100)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Observations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.reasons?.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary">
              <CardHeader>
                <CardTitle className="text-primary">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.recommendations?.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default CropHealth;