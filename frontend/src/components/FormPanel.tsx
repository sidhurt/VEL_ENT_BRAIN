import { useState } from 'react';
import axios from 'axios';

export default function FormPanel({ userId, apiUrl, onComplete }: { userId: string, apiUrl: string, onComplete: () => void }) {
  const [activeTab, setActiveTab] = useState<'project' | 'policy' | 'style'>('project');
  const [formData, setFormData] = useState({ name: '', text: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'project') {
         await axios.post(`${apiUrl}/forms/consumer/project`, { userId, name: formData.name });
      } else if (activeTab === 'style') {
         await axios.post(`${apiUrl}/forms/consumer/style`, { userId, text: formData.text });
      } else if (activeTab === 'policy') {
         await axios.post(`${apiUrl}/forms/enterprise/policy`, { userId, text: formData.text });
      }
      setFormData({ name: '', text: '' });
      onComplete();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mt-4">
      <div className="flex border-b">
        <button 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'project' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('project')}>New Project</button>
        <button 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'style' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('style')}>New Style</button>
        <button 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'policy' ? 'bg-red-50 text-red-700 border-b-2 border-red-600' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('policy')}>Admin Policy</button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {activeTab === 'project' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Project Name (Active)</label>
            <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-indigo-500" 
                placeholder="e.g. Q4 Marketing Campaign"
                required
            />
          </div>
        )}
        {(activeTab === 'style' || activeTab === 'policy') && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {activeTab === 'style' ? 'Personal Formatting Rules' : 'Enterprise Policy Rule'}
            </label>
            <textarea 
                value={formData.text} 
                onChange={e => setFormData({...formData, text: e.target.value})} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-indigo-500" 
                placeholder={activeTab === 'style' ? "e.g. Write in bullet points" : "e.g. Do not share financial data"}
                rows={3}
                required
            />
          </div>
        )}
        <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-md text-sm disabled:opacity-50 transition-colors">
            {loading ? 'Saving...' : 'Add Context Node'}
        </button>
      </form>
    </div>
  );
}
