export declare class VoiceService {
    private static instance;
    private constructor();
    static getInstance(): VoiceService;
    /**
     * Speak text using text-to-speech
     */
    speak(text: string): Promise<void>;
}
