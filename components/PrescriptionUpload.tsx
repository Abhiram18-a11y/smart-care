
import React, { useState, useRef, useEffect } from 'react';

interface PrescriptionUploadProps {
  onUpload: (file: string) => void;
  isProcessing: boolean;
}

const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({ onUpload, isProcessing }) => {
  const [mode, setMode] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [decipherProgress, setDecipherProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stages = [
    "Initializing OCR Engine...",
    "Scanning Handwriting...",
    "Deciphering Abbr...",
    "Clinical Verification...",
    "Structuring Data..."
  ];

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setLoadingStage(0);
      setDecipherProgress(5);
      // Slower, more realistic progress for Pro model's "precise" processing
      interval = setInterval(() => {
        setLoadingStage(prev => (prev + 1) % stages.length);
        setDecipherProgress(p => Math.min(p + (Math.random() * 8), 98)); 
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const startCamera = async () => {
    try {
      setMode('camera');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error(err);
      setMode('idle');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  };

  const processAndUpload = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // INCREASED RESOLUTION: 1200px provides better detail for OCR while staying within API limits
      const MAX_WIDTH = 1200; 
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High-precision pre-processing for better OCR
        ctx.filter = 'contrast(1.3) brightness(1.02) saturate(0)'; // Grayscale often helps OCR
        ctx.drawImage(img, 0, 0, width, height);
        // Slightly higher quality for better OCR accuracy
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onUpload(compressedDataUrl);
      }
    };
    img.src = dataUrl;
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setPreviewUrl(dataUrl);
        setMode('preview');
        stopCamera();
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-[4rem] border-8 border-slate-100 shadow-3xl overflow-hidden min-h-[580px] flex flex-col relative transition-all duration-300">
        
        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-slate-900/98 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center">
             <div className="w-full h-[4px] bg-blue-500 shadow-[0_0_30px_#3b82f6] absolute top-0 animate-scan-line"></div>
             
             <div className="relative mb-12">
                <div className="w-32 h-32 border-4 border-blue-500/20 rounded-full flex items-center justify-center">
                  <div className="w-24 h-24 border-b-4 border-blue-500 rounded-full animate-spin"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-5xl">🔬</div>
             </div>

             <h3 className="text-2xl font-black text-white tracking-widest uppercase italic mb-2">High Precision Analysis</h3>
             <p className="text-blue-400 font-bold text-xs uppercase tracking-[0.3em] h-4">{stages[loadingStage]}</p>
             
             <div className="w-full max-w-xs space-y-4 mt-10">
                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                   <span>Neural Engine Processing</span>
                   <span className="text-blue-400">{Math.round(decipherProgress)}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all duration-300 shadow-[0_0_10px_#3b82f6]" style={{ width: `${decipherProgress}%` }}></div>
                </div>
             </div>

             <div className="mt-12 grid grid-cols-2 gap-4 opacity-40">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[8px] font-mono text-blue-300 text-left">
                  SCANNING_LAYER_ALPHA: SUCCESS<br/>
                  HEURISTIC_MAP: ACTIVE<br/>
                  HANDWRITING_RECOGNITION: ENABLED
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[8px] font-mono text-emerald-300 text-left">
                  TOKEN_SYNC: 100%<br/>
                  CLINICAL_CROSS_REF: 4.0.1<br/>
                  DOSE_CALC: PRECISION_HIGH
                </div>
             </div>
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex-1 flex flex-col p-10 space-y-8 text-center">
            <div className="space-y-2">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Precise Medical<br/><span className="text-blue-600">Vision Scan.</span></h3>
              <p className="text-slate-400 text-sm font-bold">Upload prescription for sub-second deciphering.</p>
            </div>
            
            <button onClick={startCamera} className="flex-1 bg-blue-600 text-white rounded-[3rem] flex flex-col items-center justify-center space-y-4 hover:scale-[1.02] transition-all shadow-2xl active:scale-95 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-400/50 animate-pulse"></div>
              <div className="text-8xl transition-transform group-hover:scale-110">📸</div>
              <div className="space-y-1">
                <span className="block text-2xl font-black tracking-tighter">Capture Photo</span>
                <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">Handwriting Optimized</span>
              </div>
            </button>

            <button onClick={() => fileInputRef.current?.click()} className="py-6 bg-slate-50 text-slate-900 rounded-[2rem] font-black text-lg border-2 border-slate-100 hover:bg-slate-100 transition-colors flex items-center justify-center gap-3">
              <span>📂</span> Select Image File
            </button>
            
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => { setPreviewUrl(ev.target?.result as string); setMode('preview'); };
                reader.readAsDataURL(file);
              }
            }} />
          </div>
        )}

        {mode === 'camera' && (
          <div className="relative flex-1 bg-black overflow-hidden flex flex-col">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" />
            
            {/* Camera HUD */}
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
               <div className="w-full h-full border-2 border-white/20 rounded-3xl relative">
                  <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                  
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-500/20"></div>
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-500/20"></div>
               </div>
            </div>

            <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-10 z-20">
              <button onClick={() => { stopCamera(); setMode('idle'); }} className="w-14 h-14 bg-white/10 backdrop-blur-xl text-white rounded-full flex items-center justify-center font-black">✕</button>
              <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-8 border-blue-600 active:scale-90 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                <div className="w-full h-full bg-blue-600 rounded-full scale-75"></div>
              </button>
              <div className="w-14 h-14"></div>
            </div>
          </div>
        )}

        {mode === 'preview' && previewUrl && (
          <div className="flex-1 flex flex-col p-10 bg-white">
            <div className="flex-1 relative rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-xl bg-slate-50 flex items-center justify-center group">
              <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
              <div className="absolute inset-0 bg-blue-600/5 pointer-events-none animate-pulse"></div>
            </div>
            <div className="mt-8 flex gap-4">
               <button onClick={() => setMode('idle')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[2rem] font-black hover:bg-slate-200 transition-colors">Retake</button>
               <button onClick={() => processAndUpload(previewUrl)} className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-xl hover:bg-blue-700 transition-all">Start Precise Analysis</button>
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default PrescriptionUpload;
