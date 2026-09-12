import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, CloudRain, Sprout, Award, MessageSquare } from 'lucide-react';

const MobileNav = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', icon: Home, label: t('nav.home'), id: 'home' },
    { path: '/weather', icon: CloudRain, label: t('nav.weather'), id: 'weather' },
    { path: '/crop-health', icon: Sprout, label: t('nav.crop'), id: 'crop' },
    { path: '/schemes', icon: Award, label: t('nav.schemes'), id: 'schemes' },
    { path: '/chatbot', icon: MessageSquare, label: t('nav.chat'), id: 'chat' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-between items-center z-50 pb-safe shadow-lg px-2" style={{ height: '64px' }} data-testid="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center transition-colors px-2 py-1 ${
              isActive ? 'text-primary' : 'text-gray-500'
            }`}
            data-testid={`nav-${item.id}`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-[9px] mt-0.5 font-medium whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileNav;
