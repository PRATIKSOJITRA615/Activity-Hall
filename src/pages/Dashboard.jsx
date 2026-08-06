import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Crown, Star, Calendar } from 'lucide-react';
import { getMembers, getActivities } from '../lib/data-service';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center transition-all hover:shadow-md hover:border-slate-300">
    <div className={`p-4 rounded-full ${colorClass} mr-4`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    deluxe: 0,
    premium: 0,
    activities: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const members = await getMembers();
        const activities = await getActivities();
        
        setStats({
          total: members.length,
          deluxe: members.filter(m => m.category === 'Deluxe').length,
          premium: members.filter(m => m.category === 'Premium').length,
          activities: activities.length
        });
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your seating allocation system</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl h-28 border border-slate-100 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Members" 
            value={stats.total} 
            icon={Users} 
            colorClass="bg-blue-600" 
          />
          <StatCard 
            title="Deluxe Members" 
            value={stats.deluxe} 
            icon={Star} 
            colorClass="bg-amber-500" 
          />
          <StatCard 
            title="Premium Members" 
            value={stats.premium} 
            icon={Crown} 
            colorClass="bg-indigo-600" 
          />
          <StatCard 
            title="Total Activities" 
            value={stats.activities} 
            icon={Calendar} 
            colorClass="bg-emerald-500" 
          />
        </div>
      )}

      <div className="mt-12 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 md:p-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Ready for the next activity?</h2>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Generate the seat rotation for your next event. The system will automatically shift 
              all active members sequentially across the available hall layouts based on their category.
            </p>
          </div>
          <Link to="/rotations" className="mt-6 md:mt-0 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center shadow-blue-600/20">
            Go to Rotations
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
