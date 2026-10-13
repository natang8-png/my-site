(function(){
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  if(!secs.length)return;
  var toc=document.getElementById('toc');
  document.documentElement.classList.add('one-sec');
  function show(){
    var id=(location.hash||'').slice(1), found=false;
    var el=id&&document.getElementById(id), host=el&&el.closest&&el.closest('.sec');
    if(host)id=host.id;
    secs.forEach(function(s){var on=s.id===id;s.hidden=!on;if(on)found=true});
    // No section in the address: the chapter's own opening page, "תוכן עניינים" (title, credit and the headings list).
    // Each section, from 1 (הקדמה) on, is a page of its own without that opening.
    document.documentElement.classList.toggle('later-sec',found);
    [].forEach.call(toc.querySelectorAll('a'),function(a){a.classList.toggle('current',a.getAttribute('href')==='#'+id)});
  }
  // The headings list stays open: it is a plain list, not a button.
  toc.open=true;toc.querySelector('summary').addEventListener('click',function(e){e.preventDefault()});
  toc.querySelector('summary span').textContent='תוכן עניינים';
  window.addEventListener('hashchange',function(){show();var t=document.getElementById(location.hash.slice(1));var cur=document.querySelector('.sec:not([hidden])');
    if(!cur){scrollTo(0,0);return}
    ((t&&t.closest('.sec'))?t:cur).scrollIntoView({block:'start'})});
  [].forEach.call(document.querySelectorAll('[data-open-toc]'),function(b){b.addEventListener('click',function(){toc.open=true;toc.scrollIntoView({block:'start'});var c=toc.querySelector('a.current');if(c)c.focus()})});
  show();
  if(location.hash){var cur=document.querySelector('.sec:not([hidden])');if(cur)cur.scrollIntoView({block:'start'})}
})();

// "קראתי" marks: saved to the account when logged in, otherwise in this browser
(function(){
  var main=document.querySelector('main[data-chapter]');
  if(!main)return;
  var ch=main.getAttribute('data-chapter'), key='read:'+ch, read={};
  try{(JSON.parse(localStorage.getItem(key))||[]).forEach(function(n){read[n]=1})}catch(e){}
  var count=document.querySelector('.toc-count'), total=count&&+count.getAttribute('data-total');
  var online=false;
  function save(){if(!online)try{localStorage.setItem(key,JSON.stringify(Object.keys(read)))}catch(e){}}
  function paint(){
    [].forEach.call(document.querySelectorAll('[data-read]'),function(b){b.checked=!!read[b.getAttribute('data-read')]});
    [].forEach.call(document.querySelectorAll('#toc a'),function(a){a.classList.toggle('done',!!read[a.getAttribute('href').slice(2)])});
    var n=Object.keys(read).length;
    if(count)count.textContent=n?n+' מתוך '+total+' נקראו':total+' קטעים';
  }
  window.markRead=function(i,on){i=String(i);if(on)read[i]=1;else delete read[i];save();if(online)SITE.saveRead(ch,i,on);paint()};
  document.addEventListener('change',function(e){var b=e.target.closest('[data-read]');if(b)markRead(b.getAttribute('data-read'),b.checked)});
  paint();
  if(window.SITE)SITE.ready.then(function(){return SITE.loadReads(ch)}).then(function(list){
    if(!list)return;
    online=true;read={};list.forEach(function(n){read[n]=1});paint();
  });
})();

// Access: guests and users without a grant see headings only; "read" grants see the text without quizzes;
// older "quiz" grants see quizzes without the text
(function(){
  var main=document.querySelector('main[data-path]');
  if(!main||!window.SITE)return;
  main.classList.add('checking');
  SITE.ready.then(function(st){
    var a=SITE.access(main.getAttribute('data-path'));
    main.classList.remove('checking');
    if(a==='study')return;
    if(a==='read'){main.classList.add('read-only');return}
    main.classList.add(a==='quiz'?'quiz-only':'locked');
    var next=encodeURIComponent(location.pathname+location.hash);
    var msg=a==='quiz'?'בפרק הזה פתוחה לך הבחינה העצמית בלבד.'
      :st.user?'החשבון שלך עוד לא קיבל גישה לפרק הזה. נתן יפתח אותה בקרוב.'
      :'התוכן פתוח למשתמשים רשומים. <a href="/login/?next='+next+'">כניסה / הרשמה</a>';
    [].forEach.call(document.querySelectorAll('.sec .content'),function(c){
      var n=document.createElement('div');n.className='lock-note';n.innerHTML='<span aria-hidden="true">🔒</span> '+msg;
      c.parentNode.insertBefore(n,c);
    });
  });
})();

