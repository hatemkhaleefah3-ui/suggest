import {FIREBASE_CONFIG} from "../config.js";
const VERSION="11.10.0";
const BASE="https://www.gstatic.com/firebasejs/"+VERSION+"/";
let modulesPromise=null,authInstance=null,appInstance=null;
export function configured(){return Boolean(FIREBASE_CONFIG.apiKey&&!FIREBASE_CONFIG.apiKey.startsWith("PASTE_")&&FIREBASE_CONFIG.projectId&&!FIREBASE_CONFIG.projectId.startsWith("PASTE_"));}
export async function firebaseModules(){
 if(!configured())throw Object.assign(Error("Firebase has not been configured"),{code:"auth/not-configured"});
 if(!modulesPromise)modulesPromise=Promise.all([import(BASE+"firebase-app.js"),import(BASE+"firebase-auth.js"),import(BASE+"firebase-firestore.js")]).then(([app,auth,firestore])=>{
  appInstance=app.getApps().length?app.getApp():app.initializeApp(FIREBASE_CONFIG);
  authInstance=auth.getAuth(appInstance);
  return {app,auth,firestore,instance:appInstance,authInstance};
 }).catch(error=>{modulesPromise=null;throw error;});
 return modulesPromise;
}
export async function getAuth(){return (await firebaseModules()).authInstance;}
export async function onAuthChange(callback){
 if(!configured()){callback(null);return()=>{};}
 const {auth,authInstance}=await firebaseModules();
 return auth.onAuthStateChanged(authInstance,callback,error=>callback(null,error));
}
export async function signUp(email,password,name=""){
 const {auth,authInstance}=await firebaseModules();
 const result=await auth.createUserWithEmailAndPassword(authInstance,email.trim(),password);
 if(name.trim())await auth.updateProfile(result.user,{displayName:name.trim()});
 return result.user;
}
export async function signIn(email,password){const {auth,authInstance}=await firebaseModules();return (await auth.signInWithEmailAndPassword(authInstance,email.trim(),password)).user;}
export async function googleSignIn(){const {auth,authInstance}=await firebaseModules();const provider=new auth.GoogleAuthProvider();return (await auth.signInWithPopup(authInstance,provider)).user;}
export async function resetPassword(email){const {auth,authInstance}=await firebaseModules();return auth.sendPasswordResetEmail(authInstance,email.trim());}
export async function signOut(){const {auth,authInstance}=await firebaseModules();await auth.signOut(authInstance);}
export async function updateDisplayName(name){const {auth,authInstance}=await firebaseModules();if(!authInstance.currentUser)throw Error("Not signed in");await auth.updateProfile(authInstance.currentUser,{displayName:name.trim()});}
export async function reauthenticate(password){
 const {auth,authInstance}=await firebaseModules(),user=authInstance.currentUser;
 if(!user)throw Error("Not signed in");
 const google=user.providerData.some(x=>x.providerId==="google.com");
 if(google)return auth.reauthenticateWithPopup(user,new auth.GoogleAuthProvider());
 return auth.reauthenticateWithCredential(user,auth.EmailAuthProvider.credential(user.email,password));
}
export async function deleteAuthAccount(){const {auth,authInstance}=await firebaseModules();if(!authInstance.currentUser)throw Error("Not signed in");await auth.deleteUser(authInstance.currentUser);}
export function authMessage(error,t){
 const code=error?.code||"";
 const mappings={"auth/invalid-email":"authInvalidEmail","auth/email-already-in-use":"authEmailUsed","auth/weak-password":"authWeakPassword","auth/invalid-credential":"authInvalidCredential","auth/wrong-password":"authInvalidCredential","auth/user-not-found":"authInvalidCredential","auth/popup-closed-by-user":"authCancelled","auth/popup-blocked":"authPopupBlocked","auth/network-request-failed":"authNetwork","auth/too-many-requests":"authRateLimited","auth/requires-recent-login":"authRecentLogin","auth/unauthorized-domain":"authUnauthorizedDomain","auth/not-configured":"authNotConfigured"};
 return t(mappings[code]||"errorGeneric");
}
