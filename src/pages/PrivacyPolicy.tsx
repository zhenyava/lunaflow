import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <Link to="/" className="inline-flex items-center gap-2 text-rose-500 hover:text-rose-600 mb-8 font-medium">
          <ArrowLeft size={20} />
          Back to App
        </Link>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-slate max-w-none text-slate-600">
          <p>
            LunaFlow ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our application works and how it handles your data.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Data Storage and Ownership</h3>
          <p>
            LunaFlow is a <strong>client-side only</strong> application. This means:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>We do not have a backend server.</li>
            <li>We do not create accounts or passwords for you on our systems.</li>
            <li>All your health data, cycle logs, and settings are stored locally on your device or in your personal Google Drive (if Sync is enabled).</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Google User Data (Limited Use Disclosure)</h3>
          <p>
            LunaFlow uses Google Drive API services to allow you to sync your data across devices. 
            If you choose to sign in with Google:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              <strong>Access:</strong> The app accesses only the specific files it creates in your Google Drive (`appDataFolder`). It cannot see or access your other Google Drive files.
            </li>
            <li>
              <strong>Use:</strong> The app uses this access solely to read and write your encrypted cycle data JSON file (`lunaflow_data.json`) to sync your history across your devices.
            </li>
            <li>
              <strong>Storage:</strong> Your data remains in your personal Google Drive account. We do not transfer your data to any other server or third-party database.
            </li>
            <li>
              <strong>Sharing:</strong> LunaFlow does not share, transfer, or disclose Google User Data to any third parties.
            </li>
          </ul>
          <p className="italic text-sm mt-2">
            LunaFlow's use and transfer to any other app of information received from Google APIs will adhere to 
            <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" rel="noreferrer" className="text-rose-500 hover:underline"> Google API Services User Data Policy</a>, 
            including the Limited Use requirements.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Data Collection</h3>
          <p>
            Since we have no servers, we do not collect, analyze, or track your personal usage data. 
            We do not use tracking cookies or third-party analytics services that share your personal health information.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Contact Us</h3>
          <p>
            If you have any questions about this Privacy Policy, please contact us at [Insert Your Support Email Here].
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
