import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const env=import.meta.env;
const firebaseApiKey = env.VITE_FIREBASE_API_KEY || 'AIzaSyDQUxnCBKCv6gGwhLftUfChw70ognmGzdg';
const firebaseAuthDomain = env.VITE_FIREBASE_AUTH_DOMAIN || 'ai-gym-and-diet-manager.firebaseapp.com';
const firebaseProjectId = env.VITE_FIREBASE_PROJECT_ID || 'ai-gym-and-diet-manager';
const firebaseStorageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || 'ai-gym-and-diet-manager.firebasestorage.app';
const firebaseMessagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '192235480112';
const firebaseAppId = env.VITE_FIREBASE_APP_ID || '1:192235480112:web:266dfcdb679a76b56ff9f5';
const firebaseMeasurementId = env.VITE_FIREBASE_MEASUREMENT_ID || 'G-3X3FKZB960';

export const configured = Boolean(firebaseApiKey && firebaseProjectId && firebaseAppId);
const existingApps = getApps();
const app = configured ? (existingApps.length > 0 ? existingApps[0] : initializeApp({
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: firebaseMessagingSenderId,
  appId: firebaseAppId,
  measurementId: firebaseMeasurementId
})) : null;
if (app && env.VITE_RECAPTCHA_SITE_KEY && existingApps.length === 0) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
export const auth = app ? (typeof window === 'undefined' ? getAuth(app) : (existingApps.length > 0 ? getAuth(app) : initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver }))) : null;
export const db = app ? (existingApps.length > 0 ? getFirestore(app) : initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })) : null;
export const functions = app ? getFunctions(app, env.VITE_FIREBASE_REGION || 'southamerica-east1') : null;
if (import.meta.env.DEV && env.VITE_USE_FIREBASE_EMULATORS === 'true' && auth && db) {
 connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
 connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
export function authErrorMessage(error:unknown){
 const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'';
 if(code==='auth/configuration-not-found')return 'Ative Authentication no console Firebase e habilite o provedor E-mail/senha para este projeto.';
 if(code==='auth/operation-not-allowed')return 'O provedor E-mail/senha ainda está desativado no Firebase. Habilite-o em Authentication → Sign-in method.';
 if(code==='auth/email-already-in-use')return 'Este e-mail já tem uma conta. Entre ou recupere a senha.';
 if(code==='auth/network-request-failed')return 'Não foi possível conectar ao Firebase. Confira sua conexão e tente novamente.';
 if(code==='auth/too-many-requests')return 'Muitas tentativas de acesso. Aguarde um pouco e tente novamente.';
 return 'Não foi possível entrar. Confira o e-mail e a senha ou recupere seu acesso.';
}
