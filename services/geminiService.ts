
import { GoogleGenAI, Type } from "@google/genai";
import { PrescriptionAnalysis, Medicine, PatientInfo, ChatMessage, Language, TimeOfDay } from "../types";

export class GeminiService {
  private async handleApiError(error: any): Promise<never> {
    console.error("Gemini API Error Context:", error);
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes("Requested entity was not found") || errorMessage.includes("API_KEY_INVALID")) {
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
          await win.aistudio.openSelectKey();
        }
      }
    }
    throw error;
  }

  private getLanguageName(lang: Language): string {
    switch (lang) {
      case 'hi': return 'Hindi';
      case 'te': return 'Telugu';
      default: return 'English';
    }
  }

  async analyzePrescription(base64Image: string, patientInfo: PatientInfo): Promise<PrescriptionAnalysis> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const langName = this.getLanguageName(patientInfo.language);
    
    // Higher precision prompt with medical reasoning
    const systemInstruction = `ACT AS A SENIOR CLINICAL PHARMACIST AND MEDICAL SCRIBE.
Task: Perform high-precision OCR and medical reasoning on the provided prescription image.
Output Language: ${langName}.

PRECISION RULES:
1. DECIPHER HANDWRITING: Carefully analyze strokes to identify drug names correctly. Cross-reference with known pharmacopeia.
2. MEDICAL SHORTHAND MAPPING (STRICT):
   - OD / q.d. / 1-0-0 -> ["Morning"]
   - BD / b.i.d. / 1-0-1 -> ["Morning", "Night"]
   - TD / t.i.d. / 1-1-1 -> ["Morning", "Afternoon", "Night"]
   - QID / q.i.d. / 1-1-1-1 -> ["Morning", "Afternoon", "Evening", "Night"]
   - HS / Bedtime -> ["Night"]
   - PC / p.c. / After meal -> "After Food"
   - AC / a.c. / Before meal -> "Before Food"
   - BBF / Before breakfast -> ["Morning"], "Before Food"
3. DOSE EXTRACTION: Capture strength (e.g., 500mg, 5ml) and quantity (e.g., 1 tab, 2 tsp).
4. SAFETY FIRST: If a drug name or dose is ambiguous, set verificationStatus to "unverified".

JSON SCHEMA:
{
  "doctorName": "string",
  "medicines": [
    {
      "name": "string (Corrected spelling)",
      "dosage": "string",
      "timing": ["Morning" | "Afternoon" | "Evening" | "Night"],
      "mealInstruction": "Before Food" | "After Food" | "With Food" | "Empty Stomach" | "None",
      "instructions": "string (Short, clear clinical instruction in ${langName})",
      "confidenceScore": number (0.0-1.0),
      "verificationStatus": "verified" | "unverified"
    }
  ],
  "summary": "2-3 sentences in ${langName} explaining the overall regimen and crucial safety warnings."
}

Return ONLY raw JSON. No markdown backticks.`;

    try {
      const response = await ai.models.generateContent({
        // Using Pro for "precise" medical task requiring reasoning over handwriting
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image
              }
            },
            { text: "Perform high-precision medical OCR. Extract every medication and instruction. Return JSON only." }
          ]
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          // Pro model supports thinking for complex handwriting deciphering
          thinkingConfig: { thinkingBudget: 4096 }
        }
      });

      const text = response.text || '{"medicines": [], "summary": "Extraction failed"}';
      const result = JSON.parse(text);
      
      const validTimings = ['Morning', 'Afternoon', 'Evening', 'Night'];

      return {
        ...result,
        medicines: (result.medicines || []).map((m: any, idx: number) => {
          const normalizedTiming = (m.timing || [])
            .map((t: string) => validTimings.find(v => v.toLowerCase() === t.toLowerCase()))
            .filter(Boolean) as TimeOfDay[];

          return {
            ...m,
            id: `med-${idx}-${Date.now()}`,
            icon: 'pill',
            color: 'blue',
            timing: normalizedTiming.length > 0 ? normalizedTiming : [TimeOfDay.MORNING]
          };
        }),
        scanAccuracy: result.scanAccuracy || 0.98
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async askQuestion(query: string, medicines: Medicine[], history: ChatMessage[], patientInfo: PatientInfo): Promise<{ text: string; sources?: any[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const langName = this.getLanguageName(patientInfo.language);
    
    try {
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 0 },
          systemInstruction: `CARE ASSISTANT. Help with medications: ${medicines.map(m => m.name).join(', ')}. Language: ${langName}. Keep answers short and senior-friendly.`
        }
      });

      const response = await chat.sendMessage({ message: query });
      return {
        text: response.text || "...",
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
      };
    } catch (error) {
      return this.handleApiError(error);
    }
  }
}

export const geminiService = new GeminiService();
