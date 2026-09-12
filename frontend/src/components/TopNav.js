import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CloudRain, Sprout, Award, MessageSquare, BarChart3, Settings, Droplets } from 'lucide-react';

const TopNav = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const items = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/weather', icon: CloudRain, label: t('nav.weather') },
    { path: '/crop-health', icon: Sprout, label: t('nav.crop') },
    { path: '/irrigation', icon: Droplets, label: t('nav.irrigation') },
    { path: '/analytics', icon: BarChart3, label: t('nav.analytics') },
    { path: '/schemes', icon: Award, label: t('nav.schemes') },
    { path: '/chatbot', icon: MessageSquare, label: t('nav.chat') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ];
  return (
    <nav className="hidden md:flex sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 px-6 h-14 items-center gap-1" data-testid="top-nav">
      <Link to="/" className="font-heading font-bold text-primary text-lg mr-6 flex items-center gap-2">
        <Sprout className="w-5 h-5" /> AgriSmart
      </Link>
      {items.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid={`topnav-${item.path === '/' ? 'home' : item.path.slice(1)}`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default TopNav;
