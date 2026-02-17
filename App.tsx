import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { PrescriptionAnalysis, TimeOfDay, PatientInfo, User, Language, UserRole } from './types';
import { geminiService } from './services/geminiService';
import { MOCK_PRESCRIPTION_DATA } from './constants';
import PrescriptionUpload from './components/PrescriptionUpload';
import ScheduleCard from './components/ScheduleCard';
import VoiceAssistant from './components/VoiceAssistant';
import SmartChatbot from './components/SmartChatbot';
import IncomingCallUI from './components/IncomingCallUI';
import VoiceCommandCenter from './components/VoiceCommandCenter';

// --- TRANSLATIONS ---

const UI_STRINGS = {
  en: {
    home: "Home",
    setupProfile: "Setup Profile",
    ageLabel: "Patient Age",
    langLabel: "Language",
    scanBtn: "Analyze Prescription",
    dashboard: "Care Dashboard",
    routine: "When to have it",
    summaryTitle: "Health Intelligence",
    nextDose: "Up Next",
    takeNow: "Due Now",
    allDone: "All medications taken for this slot!",
    dailyPulse: "Daily Adherence Pulse",
    testCallBtn: "Start Test Voice Call",
    safetyCheck: "Safety Check",
    loginTitle: "Enter Care Room",
    loginAction: "Enter Session",
    namePlaceholder: "Your Name",
    testMedName: "Test Vitamin D3",
    testMedInst: "Please take this test dose with a glass of water to verify the voice reminder system is working correctly.",
    allMeds: "Detected Medications"
  },
  hi: {
    home: "मुख्य पृष्ठ",
    setupProfile: "प्रोफ़ाइल सेटअप",
    ageLabel: "रोगी की आयु",
    langLabel: "भाषा",
    scanBtn: "पर्चा स्कैन करें",
    dashboard: "केयर डैशबोर्ड",
    routine: "कब लेनी है",
    summaryTitle: "स्वास्थ्य जानकारी",
    nextDose: "अगली खुराक",
    takeNow: "अभी लेनी है",
    allDone: "इस समय की सभी दवाएं ले ली गई हैं!",
    dailyPulse: "दैनिक दवा की स्थिति",
    testCallBtn: "टेस्ट वॉइस कॉल शुरू करें",
    safetyCheck: "सुरक्षा जांच",
    loginTitle: "देखभाल कक्ष में प्रवेश करें",
    loginAction: "सत्र शुरू करें",
    namePlaceholder: "आपका नाम",
    testMedName: "परीक्षण विटामिन",
    testMedInst: "यह सुनिश्चित करने के लिए कि सिस्टम ठीक से काम कर रहा है, एक गिलास पानी के साथ लें।",
    allMeds: "खोजी गई दवाएं"
  },
  te: {
    home: "హోమ్",
    setupProfile: "ప్రొఫైల్ సెటప్",
    ageLabel: "రోగి వయస్సు",
    langLabel: "భాష",
    scanBtn: "ప్రిస్క్రిప్షన్ స్కాన్ చేయండి",
    dashboard: "కేర్ డాష్‌బోర్డ్",
    routine: "ఎప్పుడు తీసుకోవాలి",
    summaryTitle: "ఆరోగ్య మేధస్సు",
    nextDose: "తదుపరి మోతాదు",
    takeNow: "ఇప్పుడే తీసుకోవాలి",
    allDone: "ఈ సమయానికి సంబంధించిన అన్ని మందులు తీసుకున్నారు!",
    dailyPulse: "రోజువారీ మందుల స్థితి",
    testCallBtn: "టెస్ట్ వాయిస్ కాల్ ప్రారంభించండి",
    safetyCheck: "భద్రతా తనిఖీ",
    loginTitle: "కేర్ రూమ్‌లోకి ప్రవేశించండి",
    loginAction: "సెషన్‌ను ప్రారంభించండి",
    namePlaceholder: "మీ పేరు",
    testMedName: "టెస్ట్ విటమిన్",
    testMedInst: "సిస్టమ్ సరిగ్గా పనిచేస్తోందని నిర్ధారించుకోవడానికి ఒక గ్లాసు నీటితో తీసుకోండి.",
    allMeds: "గుర్తించిన మందులు"
  }
};

