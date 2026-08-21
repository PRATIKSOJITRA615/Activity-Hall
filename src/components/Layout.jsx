import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, Repeat, Map } from 'lucide-react';
import clsx from 'clsx';

const Layout = () => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Member Directory', path: '/directory', icon: Users },
    { name: 'Activity Rotations', path: '/rotations', icon: Repeat },
    { name: 'Hall Layout', path: '/layout', icon: Map },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation  */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold mr-3 shadow-md">
                  S
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-800">
                  Seat<span className="text-blue-600">Sync</span>
                </span>
              </div>
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      className={({ isActive }) =>
                        clsx(
                          'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200',
                          isActive
                            ? 'border-blue-600 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        )
                      }
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area  */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
