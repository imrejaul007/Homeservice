import React from 'react';
import { BadgeCheck, Shield, Lock } from 'lucide-react';

const TrustBadges: React.FC = () => {
  const badges = [
    {
      icon: BadgeCheck,
      text: 'Verified professionals',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      icon: Lock,
      text: 'Secure booking',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      icon: Shield,
      text: 'NILIN quality standard',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8">
        {badges.map((badge) => {
          const IconComponent = badge.icon;
          return (
            <div key={badge.text} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${badge.bgColor} flex items-center justify-center`}>
                <IconComponent className={`w-4 h-4 ${badge.iconColor}`} strokeWidth={2} />
              </div>
              <span className="text-gray-700 text-sm font-medium">{badge.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrustBadges;