// Self-quiz on the current section
(function(){
  var btns=document.querySelectorAll('[data-quiz]');
  if(!btns.length)return;
  var data=null, dlg=document.createElement('dialog');
  dlg.className='quiz';dlg.setAttribute('dir','rtl');
  document.body.appendChild(dlg);
  function load(cb){if(data)return cb();fetch(document.querySelector('main').getAttribute('data-quiz')||'quiz.json').then(function(r){return r.json()}).then(function(d){data=d;cb()}).catch(function(){data={};cb()})}
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
  function open(i){
    var qs=data[i]||[], title=document.getElementById('s'+i+'-h').textContent, right=0, answered=0;
    var h='<div class="quiz-head"><div><small>בחינה עצמית</small><h3>'+esc(title)+'</h3></div><button type="button" class="x" aria-label="סגירה">✕</button></div>';
    if(!qs.length)h+='<p>עוד אין שאלות לקטע הזה.</p>';
    qs.forEach(function(q,k){
      h+='<fieldset class="qq" data-k="'+k+'"><legend>'+(k+1)+'. '+esc(q.q)+'</legend><div class="opts'+(q.a.length===2?' tf':'')+'">'+
        q.a.map(function(a,j){return '<button type="button" data-j="'+j+'">'+esc(a)+'</button>'}).join('')+
        '</div><p class="why" hidden></p></fieldset>';
    });
    h+='<div class="quiz-end" hidden></div>';
    dlg.innerHTML=h;
    dlg.querySelector('.x').onclick=function(){dlg.close()};
    [].forEach.call(dlg.querySelectorAll('.qq'),function(f){
      var q=qs[+f.getAttribute('data-k')];
      f.addEventListener('click',function(e){
        var b=e.target.closest('button[data-j]');if(!b||f.classList.contains('done'))return;
        f.classList.add('done');answered++;
        var j=+b.getAttribute('data-j'), ok=j===q.c;if(ok)right++;
        b.classList.add(ok?'ok':'bad');
        f.querySelectorAll('button')[q.c].classList.add('ok');
        var w=f.querySelector('.why');w.hidden=false;w.innerHTML='<b>'+(ok?'נכון!':'לא בדיוק.')+'</b> '+esc(q.why||'');
        if(answered===qs.length){
          var end=dlg.querySelector('.quiz-end');end.hidden=false;
          end.innerHTML='<p><b>'+right+' מתוך '+qs.length+'</b> תשובות נכונות.</p>'+
            '<div class="end-btns"><button type="button" data-again>שוב</button>'+
            '<button type="button" data-mark>סמן כנקרא וסגור</button></div>';
          end.querySelector('[data-again]').onclick=function(){open(i);dlg.scrollTop=0};
          if(window.quizDone)quizDone(i,right,qs.length);
          if(window.SITE)SITE.saveQuiz(document.querySelector('main[data-chapter]').getAttribute('data-chapter'),i,right,qs.length);
          end.querySelector('[data-mark]').onclick=function(){if(window.markRead)markRead(String(i),true);dlg.close()};
        }
      });
    });
    if(!dlg.open)dlg.showModal();
  }
  [].forEach.call(btns,function(b){b.addEventListener('click',function(){var i=b.getAttribute('data-quiz');load(function(){open(i)})})});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close()});
})();

