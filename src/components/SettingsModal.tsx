import { useState } from 'react';
import { Cloud, MessageSquare, Settings, Share2, Link as LinkIcon, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { FOLDER_NAME } from '../constants';
import { shareDriveFile } from '../services/googleService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isAuthenticated: boolean;
    googleClientId: string;
    setGoogleClientId: (id: string) => void;
    onLogin: () => void;
    onLogout: () => void;
    driveFileId: string | null;
    connectSharedFile: (linkOrId: string) => void;
    disconnectSharedFile: () => void;
    isSharedFile: boolean;
    isSharedFileReadOnly: boolean;
}

export default function SettingsModal({
    isOpen,
    isAuthenticated,
    googleClientId,
    setGoogleClientId,
    onLogin,
    onLogout,
    driveFileId,
    connectSharedFile,
    disconnectSharedFile,
    isSharedFile,
    isSharedFileReadOnly
}: SettingsModalProps) {
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    
    // Sharing state
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState<'reader'|'writer'>('reader');
    const [isSharing, setIsSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // Connecting state
    const [connectLink, setConnectLink] = useState('');

    const resetClientId = () => {
        if(confirm("Reset all settings?")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const handleShare = async () => {
        if (!shareEmail || !shareEmail.includes('@')) {
            setShareMessage({ type: 'error', text: 'Enter a valid email' });
            return;
        }
        if (!driveFileId) return;

        setIsSharing(true);
        setShareMessage(null);
        try {
            await shareDriveFile(driveFileId, shareEmail, shareRole);
            setShareMessage({ type: 'success', text: `Shared with ${shareEmail}` });
            setShareEmail('');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to share';
            setShareMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsSharing(false);
        }
    };

    const handleConnect = () => {
        if (!connectLink.trim()) return;
        connectSharedFile(connectLink);
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
                 {!isSharedFile && (
                     <p className="text-xs text-gray-500 mb-3">Sync your data to a folder named "{FOLDER_NAME}" in your Google Drive.</p>
                 )}
                 
                 {!isAuthenticated ? (
                     <div className="space-y-2">
                         {!googleClientId && (
                             <input 
                                type="text" 
                                placeholder="Enter Google Client ID" 
                                className="w-full text-xs p-2 border rounded"
                                onChange={(e) => {
                                    setGoogleClientId(e.target.value);
                                    localStorage.setItem('LUNA_GOOGLE_CLIENT_ID', e.target.value);
                                }}
                                value={googleClientId}
                             />
                         )}
                         <button onClick={onLogin} className="w-full bg-blue-500 text-white py-2 rounded text-xs font-bold hover:bg-blue-600">
                             Connect Google Drive
                         </button>
                     </div>
                 ) : isSharedFile ? (
                     <div className="space-y-2">
                         <div className="flex justify-between items-center bg-violet-50 p-2 rounded border border-violet-100">
                             <div className="flex items-center gap-2">
                                 <Users size={14} className="text-violet-600"/>
                                 <span className="text-xs text-violet-700 font-medium">Connected to Shared Data</span>
                             </div>
                             <button onClick={disconnectSharedFile} className="text-xs text-red-500 font-medium">Disconnect</button>
                         </div>
                         <div className="text-xs text-gray-500 px-1">
                             Permission: <span className="font-semibold text-gray-700">{isSharedFileReadOnly ? 'Read Only' : 'Read & Write'}</span>
                         </div>
                     </div>
                 ) : (
                     <div className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100">
                         <span className="text-xs text-green-700 font-medium">Synced</span>
                         <button onClick={onLogout} className="text-xs text-red-500 font-medium">Disconnect</button>
                     </div>
                 )}
             </div>

             {/* Sharing & Connecting Section */}
             <div className="bg-white p-3 rounded-lg border border-gray-100 mb-3 shadow-sm space-y-4">
                 
                 {/* Share Form (Only for own data) */}
                 {!isSharedFile && isAuthenticated && driveFileId && (
                     <div className="space-y-2 border-b border-slate-100 pb-3">
                         <div className="flex items-center gap-2 mb-1">
                             <Share2 size={16} className="text-rose-500"/>
                             <h3 className="font-medium text-gray-800">Share Data</h3>
                         </div>
                         <p className="text-xs text-gray-500">Allow another user to sync with your data.</p>
                         
                         <input 
                            type="email" 
                            placeholder="Enter their Google email address" 
                            className="w-full text-xs p-2 border rounded"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                         />
                         <div className="flex gap-2">
                             <select 
                                 className="flex-1 text-xs p-2 border rounded bg-white text-gray-700"
                                 value={shareRole}
                                 onChange={(e) => setShareRole(e.target.value as 'reader'|'writer')}
                             >
                                 <option value="reader">Read Only</option>
                                 <option value="writer">Read & Write</option>
                             </select>
                             <button 
                                 onClick={handleShare}
                                 disabled={isSharing || !shareEmail}
                                 className="flex-1 bg-slate-800 text-white py-2 rounded text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                             >
                                 {isSharing ? 'Sharing...' : 'Send Invite'}
                             </button>
                         </div>
                         {shareMessage && (
                             <div className={`flex items-center gap-1 text-xs mt-1 ${shareMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                 {shareMessage.type === 'success' ? <CheckCircle size={12}/> : <AlertCircle size={12}/>}
                                 {shareMessage.text}
                             </div>
                         )}
                         <div className="text-[10px] text-gray-400 mt-2 bg-slate-50 p-2 rounded">
                            Share ID (for them to paste): <br/><span className="font-mono text-gray-600 break-all">{driveFileId}</span>
                         </div>
                     </div>
                 )}

                 {/* Connect Form */}
                 {!isSharedFile && (
                     <div className="space-y-2">
                         <div className="flex items-center gap-2 mb-1">
                             <LinkIcon size={16} className="text-indigo-500"/>
                             <h3 className="font-medium text-gray-800">Connect Shared Data</h3>
                         </div>
                         <p className="text-xs text-gray-500">Paste a Google Drive link or Share ID provided by someone else.</p>
                         
                         <div className="flex gap-2">
                             <input 
                                type="text" 
                                placeholder="Paste link or ID here..." 
                                className="flex-[2] text-xs p-2 border rounded"
                                value={connectLink}
                                onChange={(e) => setConnectLink(e.target.value)}
                             />
                             <button 
                                 onClick={handleConnect}
                                 disabled={!connectLink}
                                 className="flex-1 bg-indigo-500 text-white py-2 rounded text-xs font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                             >
                                 Connect
                             </button>
                         </div>
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
