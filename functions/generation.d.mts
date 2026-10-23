export function generateContent(body: any, keys: {deepseek?:string;gemini?:string}, transport?:typeof fetch): Promise<{status:number;body:any}>;
export function needsMediaCompatibility(body:any): boolean;
export function deepseekRequest(body:any): any;