const ROLES_LABELS = {
  en: { PATIENT: 'Patient', NURSE: 'Nurse', CHILD: 'Child', GUARDIAN: 'Guardian', SPOUSE: 'Spouse' },
  hi: { PATIENT: 'रोगी', NURSE: 'नर्स', CHILD: 'बच्चा', GUARDIAN: 'अभिभावक', SPOUSE: 'जीवनसाथी' },
  te: { PATIENT: 'రోగి', NURSE: 'నర్స్', CHILD: 'పిల్లలు', GUARDIAN: 'సంరక్షకుడు', SPOUSE: 'భార్య/భర్త' }
};

const getCurrentTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return TimeOfDay.MORNING;
  if (hour >= 12 && hour < 17) return TimeOfDay.AFTERNOON;
  if (hour >= 17 && hour < 21) return TimeOfDay.EVENING;
  return TimeOfDay.NIGHT;
};

const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('scr_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (name: string, role: UserRole) => {
    const newUser: User = { id: 'u1', name, email: `${name.toLowerCase()}@care.com`, role };
    setUser(newUser);
    localStorage.setItem('scr_user', JSON.stringify(newUser));
  };

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('scr_user');
    localStorage.removeItem('scr_taken_keys'); 
  }, []);

  return { user, login, logout, isAuthenticated: !!user };
};

