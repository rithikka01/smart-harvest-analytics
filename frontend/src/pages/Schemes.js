import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink, IndianRupee, Award, Phone, Globe } from 'lucide-react';
import { toast } from 'sonner';

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
      toast.error('Failed to load schemes');
    } finally {
      setLoading(false);
    }
  };

  const handleVisitWebsite = (scheme) => {
    if (scheme.website) {
      window.open(scheme.website, '_blank', 'noopener,noreferrer');
      toast.success(`Opening ${scheme.name} website`);
    } else {
      toast.error('Website URL not available');
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Financial Support': 'bg-green-100 text-green-800',
      'Insurance': 'bg-blue-100 text-blue-800',
      'Credit Facility': 'bg-purple-100 text-purple-800',
      'Solar Energy': 'bg-yellow-100 text-yellow-800',
      'Soil Management': 'bg-orange-100 text-orange-800',
      'Organic Farming': 'bg-emerald-100 text-emerald-800',
      'Market Linkage': 'bg-indigo-100 text-indigo-800',
      'Sustainable Farming': 'bg-teal-100 text-teal-800',
      'Advisory Services': 'bg-pink-100 text-pink-800',
      'Pension Scheme': 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
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
      <div className="bg-gradient-to-br from-orange-600 to-orange-500 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-10 h-10" />
            <h1 className="font-heading text-3xl md:text-4xl font-bold" data-testid="schemes-title">
              Government Schemes
            </h1>
          </div>
          <p className="text-white/90">Indian Government Agricultural Subsidies & Benefits</p>
          <p className="text-white/80 text-sm mt-2">Click on any scheme to visit the official website</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">Kisan Call Center</p>
              <p className="text-sm text-blue-800">
                24x7 Helpline: <a href="tel:18001801551" className="font-bold underline">1800-180-1551</a> (Toll Free)
              </p>
              <p className="text-xs text-blue-700 mt-1">Get expert advice in your local language</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
          {schemes.map((scheme) => (
            <Card key={scheme.id} className="sensor-card hover:shadow-xl transition-all" data-testid={`scheme-${scheme.id}`}>
              <CardHeader>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{scheme.name}</CardTitle>
                    </div>
                    <Badge className={getCategoryColor(scheme.category)}>
                      {scheme.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{scheme.description}</p>

                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                    <Award className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Benefits</p>
                      <p className="text-sm text-green-800 mt-1">{scheme.benefits}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Eligibility</p>
                      <p className="text-sm text-blue-800 mt-1">{scheme.eligibility}</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleVisitWebsite(scheme)}
                  className="w-full rounded-full h-12 font-bold bg-orange-600 hover:bg-orange-700 text-white"
                  data-testid={`visit-scheme-${scheme.id}`}
                >
                  <Globe className="mr-2 w-5 h-5" />
                  Visit Official Website
                  <ExternalLink className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl">
          <h3 className="font-heading text-xl font-bold text-green-900 mb-2">Need Help Applying?</h3>
          <p className="text-green-800 text-sm mb-4">
            Contact your nearest Agriculture Department office or visit the official portals for detailed application procedures.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-100"
              onClick={() => window.open('https://agricoop.gov.in/', '_blank')}
            >
              Ministry of Agriculture
            </Button>
            <Button
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-100"
              onClick={() => window.open('https://farmer.gov.in/', '_blank')}
            >
              Farmer Portal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schemes;