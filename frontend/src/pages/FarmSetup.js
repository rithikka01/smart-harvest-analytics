import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, MapPin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FarmSetup = () => {
  const [formData, setFormData] = useState({
    name: '',
    crop_type: '',
    field_size: '',
    location: { lat: '', lng: '', address: '' },
    firebase_path: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${BACKEND_URL}/api/farms`, {
        ...formData,
        field_size: parseFloat(formData.field_size),
        location: {
          lat: parseFloat(formData.location.lat),
          lng: parseFloat(formData.location.lng),
          address: formData.location.address,
        },
      });
      toast.success('Farm setup completed!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Farm setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-2xl shadow-lg p-6 md:p-8">
          <h1 className="font-heading text-3xl font-bold mb-2">Setup Your Farm</h1>
          <p className="text-muted-foreground mb-8">Let's get your farm profile ready</p>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="farm-setup-form">
            <div className="space-y-2">
              <Label htmlFor="farmName">Farm Name</Label>
              <Input
                id="farmName"
                placeholder="e.g., Green Valley Farm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="h-12"
                data-testid="farm-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cropType">Main Crop Type</Label>
              <Input
                id="cropType"
                placeholder="e.g., Rice, Wheat, Cotton"
                value={formData.crop_type}
                onChange={(e) => setFormData({ ...formData, crop_type: e.target.value })}
                required
                className="h-12"
                data-testid="crop-type-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fieldSize">Field Size (acres)</Label>
              <Input
                id="fieldSize"
                type="number"
                step="0.1"
                placeholder="e.g., 5.5"
                value={formData.field_size}
                onChange={(e) => setFormData({ ...formData, field_size: e.target.value })}
                required
                className="h-12"
                data-testid="field-size-input"
              />
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Latitude"
                  type="number"
                  step="any"
                  value={formData.location.lat}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, lat: e.target.value },
                    })
                  }
                  required
                  className="h-12"
                  data-testid="latitude-input"
                />
                <Input
                  placeholder="Longitude"
                  type="number"
                  step="any"
                  value={formData.location.lng}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      location: { ...formData.location, lng: e.target.value },
                    })
                  }
                  required
                  className="h-12"
                  data-testid="longitude-input"
                />
              </div>
              <Input
                placeholder="Address (optional)"
                value={formData.location.address}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location: { ...formData.location, address: e.target.value },
                  })
                }
                className="h-12"
                data-testid="address-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firebasePath">Firebase Sensor Path (optional)</Label>
              <Input
                id="firebasePath"
                placeholder="e.g., farms/my-farm/sensors"
                value={formData.firebase_path}
                onChange={(e) => setFormData({ ...formData, firebase_path: e.target.value })}
                className="h-12"
                data-testid="firebase-path-input"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if you don't have IoT sensors connected yet
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
              data-testid="farm-setup-submit-button"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FarmSetup;