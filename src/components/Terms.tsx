import React from 'react';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>

        <div className="prose prose-slate max-w-none text-slate-600">
          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h3>
          <p className="mb-4">
            By accessing and using LunaFlow, you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Description of Service</h3>
          <p className="mb-4">
            LunaFlow is a personal health tracking application that runs locally in your browser. It provides tools for tracking menstrual cycles and related symptoms.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Disclaimer</h3>
          <p className="mb-2">
            The content and tools provided by LunaFlow are for informational purposes only. They are not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.
          </p>
          <p className="mt-2 mb-4">
             LunaFlow should not be used as a primary method of birth control or contraception.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. User Responsibilities</h3>
          <p className="mb-4">
            You are responsible for maintaining the confidentiality of your own data by securing your device and your Google Account. Since LunaFlow does not host your data, we cannot recover it if you lose access to your local storage or Google Drive.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Changes to Terms</h3>
          <p className="mb-4">
            We reserve the right to modify these terms from time to time at our sole discretion. Your continued use of the service constitutes your agreement to such changes.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Termination</h3>
          <p className="mb-4">
            We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
