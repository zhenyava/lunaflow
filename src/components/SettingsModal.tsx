import { useState } from 'react';
import { Cloud, MessageSquare, Settings } from 'lucide-react';
import { FOLDER_NAME } from '../constants';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAuthenticated: boolean;
    onLogin: () => void;
    onLogout: () => void;
}

export default function SettingsModal({
    isOpen,
    isAuthenticated,
    onLogin,
    onLogout
}: SettingsModalProps) {
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);

    const resetClientId = () => {
        if(confirm("Reset all settings? This will clear local data.")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="max-w-md mx-auto mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm animate-in slide-in-from-top-2 absolute left-0 right-0 md:relative md:left-auto md:right-auto shadow-xl md:shadow-none z-50 md:z-auto max-h-[85vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-gray-700">App Settings</span>
             </div>

             {/* Google Sync Section */}
             <div className="bg-white p-3 rounded-lg border border-gray-100 mb-3 shadow-sm">
                 <div className="flex items-center gap-2 mb-2">
                     <Cloud size={16} className="text-blue-500"/>
                     <h3 className="font-medium text-gray-800">Google Backup</h3>
                 </div>
                 <p className="text-xs text-gray-500 mb-3">Sync your data to a folder named "{FOLDER_NAME}" in your Google Drive.</p>
                 
                 {!isAuthenticated ? (
                     <div className="space-y-2">
                         <button onClick={onLogin} className="w-full bg-blue-500 text-white py-2 rounded text-xs font-bold hover:bg-blue-600">
                             Connect Google Drive
                         </button>
                     </div>
                 ) : (
                     <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100">
                         <span className="text-xs text-green-700 font-medium">Synced</span>
                         <button onClick={onLogout} className="text-xs text-red-500 font-medium">Disconnect</button>
                     </div>
                 )}
             </div>

             {/* Navigation Links */}
             <div className="space-y-1 mb-3">
                 <a 
                     href="https://forms.gle/CAMiGKwvQ99RCzdC6"
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors group"
                 >
                     <MessageSquare size={16} className="text-slate-400 group-hover:text-rose-500" />
                     <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">Send Direct Feedback</span>
                 </a>
             </div>

             {/* Advanced Toggle */}
             <div className="border-t border-gray-100 pt-2">
                 <button 
                    onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2 w-full"
                 >
                     <Settings size={12} />
                     {showAdvancedConfig ? 'Hide Advanced Config' : 'Show Advanced Config'}
                 </button>

                 {showAdvancedConfig && (
                     <div className="bg-slate-50 p-3 rounded text-xs space-y-2 animate-in slide-in-from-top-1">
                         <button onClick={resetClientId} className="w-full text-red-400 hover:text-red-500 mt-2 text-[10px]">
                             Reset Application Data
                         </button>
                     </div>
                 )}
             </div>
        </div>
    );
}
