import { Cloud, MessageSquare, Settings } from 'lucide-react';
import type { ICloudStorageProvider } from '../cloudStorage';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAuthenticated: boolean;
    availableProviders: ICloudStorageProvider[];
    onLogin: (providerId: string) => void;
    onLogout: () => void;
}

export default function SettingsModal({
    isOpen,
    isAuthenticated,
    availableProviders,
    onLogin,
    onLogout
}: SettingsModalProps) {
    const resetAppData = () => {
        if (confirm('Reset all settings?')) {
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

             {/* Cloud Sync Section */}
             <div className="bg-white p-3 rounded-lg border border-gray-100 mb-3 shadow-sm">
                 <div className="flex items-center gap-2 mb-2">
                     <Cloud size={16} className="text-blue-500"/>
                     <h3 className="font-medium text-gray-800">Cloud Backup</h3>
                 </div>

                 {availableProviders.map((provider) => (
                     <div key={provider.id}>
                         <p className="text-xs text-gray-500 mb-3">
                             Sync your data using {provider.displayName}.
                         </p>
                         {!isAuthenticated ? (
                             <button
                                 onClick={() => onLogin(provider.id)}
                                 className="w-full bg-blue-500 text-white py-2 rounded text-xs font-bold hover:bg-blue-600"
                             >
                                 Connect {provider.displayName}
                             </button>
                         ) : (
                             <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100">
                                 <span className="text-xs text-green-700 font-medium">
                                     Synced via {provider.displayName}
                                 </span>
                                 <button onClick={onLogout} className="text-xs text-red-500 font-medium">
                                     Disconnect
                                 </button>
                             </div>
                         )}
                     </div>
                 ))}
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

             {/* Advanced Section */}
             <div className="border-t border-gray-100 pt-2">
                 <details className="group">
                     <summary className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer list-none mb-2">
                         <Settings size={12} />
                         <span>Advanced Config</span>
                     </summary>
                     <div className="bg-slate-50 p-3 rounded text-xs space-y-2 animate-in slide-in-from-top-1">
                         <button onClick={resetAppData} className="w-full text-red-400 hover:text-red-500 mt-2 text-[10px]">
                             Reset Application Data
                         </button>
                     </div>
                 </details>
             </div>
        </div>
    );
}
