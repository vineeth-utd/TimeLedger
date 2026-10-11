export const THEME_STORAGE_KEY = 'theme'

// Runs inline in <head> before first paint. Keep it dependency-free and defensive:
// storage can throw (private mode, blocked site data).
export const themeInitScript = `(function(){try{var t=null;try{t=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=t==='dark';var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m)}m.setAttribute('content',d?'#111827':'#ffffff')}catch(e){}})()`
