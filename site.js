(function(){
  var start=new Date(2026,9,10), now=new Date();
  var d=Math.max(0,Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-start)/864e5));
  var el=document.getElementById('days');
  if(el){el.textContent=d;
  document.getElementById('days-label').textContent=(d===1?'יום':'ימים')+' מאז שנשתל, ב־10 באוקטובר 2026';}
  // "נגישות": reading preferences kept on this device (font size, background, dark mode, accessibility).
  var root=document.documentElement, btn=document.getElementById('theme');
  // Height of the bottom bar, so the section bar above it never leaves a gap.
  var foot=document.querySelector('footer');
  function footH(){if(foot)root.style.setProperty('--foot-h',foot.offsetHeight+'px')}
  footH();addEventListener('resize',footH);addEventListener('load',footH);
  var DEF={size:100,bg:'',theme:'',contrast:false,bright:100,plain:false,spacing:false,links:false,motion:false,menu:''};
  var P=Object.assign({},DEF);
  try{Object.assign(P,JSON.parse(localStorage.getItem('prefs')||'{}'));var old=localStorage.getItem('theme');if(old&&!P.theme)P.theme=old}catch(e){}
  function apply(){
    root.style.fontSize=P.size===100?'':P.size+'%';
    if(P.theme)root.setAttribute('data-theme',P.theme);else root.removeAttribute('data-theme');
    if(P.bg)root.setAttribute('data-bg',P.bg);else root.removeAttribute('data-bg');
    if(P.menu)root.setAttribute('data-menu',P.menu);else root.removeAttribute('data-menu');
    root.classList.toggle('a-contrast',!!P.contrast);root.classList.toggle('a-plain',!!P.plain);
    root.classList.toggle('a-spacing',!!P.spacing);root.classList.toggle('a-links',!!P.links);root.classList.toggle('a-motion',!!P.motion);
    root.style.setProperty('--bright',P.bright/100);root.classList.toggle('a-bright',P.bright!==100);
  }
  function save(){try{localStorage.setItem('prefs',JSON.stringify(P))}catch(e){}apply();paint()}
  apply();
  if(!btn)return;
  btn.textContent='נגישות';btn.setAttribute('aria-haspopup','dialog');
  var dlg=document.createElement('dialog');dlg.className='prefs';dlg.setAttribute('dir','rtl');
  function seg(key,opts){return '<div class="seg" data-k="'+key+'">'+opts.map(function(o){return '<button type="button" data-v="'+o[0]+'">'+o[1]+'</button>'}).join('')+'</div>'}
  function tog(key,label,hint){return '<label class="tog"><input type="checkbox" data-t="'+key+'"><span><b>'+label+'</b><small>'+hint+'</small></span></label>'}
  dlg.innerHTML='<div class="p-head"><h2>נגישות</h2><button type="button" class="x" data-close aria-label="סגירה">✕</button></div>'+
    '<h3 class="grp">עיצוב</h3><h3>גודל אותיות</h3><div class="size"><button type="button" data-size="-10" aria-label="הקטנה">א־</button><output id="p-size"></output><button type="button" data-size="10" aria-label="הגדלה">א+</button></div>'+
    '<h3>צבע רקע</h3>'+seg('bg',[['','רגיל'],['white','לבן'],['cream','שמנת'],['gray','אפור']])+
    '<h3>מצב תצוגה</h3>'+seg('theme',[['','אוטומטי'],['light','בהיר'],['dark','כהה']])+
    '<h3>תפריט הכותרות בפרק</h3>'+seg('menu',[['','חלון מלמטה'],['full','מסך מלא']])+
    '<div class="a11y"><h3 class="grp">נגישות</h3>'+
      '<h3>בהירות</h3><input type="range" min="70" max="130" step="5" data-bright aria-label="בהירות">'+
      tog('contrast','ניגודיות גבוהה','טקסט כהה יותר וקווים בולטים')+
      tog('plain','גופן פשוט','בלי גופן מעוצב בכותרות')+
      tog('spacing','ריווח שורות גדול','יותר רווח בין השורות')+
      tog('links','הדגשת קישורים','קו תחתון לכל קישור')+
      tog('motion','בלי אנימציות','עוצר תנועה בדף')+
    '</div>'+
    '<button type="button" class="reset" data-reset>חזרה להגדרות הרגילות</button>';
  document.body.appendChild(dlg);
  function paint(){
    dlg.querySelector('#p-size').textContent=P.size+'%';
    [].forEach.call(dlg.querySelectorAll('.seg'),function(g){var k=g.getAttribute('data-k');[].forEach.call(g.children,function(b){b.setAttribute('aria-pressed',b.getAttribute('data-v')===(P[k]||''))})});
    [].forEach.call(dlg.querySelectorAll('[data-t]'),function(c){c.checked=!!P[c.getAttribute('data-t')]});
    dlg.querySelector('[data-bright]').value=P.bright;
  }
  paint();
  btn.addEventListener('click',function(){dlg.showModal()});
  dlg.addEventListener('click',function(e){
    if(e.target===dlg||e.target.closest('[data-close]')){dlg.close();return}
    var s=e.target.closest('[data-size]');if(s){P.size=Math.max(80,Math.min(160,P.size+ +s.getAttribute('data-size')));save();return}
    var v=e.target.closest('.seg [data-v]');if(v){P[v.parentNode.getAttribute('data-k')]=v.getAttribute('data-v');save();return}
    if(e.target.closest('[data-reset]')){P=Object.assign({},DEF);save()}
  });
  dlg.addEventListener('change',function(e){var t=e.target.getAttribute('data-t');if(t){P[t]=e.target.checked;save()}});
  dlg.addEventListener('input',function(e){if(e.target.hasAttribute('data-bright')){P.bright=+e.target.value;save()}});
})();
