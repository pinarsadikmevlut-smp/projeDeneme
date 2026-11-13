import {useState} from 'react';
import {Link,Navigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export default function AuthPage({mode='login'}){
 const isRegister=mode==='register';
 const {loading,authenticated,login,register}=useAuth();
 const location=useLocation();
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const returnTo=location.state?.from?.startsWith('/')&&!location.state.from.startsWith('//')
  ?location.state.from:'/';
 if(!loading&&authenticated)return <Navigate to={returnTo} replace/>;
 async function submit(event){
  event.preventDefault();setError('');setBusy(true);
  try{
   if(isRegister)await register(username,password);
   else await login(username,password);
  }catch(err){setError(err.message||'İşlem gerçekleştirilemedi.');}
  finally{setBusy(false);}
 }
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-[#0B0F17] dark:text-slate-100">
  <section className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
   <div className="mb-2 font-outfit text-3xl font-extrabold text-amber-600">pinarGold</div>
   <p className="mb-7 text-sm text-slate-500 dark:text-slate-400">{isRegister?'Kendi çalışma alanınızı oluşturun.':'Kişisel çalışma alanınıza güvenli giriş yapın.'}</p>
   <h1 className="mb-5 text-2xl font-bold">{isRegister?'Hesap oluştur':'Giriş yap'}</h1>
   <form onSubmit={submit} className="space-y-4">
    <label className="block text-sm font-semibold">Kullanıcı adı
     <input required autoComplete="username" minLength={3} maxLength={40} pattern="[a-zA-Z0-9_.-]{3,40}"
      value={username} onChange={e=>setUsername(e.target.value)}
      className="mt-2 block w-full rounded-xl border border-slate-300 bg-transparent p-3 outline-none focus:border-amber-500 dark:border-slate-600" />
    </label>
    <label className="block text-sm font-semibold">Şifre
     <input required type="password" minLength={isRegister?12:1} maxLength={128}
      autoComplete={isRegister?'new-password':'current-password'} value={password}
      onChange={e=>setPassword(e.target.value)}
      className="mt-2 block w-full rounded-xl border border-slate-300 bg-transparent p-3 outline-none focus:border-amber-500 dark:border-slate-600"/>
    </label>
    {isRegister&&<p className="text-xs text-slate-500">En az 12 karakterli, benzersiz bir şifre kullanın.</p>}
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    <button disabled={busy||loading} type="submit" className="w-full rounded-xl bg-amber-500 p-3 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
     {busy?'İşleniyor...':isRegister?'Hesap oluştur':'Giriş yap'}
    </button>
   </form>
   <p className="mt-6 text-center text-sm text-slate-500">
    {isRegister?'Zaten hesabınız var mı? ':'Hesabınız yok mu? '}
    <Link className="font-semibold text-amber-600 underline" to={isRegister?'/login':'/register'}>
     {isRegister?'Giriş yap':'Kayıt ol'}
    </Link>
   </p>
   <p className="mt-5 text-xs text-slate-500">Oturum anahtarı tarayıcıdaki HttpOnly çerezde saklanır; localStorage'a yazılmaz.</p>
  </section>
 </main>;
}
