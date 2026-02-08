import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, Globe, LogOut, Sprout } from 'lucide-react';

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = React.useState('en');

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-primary to-green-600 text-white p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2" data-testid="settings-title">
            Settings
          </h1>
          <p className="text-white/90">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Name</span>
              <span className="font-semibold">{user?.name}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Email</span>
              <span className="font-semibold">{user?.email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Language Preference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-12" data-testid="language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
                <SelectItem value="ml">മലയാളം (Malayalam)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              Change language for the entire app interface
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="w-5 h-5" />
              About AgriSmart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              AgriSmart helps farmers monitor their farms in real-time, predict crop health and yield,
              and make data-driven decisions using IoT sensors, weather data, and AI models.
            </p>
            <p className="text-sm text-muted-foreground">Version 1.0.0</p>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardContent className="pt-6">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full h-12 rounded-full font-bold"
              data-testid="logout-button"
            >
              <LogOut className="mr-2 w-5 h-5" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;