const Nav: React.FC<{ user: User | null; onLogout: () => void; lang: Language }> = ({ user, onLogout, lang }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const labels = UI_STRINGS[lang] || UI_STRINGS.en;
  const roleLabels = ROLES_LABELS[lang] || ROLES_LABELS.en;

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-110 transition-transform">S</div>
            <span className="text-xl font-black text-slate-900 tracking-tighter">SmartCare</span>
          </Link>
          <Link to="/" className={`px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all ${isHome ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
            🏠 {labels.home}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
              <div className="hidden sm:flex flex-col items-end">
                <p className="text-[11px] font-black text-slate-900 leading-none">{user.name}</p>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                  {roleLabels[user.role]}
                </p>
              </div>
              <button onClick={onLogout} className="px-3 py-1.5 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg hover:bg-red-50 hover:text-red-600 transition-all border border-slate-200">Exit</button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

const LandingPage: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white min-h-screen">
      <section className="container mx-auto px-6 py-16 md:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100 mb-8">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Medical Accuracy v3.0</span>
        </div>
        <h1 className="text-6xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter mb-8 text-balance">
          Healthcare from<br/>
          <span className="text-blue-600">Prescription to Protection.</span>
        </h1>
        <p className="text-xl text-slate-500 mb-12 max-w-2xl font-medium leading-relaxed">
          The ultimate care layer that bridges clinician directives with elderly independence.
        </p>
        <button 
          onClick={() => navigate('/app')}
          className="px-14 py-6 bg-slate-900 text-white text-xl font-black rounded-3xl shadow-2xl hover:bg-blue-600 hover:-translate-y-1 active:translate-y-0 transition-all"
        >
          {isAuthenticated ? 'Open Care Dashboard' : 'Start My Care Room'}
        </button>
      </section>
    </div>
  );
};

const MainDashboard: React.FC<{ user: User; patientInfo: PatientInfo; setPatientInfo: (p: PatientInfo) => void }> = ({ user, patientInfo, setPatientInfo }) => {
  const [step, setStep] = useState<'onboarding' | 'upload' | 'dashboard'>('onboarding');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<PrescriptionAnalysis | null>(null);
  const [takenKeys, setTakenKeys] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('scr_taken_keys');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [simulatedTime, setSimulatedTime] = useState<TimeOfDay>(getCurrentTimeOfDay());
  const [testCallActive, setTestCallActive] = useState(false);

  const effectiveAnalysis = useMemo(() => analysis || MOCK_PRESCRIPTION_DATA, [analysis]);
  const labels = UI_STRINGS[patientInfo.language] || UI_STRINGS.en;

  // TEST CALL LOGIC: If a prescription is available, use the first medicine from the list for the test call
  const testCallMed = useMemo(() => {
    if (analysis && analysis.medicines.length > 0) {
      return analysis.medicines[0];
    }
    return {
      name: labels.testMedName,
      dosage: "1 Tablet",
      instructions: labels.testMedInst
    };
  }, [analysis, labels]);

  const nextMedication = useMemo(() => {
    const medsInSlot = effectiveAnalysis.medicines.filter(m => m.timing.includes(simulatedTime));
    return medsInSlot.find(m => !takenKeys.has(`${m.id}-${simulatedTime}`));
  }, [effectiveAnalysis, simulatedTime, takenKeys]);

  const handleDataReady = async (source: string) => {
    setIsProcessing(true);
    try {
      const result = await geminiService.analyzePrescription(source, patientInfo);
      setAnalysis(result);
      setSimulatedTime(TimeOfDay.MORNING);
      setStep('dashboard');
    } catch (err) {
      console.error("Analysis Error:", err);
      setAnalysis(MOCK_PRESCRIPTION_DATA);
      setStep('dashboard');
    } finally { setIsProcessing(false); }
  };

  const markAsTaken = (id: string, time: TimeOfDay) => {
    const next = new Set(takenKeys);
    next.add(`${id}-${time}`);
    setTakenKeys(next);
    localStorage.setItem('scr_taken_keys', JSON.stringify(Array.from(next)));
  };

  const getSlotProgress = (time: TimeOfDay) => {
    const medsInSlot = effectiveAnalysis.medicines.filter(m => m.timing.includes(time));
    if (medsInSlot.length === 0) return 'empty';
    const takenInSlot = medsInSlot.filter(m => takenKeys.has(`${m.id}-${time}`));
    if (takenInSlot.length === medsInSlot.length) return 'complete';
    if (takenInSlot.length > 0) return 'partial';
    return 'pending';
  };

  const timeLabel = (t: TimeOfDay) => {
    if (patientInfo.language === 'hi') {
      switch(t) {
        case TimeOfDay.MORNING: return 'सुबह';
        case TimeOfDay.AFTERNOON: return 'दोपहर';
        case TimeOfDay.EVENING: return 'शाम';
        case TimeOfDay.NIGHT: return 'रात';
      }
    }
    if (patientInfo.language === 'te') {
      switch(t) {
        case TimeOfDay.MORNING: return 'ఉదయం';
        case TimeOfDay.AFTERNOON: return 'మధ్యాహ్నం';
        case TimeOfDay.EVENING: return 'సాయంత్రం';
        case TimeOfDay.NIGHT: return 'రాత్రి';
      }
    }
    return t;
  };

  return (
    <div className="min-h-screen pb-24 bg-[#F8FAFC]">
      {testCallActive && (
        <IncomingCallUI 
          onAccept={() => {
            // Log acceptance but DON'T hide the UI.
            // The UI will switch to the "Answered" state internally.
            console.log("Call answered");
          }}
          onDecline={() => setTestCallActive(false)} // This serves as the true "Close" action
          callerName="Care Reminder Bot"
          medicineName={testCallMed.name}
          dosage={testCallMed.dosage}
          instructions={testCallMed.instructions}
          timeOfDay={simulatedTime}
          lang={patientInfo.language}
        />
      )}

      {step === 'dashboard' && (
        <VoiceCommandCenter 
          medicines={effectiveAnalysis.medicines} 
          currentTime={simulatedTime} 
          onMarkTaken={markAsTaken} 
          lang={patientInfo.language} 
        />
      )}

      <div className="container mx-auto px-6 pt-8">
        {step === 'onboarding' && (
          <div className="max-w-md mx-auto bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100">
            <h2 className="text-4xl font-black text-slate-900 mb-8 tracking-tighter">{labels.setupProfile}</h2>
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{labels.ageLabel}</label>
                <input type="number" className="w-full px-7 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 text-2xl font-black outline-none focus:border-blue-600" placeholder="75" value={patientInfo.age} onChange={e => setPatientInfo({...patientInfo, age: e.target.value})} />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{labels.langLabel}</label>
                <div className="grid grid-cols-3 gap-3">
                  {['en', 'hi', 'te'].map(l => (
                    <button key={l} onClick={() => setPatientInfo({...patientInfo, language: l as Language})} className={`py-4 rounded-2xl border-2 font-black text-sm transition-all ${patientInfo.language === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-100'}`}>
                      {l === 'en' ? 'EN' : l === 'hi' ? 'हिंदी' : 'తెలుగు'}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep('upload')} className="w-full py-6 bg-blue-600 text-white text-xl font-black rounded-3xl shadow-xl hover:scale-105 transition-all">
                {labels.scanBtn}
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && <PrescriptionUpload onUpload={handleDataReady} isProcessing={isProcessing} />}

        {step === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* DAILY PULSE SUMMARY */}
            <div className="bg-slate-900 rounded-[3.5rem] p-8 md:p-12 shadow-3xl text-white">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                   <h2 className="text-3xl font-black tracking-tighter mb-2">{labels.dailyPulse}</h2>
                   <p className="text-blue-400 font-bold text-sm uppercase tracking-widest opacity-80">Track your progress across the day</p>
                </div>
                <div className="flex gap-4 md:gap-8 overflow-x-auto pb-2 w-full md:w-auto">
                   {Object.values(TimeOfDay).map(t => {
                      const status = getSlotProgress(t);
                      return (
                        <div key={t} className="flex flex-col items-center gap-3 shrink-0">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 transition-all ${
                              status === 'complete' ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]' :
                              status === 'partial' ? 'bg-amber-500 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]' :
                              status === 'empty' ? 'bg-slate-800 border-slate-700 opacity-40' :
                              'bg-slate-800 border-slate-700'
                           }`}>
                              {t === TimeOfDay.MORNING ? '🌅' : t === TimeOfDay.AFTERNOON ? '☀️' : t === TimeOfDay.EVENING ? '🌇' : '🌙'}
                           </div>
                           <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'complete' ? 'text-emerald-400' : 'text-slate-500'}`}>{timeLabel(t)}</span>
                        </div>
                      );
                   })}
                </div>
              </div>
            </div>

            {/* PULSE BANNER */}
            <div className={`p-8 rounded-[3.5rem] border-4 transition-all ${nextMedication ? 'bg-blue-600 border-blue-500 text-white shadow-[0_20px_60px_rgba(37,99,235,0.4)]' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
               <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl backdrop-blur-md">
                      {nextMedication ? '💊' : '✨'}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.4em] opacity-80">{nextMedication ? labels.nextDose : labels.allDone}</h4>
                      <p className="text-3xl font-black tracking-tighter">
                        {nextMedication ? `${nextMedication.name} (${nextMedication.dosage})` : labels.allDone}
                      </p>
                    </div>
                 </div>
                 {nextMedication && (
                    <button onClick={() => markAsTaken(nextMedication.id, simulatedTime)} className="px-10 py-4 bg-white text-blue-600 font-black rounded-2xl shadow-xl hover:scale-105 transition-all">
                       {labels.takeNow}
                    </button>
                 )}
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <h3 className="font-black text-slate-900 text-2xl tracking-tight">{labels.routine}</h3>
                      <p className="text-[10px] font-black text-blue-500 mt-1 uppercase tracking-widest">Showing: {timeLabel(simulatedTime)}</p>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto">
                      {Object.values(TimeOfDay).map(t => (
                        <button key={t} onClick={() => setSimulatedTime(t)} className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all whitespace-nowrap ${simulatedTime === t ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>
                          {timeLabel(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <ScheduleCard 
                      time={simulatedTime} 
                      medicines={effectiveAnalysis.medicines.filter(m => m.timing.includes(simulatedTime))} 
                      takenKeys={takenKeys} 
                      onMarkTaken={markAsTaken}
                      lang={patientInfo.language}
                    />
                    <div className="hidden sm:block">
                        <div className="p-8 bg-white border border-slate-200 rounded-[3rem] h-full flex flex-col">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-1">{labels.allMeds} ({effectiveAnalysis.medicines.length})</h4>
                            <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
                                {effectiveAnalysis.medicines.map(m => (
                                    <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                                        <div className="truncate">
                                            <p className="text-sm font-black text-slate-900 truncate">{m.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.timing.join(', ')}</p>
                                        </div>
                                        <div className="shrink-0 text-xl">💊</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                <div className="p-8 bg-blue-50 rounded-[3.5rem] border border-blue-100 shadow-sm">
                   <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">{labels.safetyCheck}</h4>
                   <p className="text-blue-900/60 text-sm font-bold leading-relaxed mb-6">Verify the clinical safety protocol with a test voice call.</p>
                   <button 
                    onClick={() => setTestCallActive(true)}
                    className="w-full py-5 bg-white text-blue-600 font-black rounded-2xl shadow-md border-2 border-blue-200 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95"
                   >
                     <span className="text-xl">📞</span> {labels.testCallBtn}
                   </button>
                </div>

                <div className="p-8 bg-white rounded-[3.5rem] border border-slate-200 shadow-lg">
                   <h4 className="text-sm font-black text-slate-800 mb-4">{labels.summaryTitle}</h4>
                   <p className="text-slate-600 text-sm font-bold leading-relaxed mb-8 italic">"{effectiveAnalysis.summary}"</p>
                   <VoiceAssistant text={effectiveAnalysis.summary} lang={patientInfo.language} />
                </div>

                <SmartChatbot 
                  analysis={effectiveAnalysis} 
                  onSetReminders={() => {}} 
                  activePreference={'voice'} 
                  patientInfo={patientInfo} 
                  role={user.role}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LoginPage: React.FC<{ onLogin: (n: string, r: UserRole) => void; lang: Language }> = ({ onLogin, lang }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('PATIENT');
  const navigate = useNavigate();
  const labels = UI_STRINGS[lang] || UI_STRINGS.en;
  const roleLabels = ROLES_LABELS[lang] || ROLES_LABELS.en;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl text-center border border-slate-100">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center text-white text-4xl font-black mb-8 shadow-xl">S</div>
        <h2 className="text-3xl font-black mb-8 tracking-tighter">{labels.loginTitle}</h2>
        <input type="text" className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 text-lg font-bold mb-6 outline-none focus:border-blue-600" placeholder={labels.namePlaceholder} value={name} onChange={e => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3 mb-8">
          {(['PATIENT', 'NURSE', 'CHILD', 'GUARDIAN', 'SPOUSE'] as UserRole[]).map(r => (
            <button key={r} onClick={() => setRole(r)} className={`py-3 rounded-xl border-2 font-black text-[10px] transition-all ${role === r ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100'}`}>
              {roleLabels[r]}
            </button>
          ))}
        </div>
        <button onClick={() => { if(name) { onLogin(name, role); navigate('/app'); } }} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
          {labels.loginAction}
        </button>
      </div>
    </div>
  );
};

const ApiKeyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkKey = async () => {
      const win = window as any;
      if (!win.aistudio) { setHasKey(true); return; }
      try { const s = await win.aistudio.hasSelectedApiKey(); setHasKey(s); } catch (e) { setHasKey(true); }
    };
    checkKey();
  }, []);

  if (hasKey === null) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black">Booting System...</div>;
  if (!hasKey) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-12 rounded-[4rem] text-center shadow-2xl">
        <h2 className="text-3xl font-black mb-6 tracking-tighter">Activate System</h2>
        <p className="text-slate-500 font-bold mb-8">Please select a valid API key to enable clinical scanning.</p>
        <button onClick={async () => { await (window as any).aistudio.openSelectKey(); setHasKey(true); }} className="w-full bg-blue-600 text-white px-12 py-6 rounded-3xl font-black text-xl shadow-xl">
          Activate API Key
        </button>
      </div>
    </div>
  );
  return <>{children}</>;
};

const App: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({ age: '', condition: 'General Health', language: 'en', caregiverRelationship: 'Self' });
  
  const handleLogout = () => { logout(); window.location.reload(); };

  return (
    <Router>
      <ApiKeyGuard>
        <Nav user={user} onLogout={handleLogout} lang={patientInfo.language} />
        <Routes>
          <Route path="/" element={<LandingPage isAuthenticated={isAuthenticated} />} />
          <Route path="/login" element={<LoginPage onLogin={login} lang={patientInfo.language} />} />
          <Route path="/app" element={isAuthenticated ? <MainDashboard user={user!} patientInfo={patientInfo} setPatientInfo={setPatientInfo} /> : <Navigate to="/login" />} />
        </Routes>
      </ApiKeyGuard>
    </Router>
  );
};

export default App;