// Slim top bar, always on while reading: back to the chapter list, the chapter name over the current heading,
// and the section number ("קטע 2/25"). The headings menu itself opens from the bottom bar.
(function(){
  var main=document.querySelector('main.chapter'), head=main&&main.querySelector('header'), toc=document.getElementById('toc');
  if(!main||!head||!toc) return;
  var total=+(toc.querySelector('[data-total]')||{}).getAttribute('data-total')||toc.querySelectorAll('a').length;
  var back=head.querySelector('.back'), title=head.querySelector('h1').textContent;
  var bar=document.createElement('header');bar.className='chbar';bar.dir='rtl';
  bar.innerHTML='<div class="cb-row"><a class="cb-back" href="'+(back?back.getAttribute('href'):'/')+'" aria-label="חזרה לרשימת הפרקים">→</a>'+
    '<div class="cb-mid"><span class="cb-title"></span><span class="cb-sname"></span></div>'+
    '<span class="cb-snum"></span></div>'+
    '<div class="cb-panel" hidden></div>';
  bar.querySelector('.cb-title').textContent=title;
  document.body.appendChild(bar);
  document.documentElement.classList.add('has-tbar');
  var panel=bar.querySelector('.cb-panel');
  panel.appendChild(toc.querySelector('ol').cloneNode(true));
  function sync(){ // read marks and current section mirror the main menu
    var src=toc.querySelectorAll('a'), dst=panel.querySelectorAll('a');
    [].forEach.call(src,function(a,i){if(dst[i])dst[i].className=a.className});
  }
  new MutationObserver(sync).observe(toc,{subtree:true,attributes:true,attributeFilter:['class']});sync();
  function setOpen(on){panel.hidden=!on;bar.classList.toggle('open',on)}
  window.openChapterMenu=function(){setOpen(true);var c=panel.querySelector('a.current');if(c)c.scrollIntoView({block:'center'})};
  panel.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false)});
  document.addEventListener('click',function(e){if(e.target===bar||!bar.contains(e.target))setOpen(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setOpen(false)});
  function current(){
    var sec=document.querySelector('.sec:not([hidden])'), num=bar.querySelector('.cb-snum');
    num.hidden=!sec;
    if(!sec){bar.querySelector('.cb-sname').textContent='תוכן עניינים';return}
    var i=sec.id.slice(1);
    bar.querySelector('.cb-sname').textContent=sec.querySelector('h2').textContent;
    num.textContent='קטע '+i+'/'+total;num.setAttribute('aria-label','קטע '+i+' מתוך '+total);
  }
  window.addEventListener('hashchange',function(){setTimeout(current,0)});current();
})();

// One heading size for every section of the chapter: the largest size at which the longest title still fits on one line.
(function(){
  var hs=[].slice.call(document.querySelectorAll('.sec-head h2'));if(!hs.length)return;
  var probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap';
  function fit(){
    var head=document.querySelector('.sec:not([hidden]) .sec-head')||hs[0].parentNode, num=head.querySelector('.sec-num');
    var ico=head.querySelector('.sec-ico'), room=head.clientWidth-(num?num.offsetWidth+12:0)-(ico?ico.offsetWidth+12:0); if(room<=0)return;
    var cs=getComputedStyle(hs[0]);probe.style.fontFamily=cs.fontFamily;probe.style.fontWeight=cs.fontWeight;
    document.body.appendChild(probe);
    var rem=parseFloat(getComputedStyle(document.documentElement).fontSize), size=1.8;
    for(;size>1.05;size-=0.05){
      probe.style.fontSize=size+'rem';
      if(hs.every(function(h){probe.textContent=h.textContent;return probe.offsetWidth<=room}))break;
    }
    probe.remove();var v=size.toFixed(2)+'rem',r=document.documentElement;if(r.style.getPropertyValue('--sec-h')!==v)r.style.setProperty('--sec-h',v);
  }
  fit();addEventListener('resize',fit);addEventListener('hashchange',fit);
  if(document.fonts)document.fonts.ready.then(fit);
  new MutationObserver(fit).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
})();

