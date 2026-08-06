import React, { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import { getActivities, getMembers, getLayouts, createActivity } from '../lib/data-service';
import { generateActivitySeating, exportSeatingToCSV } from '../lib/rotation-engine';

const Rotations = () => {
  const [activities, setActivities] = useState([]);
  const [members, setMembers] = useState([]);
  const [layouts, setLayouts] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const [acts, mems, lays] = await Promise.all([
      getActivities(),
      getMembers(),
      getLayouts()
    ]);
    setActivities(acts);
    setMembers(mems);
    setLayouts(lays);
    if (acts.length > 0) {
      setSelectedActivity(acts[acts.length - 1]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateNext = async () => {
    setGenerating(true);
    try {
      const nextNumber = activities.length + 1;
      const activityName = `Event ${nextNumber} - Seat Rotation`;
      const date = new Date().toISOString().split('T')[0];
      
      const assignments = generateActivitySeating(members, layouts, nextNumber);
      
      const newActivity = await createActivity({
        activity_number: nextNumber,
        activity_name: activityName,
        date: date,
        assignments: assignments
      });
      
      setActivities([...activities, newActivity]);
      setSelectedActivity(newActivity);
    } catch (error) {
      console.error("Failed to generate activity", error);
      alert("Failed to generate activity");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity Rotations</h1>
          <p className="text-slate-500 mt-1">Manage and generate seating assignments for activities</p>
        </div>
        <button 
          onClick={handleGenerateNext}
          disabled={generating || members.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center"
        >
          {generating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Generate Next Rotation
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-800 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-slate-500" />
              Activity History
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No activities yet.</p>
                <p className="text-sm mt-2">Generate your first rotation to get started.</p>
              </div>
            ) : (
              activities.map(act => (
                <div 
                  key={act.id} 
                  onClick={() => setSelectedActivity(act)}
                  className={`p-4 cursor-pointer transition-colors ${selectedActivity?.id === act.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}
                >
                  <h3 className="font-medium text-slate-900">{act.activity_name}</h3>
                  <div className="flex justify-between items-center mt-2 text-sm text-slate-500">
                    <span>{new Date(act.date).toLocaleDateString()}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">Event {act.activity_number}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Activity Details */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {selectedActivity ? (
            <>
              <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedActivity.activity_name}</h2>
                  <p className="text-slate-500 mt-1">Generated on {new Date(selectedActivity.date).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => exportSeatingToCSV(members, selectedActivity.assignments, selectedActivity.activity_name)}
                  className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center"
                  title="Export to CSV"
                >
                  <Download className="w-5 h-5" />
                  <span className="ml-2 text-sm font-medium hidden sm:inline">Export CSV</span>
                </button>
              </div>
              <div className="p-0 flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Member</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned Seat</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {members.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-slate-900">{member.name}</div>
                            <div className="text-xs text-slate-500 ml-2">({member.no})</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            member.category === 'Premium' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {member.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-blue-50 text-blue-700 font-mono font-bold border border-blue-100">
                            {selectedActivity.assignments[member.id] || 'Unassigned'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
              <Calendar className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-lg font-medium text-slate-600">No activity selected</p>
              <p className="text-sm">Select an activity from the history list or generate a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Rotations;
