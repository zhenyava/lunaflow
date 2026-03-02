import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Heart, Star, ChevronRight, Lock, Smartphone, Database, Github } from 'lucide-react';
import { LAUNCHED_KEY } from '../constants';

// Feature flag: set to true when we have real reviews to show
const SHOW_REVIEWS = false;

const Testimonial = ({ name, text, stars }: { name: string, text: string, stars: number }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-w-[300px] md:min-w-[350px] snap-center">
    <div className="flex gap-1 mb-3">
      {[...Array(stars)].map((_, i) => (
        <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
    <p className="text-slate-600 mb-4 text-sm leading-relaxed">"{text}"</p>
    <div className="font-semibold text-slate-900 text-sm">- {name}</div>
  </div>
);

interface FeatureProps {
  icon: React.ElementType;
  title: string;
  desc: string;
}

const Feature = ({ icon: Icon, title, desc }: FeatureProps) => (
  <div className="flex flex-col items-center text-center p-6">
    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-4">
      <Icon size={24} />
    </div>
    <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
  </div>
);

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const canonicalHref = new URL('/', window.location.origin).toString();
    const existingLink = document.querySelector<HTMLLinkElement>("link[rel='canonical']");

    if (existingLink) {
      const previousHref = existingLink.href;
      existingLink.href = canonicalHref;
      return () => {
        existingLink.href = previousHref;
      };
    }

    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalHref;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const handleStart = () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    navigate('/calendar');
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 flex flex-col font-sans">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 max-w-6xl mx-auto w-full">
        <div className="text-2xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
          LunaFlow
        </div>
        
        <a 
          href="https://github.com/zhenyava/lunaflow"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-medium text-sm group"
          aria-label="View Source on GitHub"
        >
          <Github size={20} className="group-hover:scale-110 transition-transform" />
        </a>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="px-6 py-12 md:py-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-600 text-xs font-bold mb-6 border border-violet-100">
            <Shield size={12} />
            <span>100% Client-Side Privacy</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            Track your cycle. <br />
            <span className="text-rose-500">Own your data.</span>
          </h1>
          
          <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            The only menstrual tracker that lives entirely in your browser. 
            No hidden servers, no data selling. Syncs exclusively with <b>your</b> Google Drive.
          </p>
          
          <button 
            onClick={handleStart}
            className="group relative inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5"
          >
            Try it free
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <p className="mt-4 text-xs text-slate-400">No credit card required. Open source philosophy.</p>
        </section>

        {/* Features Grid */}
        <section className="bg-white py-20 border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
            <Feature 
              icon={Lock} 
              title="Your Private Cloud" 
              desc="We don't have a database. Your data is encrypted and stored directly in your personal Google Drive App Folder." 
            />
            <Feature 
              icon={Smartphone} 
              title="Works Offline" 
              desc="Built as a PWA. It works perfectly without internet connection and saves locally until you're back online." 
            />
            <Feature 
              icon={Database} 
              title="No Selling Data" 
              desc="Since we don't have servers, we physically cannot see, share, or sell your health data to advertisers." 
            />
          </div>
        </section>

        {/* Social Proof / Reviews - Hidden by feature flag */}
        {SHOW_REVIEWS && (
          <section className="py-20 max-w-6xl mx-auto overflow-hidden">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
                Loved by privacy advocates <Heart className="fill-rose-500 text-rose-500" size={24} />
              </h2>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-8 px-6 no-scrollbar snap-x">
              <Testimonial 
                stars={5}
                text="Finally a tracker that doesn't ask for my email just to start. The Google Drive sync is genius."
                name="Sarah J."
              />
              <Testimonial 
                stars={5}
                text="I was looking for something simple that doesn't bombard me with ads. LunaFlow is beautiful and calm."
                name="Emily R."
              />
              <Testimonial 
                stars={4}
                text="The interface is super clean. I love that I can use it on my phone and laptop and it stays synced."
                name="Jessica M."
              />
              <Testimonial 
                stars={5}
                text="As a developer, I appreciate the client-side architecture. This is how all health apps should be built."
                name="Alex D."
              />
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 py-8 text-center text-slate-400 text-sm border-t border-slate-200">
        <p className="mb-4">&copy; {new Date().getFullYear()} LunaFlow. Your body, your data.</p>
        <div className="flex justify-center gap-6">
           <a href="/pages/privacy.html" className="hover:text-slate-600 hover:underline transition-all">Privacy Policy</a>
           <a href="/pages/terms.html" className="hover:text-slate-600 hover:underline transition-all">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