// Reading bar fixed to the screen bottom: previous / menu (read count) / quiz / accessibility / next / "קראתי" (marks and moves on).
// It replaces each section's own bar and the page footer. Private chapters (data-track) get it without "קראתי" and the quiz.
(function(){
  var main=document.querySelector('main.chapter'), toc=document.getElementById('toc');
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  if(!main||!toc||!secs.length) return;
  var priv=main.hasAttribute('data-track'), ch=main.getAttribute('data-chapter'), n=secs.length;
  var quizzes=!priv&&!!document.querySelector('[data-quiz]'), scores={}, qdata=null;
  try{scores=JSON.parse(localStorage.getItem('quiz:'+ch))||{}}catch(e){}
  var bar=document.createElement('nav');bar.className='rbar';bar.dir='rtl';bar.setAttribute('aria-label','ניווט בפרק');
  bar.innerHTML='<div class="rb-row">'+
    '<button type="button" class="rb-b" data-go="-1"><i>→</i><span>הקודם</span></button>'+
    '<button type="button" class="rb-b" data-rb="menu"><i>☰</i><span class="rb-count"></span></button>'+
    (quizzes?'<button type="button" class="rb-b rb-quiz" data-rb="quiz"><i>?</i><span>שאלון</span></button>':'')+
    '<button type="button" class="rb-b" data-rb="design"><i>♿</i><span>נגישות</span></button>'+
    '<button type="button" class="rb-b" data-go="1"><i>←</i><span>הבא</span></button>'+
    (priv?'':'<button type="button" class="rb-read" data-rb="read"></button>')+
    '</div><div class="rb-toast" role="status" hidden></div>';
  document.body.appendChild(bar);
  document.documentElement.classList.add('has-rbar');
  var prog=document.createElement('div');prog.className='rb-prog';prog.innerHTML='<i></i>';
  (document.querySelector('.chbar')||bar).appendChild(prog);
  function cur(){var s=document.querySelector('.sec:not([hidden])');return s?+s.id.slice(1):0} // 0 = תוכן עניינים
  function isRead(i){var a=toc.querySelector('a[href="#s'+i+'"]');return !!(a&&a.classList.contains('done'))}
  function go(i){var back=main.querySelector('header .back');if(i<0){location.href=back?back.getAttribute('href'):'/';return}if(i===0){location.hash='#toc';return}if(i<=n)location.hash='#s'+i}
  function paint(){
    var i=cur(), done=toc.querySelectorAll('a.done').length;
    bar.querySelector('[data-go="-1"] span').textContent=i>1?'הקודם':i===1?'תוכן':'חזרה';
    bar.querySelector('[data-go="1"]').disabled=i>=n;
    bar.querySelector('.rb-count').textContent=priv?'כותרות':'✓ '+done+'/'+n;
    prog.firstChild.style.width=(100*(priv?i:done)/n)+'%';
    var r=bar.querySelector('.rb-read');
    if(r)r.hidden=!i;
    if(r&&i){var rd=isRead(i);r.classList.toggle('done',rd);
      r.textContent=rd?'נקרא ✓':(i>=n?'סיימתי ✓':'קראתי ✓');
      r.title=rd?'לחיצה מבטלת את הסימון':(i>=n?'סימון הקטע האחרון כנקרא':'סימון כנקרא ומעבר לקטע הבא')}
    var q=bar.querySelector('.rb-quiz');
    if(q){var sc=scores[i], has=!qdata||(qdata[i]||[]).length>0;
      q.disabled=!has||!i;q.classList.toggle('todo',has&&!sc);
      q.querySelector('span').textContent=sc?sc:'שאלון'}
  }
  function toast(t){var el=bar.querySelector('.rb-toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){el.hidden=true},3500)}
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    e.stopPropagation();
    var i=cur(), g=b.getAttribute('data-go'), k=b.getAttribute('data-rb');
    if(g)return go(i+ +g);
    if(k==='menu'){if(window.openChapterMenu)openChapterMenu();else{toc.open=true;toc.scrollIntoView({block:'start'})}}
    if(k==='design'){var t=document.getElementById('theme');if(t)t.click()}
    if(k==='quiz'){var qb=document.querySelector('#s'+i+' [data-quiz]');if(qb)qb.click()}
    if(k==='read'){
      if(isRead(i)){if(window.markRead)markRead(String(i),false);return}
      if(window.markRead)markRead(String(i),true);
      if(i<n)go(i+1);else toast(toc.querySelectorAll('a.done').length>=n?'כל הכבוד! סיימת את כל הפרק ✓':'הקטע האחרון סומן ✓ אפשר לראות בתפריט מה עוד לא נקרא.');
    }
  });
  // Quiz results: this device right away; the account's results when logged in.
  window.quizDone=function(i,right,total){scores[i]=right+'/'+total;try{localStorage.setItem('quiz:'+ch,JSON.stringify(scores))}catch(e){}paint()};
  if(quizzes){
    fetch(document.querySelector('main').getAttribute('data-quiz')||'quiz.json').then(function(r){return r.json()}).then(function(d){qdata=d;paint()}).catch(function(){});
    if(window.SITE)SITE.ready.then(function(st){
      if(!st.user)return;
      return SITE.sb.from('quiz_results').select('section,score,total,taken_at').eq('user_id',st.user.id).eq('chapter',ch).order('taken_at').then(function(r){
        (r.data||[]).forEach(function(x){scores[x.section]=x.score+'/'+x.total});paint();
      });
    });
  }
  // Swipe on the text: right = next section, left = previous (like turning a Hebrew book's page).
  var sx=null, sy=0;
  main.addEventListener('touchstart',function(e){if(e.touches.length!==1){sx=null;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  main.addEventListener('touchend',function(e){
    if(sx===null)return;var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;sx=null;
    if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*0.6)return;
    if(String(window.getSelection&&getSelection())!=='')return;
    var i=cur();if(dx>0&&i<n)go(i+1);else if(dx<0&&i>=1)go(i-1);
  },{passive:true});
  new MutationObserver(paint).observe(toc,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('hashchange',function(){setTimeout(paint,0)});
  paint();
})();
