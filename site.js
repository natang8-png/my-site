(function(){
  var start=new Date(2026,9,10), now=new Date();
  var d=Math.max(0,Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-start)/864e5));
  var el=document.getElementById('days');
  if(el){el.textContent=d;
  document.getElementById('days-label').textContent=(d===1?'יום':'ימים')+' מאז שנשתל, ב־10 באוקטובר 2026';}
  var root=document.documentElement, btn=document.getElementById('theme');
  function isDark(){var t=root.getAttribute('data-theme');return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
  function label(){btn.textContent=isDark()?'מצב בהיר':'מצב כהה'}
  try{var s=localStorage.getItem('theme');if(s)root.setAttribute('data-theme',s)}catch(e){}
  label();
  btn.addEventListener('click',function(){var n=isDark()?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('theme',n)}catch(e){}label()});
})();
