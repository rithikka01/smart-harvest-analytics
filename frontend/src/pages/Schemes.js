import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink, Calendar, IndianRupee } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Schemes = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/schemes`);
      setSchemes(response.data);
    } catch (error) {
      console.error('Failed to load schemes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-primary text-xl">Loading schemes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="schemes-title">
            Government Schemes
          </h1>
          <p className="text-white/90">Subsidies and benefits for farmers</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="grid md:grid-cols-2 gap-6">
          {schemes.map((scheme) => (
            <Card key={scheme.id} className="sensor-card" data-testid={`scheme-${scheme.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-purple-100">
                      <IndianRupee className="w-6 h-6 text-purple-600" />
                    </div>
                    <CardTitle className="text-xl">{scheme.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{scheme.description}</p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Eligibility</p>
                      <p className="text-sm text-muted-foreground">{scheme.eligibility}</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full rounded-full" data-testid={`apply-scheme-${scheme.id}`}>
                  Learn More <ExternalLink className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Schemes;