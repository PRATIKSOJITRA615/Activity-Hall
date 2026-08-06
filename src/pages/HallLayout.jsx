import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Users } from 'lucide-react';
import { getMembers, getLayouts, getActivities } from '../lib/data-service';

const HallLayout = () => {
  const [layouts, setLayouts] = useState({ Deluxe: [], Premium: [] });
  const [members, setMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedActivityId, setSelectedActivityId] = useState('initial');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [lays, mems, acts] = await Promise.all([
        getLayouts(),
        getMembers(),
        getActivities()
      ]);
      setLayouts(lays);
      setMembers(mems);
      setActivities(acts);
      if (acts.length > 0) {
        setSelectedActivityId(acts[acts.length - 1].id);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Determine current assignments based on selected activity
  const currentAssignments = React.useMemo(() => {
    const map = {};
    if (selectedActivityId === 'initial') {
      members.forEach(m => {
        if (m.initial_seat_code) map[m.initial_seat_code] = m;
      });
    } else {
      const activity = activities.find(a => a.id === selectedActivityId);
      if (activity && activity.assignments) {
        members.forEach(m => {
          const seatCode = activity.assignments[m.id];
          if (seatCode) map[seatCode] = m;
        });
      }
    }
    return map;
  }, [members, activities, selectedActivityId]);

  const renderSeatMap = (category, seats) => {
    if (!seats || seats.length === 0) return null;
    
    return (
      <div className="mb-10">
        <h3 className={`text-lg font-bold mb-4 flex items-center ${category === 'Premium' ? 'text-indigo-700' : 'text-amber-700'}`}>
          <div className={`w-3 h-3 rounded-full mr-2 ${category === 'Premium' ? 'bg-indigo-500' : 'bg-amber-500'}`}></div>
          {category} Section
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {seats.map((seatCode) => {
            const occupant = currentAssignments[seatCode];
            return (
              <div 
                key={seatCode}
                className={`group relative p-4 rounded-xl border flex flex-col items-center justify-center min-h-[100px] transition-all
                  ${occupant ? 'bg-white border-blue-200 shadow-sm hover:shadow-md hover:border-blue-400 cursor-pointer' : 'bg-slate-50 border-slate-200 border-dashed text-slate-400'}`
                }
              >
                <span className={`text-sm font-bold font-mono mb-2 ${occupant ? 'text-blue-700' : ''}`}>{seatCode}</span>
                {occupant ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mb-1">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 text-center truncate w-full px-1">{occupant.name}</span>
                    
                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs rounded-lg p-3 w-48 bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 pointer-events-none z-10 shadow-lg">
                      <p className="font-bold border-b border-slate-600 pb-1 mb-1">{occupant.name}</p>
                      <p className="flex justify-between"><span>ID:</span> <span>{occupant.no}</span></p>
                      <p className="flex justify-between"><span>Category:</span> <span>{occupant.category}</span></p>
                      <div className="absolute w-3 h-3 bg-slate-800 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">Empty</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hall Layout</h1>
          <p className="text-slate-500 mt-1">Interactive map of current seating allocations</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500 font-medium ml-2">Viewing:</span>
          <select 
            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block px-3 py-1.5 outline-none font-medium"
            value={selectedActivityId}
            onChange={(e) => setSelectedActivityId(e.target.value)}
            disabled={loading}
          >
            <option value="initial">Initial Seating (Default)</option>
            {activities.map(act => (
              <option key={act.id} value={act.id}>{act.activity_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        {/* Stage / Front indicator */}
        <div className="w-full flex justify-center mb-12">
          <div className="bg-slate-100 border-2 border-slate-200 rounded-lg w-full max-w-md py-4 text-center">
            <span className="text-slate-400 font-bold uppercase tracking-widest text-sm flex items-center justify-center">
              <MapIcon className="w-4 h-4 mr-2" />
              Front / Stage Area
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading seat map...</div>
        ) : (
          <div className="space-y-8">
            {renderSeatMap('Premium', layouts['Premium'])}
            <div className="w-full border-t border-slate-100 my-8"></div>
            {renderSeatMap('Deluxe', layouts['Deluxe'])}
          </div>
        )}
        
        {!loading && (!layouts['Premium']?.length && !layouts['Deluxe']?.length) && (
          <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No seating layout configured yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default HallLayout;
