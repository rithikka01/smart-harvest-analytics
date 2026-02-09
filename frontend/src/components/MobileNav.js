import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CloudRain, Sprout, Award, MessageSquare } from 'lucide-react';

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/weather', icon: CloudRain, label: 'Weather' },
    { path: '/crop-health', icon: Sprout, label: 'Crop' },
    { path: '/schemes', icon: Award, label: 'Schemes' },
    { path: '/chatbot', icon: MessageSquare, label: 'Chat' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex justify-around items-center z-50 pb-safe" data-testid="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isActive ? 'text-primary' : 'text-gray-500'
            }`}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileNav;