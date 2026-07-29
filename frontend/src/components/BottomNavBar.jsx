import React from 'react';

const BottomNavBar = ({ activeTab, setActiveTab, user, unreadNotifCount = 0 }) => {
  const isAudience = user?.role === 'audience';

  const navItems = isAudience
    ? [
        { id: 'dashboard', label: 'Home', icon: '🏠' },
        { id: 'feedback', label: 'Feedback', icon: '⭐' },
        { id: 'queries', label: 'Queries', icon: '💬' },
        { id: 'settings', label: 'Profile', icon: '👤' },
      ]
    : [
        { id: 'dashboard', label: 'Home', icon: '📊' },
        { id: 'campaigns', label: 'Campaigns', icon: '🚀' },
        { id: 'audiences', label: 'Audience', icon: '👥' },
        { id: 'templates', label: 'Templates', icon: '📄' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
      ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <div className="bottom-nav-icon-container">
              <span className="bottom-nav-icon">{item.icon}</span>
              {item.id === 'settings' && unreadNotifCount > 0 && (
                <span className="bottom-nav-badge">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
              )}
            </div>
            <span className="bottom-nav-label">{item.label}</span>
            {isActive && <div className="bottom-nav-active-pill" />}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
