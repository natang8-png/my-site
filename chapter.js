// Proofreading page (?proof): the whole chapter in one scroll, a red line between sections, every question open
// with its right answer and explanation, and a zigzag where the blank gap before the questions was left out.
window.PROOF=/[?&]proof\b/.test(location.search)&&!!document.querySelector('main.chapter');
if(PROOF){document.documentElement.classList.add('proof');
  var pn=document.createElement('p');pn.className='proof-note';
  pn.textContent='דף הגהה: כל הקטעים ברצף. קו אדום מפריד בין קטעים, וזיג־זג מסמן את המרווח שהושמט לפני השאלות. בשאלות מסומנת התשובה הנכונה עם ההסבר.';
  var hd=document.querySelector('main.chapter > header');if(hd)hd.appendChild(pn)}
(function(){
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  if(!secs.length)return;
  var toc=document.getElementById('toc');
  if(PROOF){toc.open=true;return}
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

// Slim top bar, always on while reading: back to the chapter list, the chapter name over the current heading,
// and the section number ("קטע 2/25"). The headings menu itself opens from the bottom bar.
(function(){
  var main=document.querySelector('main.chapter'), head=main&&main.querySelector('header'), toc=document.getElementById('toc');
  if(!main||!head||!toc||PROOF) return;
  var total=+(toc.querySelector('[data-total]')||{}).getAttribute('data-total')||toc.querySelectorAll('a').length;
  var back=head.querySelector('.back'), title=head.querySelector('h1').textContent;
  var bar=document.createElement('header');bar.className='chbar';bar.dir='rtl';
  bar.innerHTML='<div class="cb-row"><a class="cb-back" href="'+(back?back.getAttribute('href'):'/')+'" aria-label="חזרה לרשימת הפרקים">→</a>'+
    '<span class="cb-ico" aria-hidden="true" hidden></span><div class="cb-mid"><span class="cb-title"></span><span class="cb-sname"></span></div>'+
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
    // Graphic chapters: the section's icon sits between the back arrow and the two title lines.
    var ico=bar.querySelector('.cb-ico'), si=sec&&sec.querySelector('.sec-ico');
    ico.innerHTML=si?si.innerHTML:'';ico.hidden=!si;
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

// Each section's questions sit on the same page below the text, after a blank gap (data-inline-quiz).
// Answers are kept for good: in the account when logged in, otherwise on this device. There is no "answer again"
// for a single section; the whole quiz can be reset from the הלכה page, and the admin still sees every round.
(function(){
  var main=document.querySelector('main[data-inline-quiz]');
  if(!main)return;
  var ch=main.getAttribute('data-chapter'), key='iq:'+ch, saved={}, data=null, loaded=false, online=false;
  try{var old=JSON.parse(localStorage.getItem(key));
    if(Array.isArray(old))old.forEach(function(n){saved[n]={}});else if(old)saved=old}catch(e){}
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
  function changed(){document.dispatchEvent(new Event('iq-change'))}
  function keep(){if(!online)try{localStorage.setItem(key,JSON.stringify(saved))}catch(e){}}
  // Open = "הבא" may be pressed: this section's questions are all answered, or it has none,
  // or this reader has no quiz (reading only, or no access yet).
  window.iqOpen=function(i){
    if(main.classList.contains('read-only')||main.classList.contains('locked'))return true;
    if(!loaded)return false;
    return !data||!(data[i]||[]).length||!!saved[i];
  };
  function result(box,s,t){
    var end=box.querySelector('.quiz-end');end.hidden=false;
    end.innerHTML='<p><b>'+s+' מתוך '+t+'</b> תשובות נכונות.</p><p class="iq-past">התשובות נשמרו. כפתור "הבא" למטה פעיל עכשיו.</p>';
  }
  function render(box){
    var i=box.getAttribute('data-iq'), qs=data[i]||[], sv=saved[i], right=0, answered=0, picks=[];
    if(!qs.length){box.innerHTML='';box.previousElementSibling.hidden=true;return}
    var h='<h3 class="iq-h">שאלות על הקטע</h3>';
    qs.forEach(function(q,k){
      h+='<fieldset class="qq" data-k="'+k+'"><legend>'+(k+1)+'. '+esc(q.q)+'</legend><div class="opts'+(q.a.length===2?' tf':'')+'">'+
        q.a.map(function(a,j){return '<button type="button" data-j="'+j+'">'+esc(a)+'</button>'}).join('')+
        '</div><p class="why" hidden></p></fieldset>';
    });
    box.innerHTML=h+'<div class="quiz-end" hidden></div>';
    function mark(f,q,j){
      f.classList.add('done');
      var bs=f.querySelectorAll('button'), ok=j===q.c;
      if(j!=null&&bs[j])bs[j].classList.add(ok?'ok':'bad');
      bs[q.c].classList.add('ok');
      var w=f.querySelector('.why');w.hidden=false;
      w.innerHTML=(j==null?'':'<b>'+(ok?'נכון!':'לא בדיוק.')+'</b> ')+esc(q.why||'');
      return ok;
    }
    // Proofreading: every question shows its right answer and explanation, nothing is saved.
    if(PROOF){[].forEach.call(box.querySelectorAll('.qq'),function(f){mark(f,qs[+f.getAttribute('data-k')],null)});return}
    // Answered before: show the saved answers, locked.
    if(sv){
      [].forEach.call(box.querySelectorAll('.qq'),function(f){var k=+f.getAttribute('data-k');mark(f,qs[k],sv.a?sv.a[k]:null)});
      if(sv.t!=null)result(box,sv.s,sv.t);
      return;
    }
    [].forEach.call(box.querySelectorAll('.qq'),function(f){
      var k=+f.getAttribute('data-k'), q=qs[k];
      f.addEventListener('click',function(e){
        var b=e.target.closest('button[data-j]');if(!b||f.classList.contains('done'))return;
        var j=+b.getAttribute('data-j');picks[k]=j;answered++;
        if(mark(f,q,j))right++;
        if(answered<qs.length)return;
        saved[i]={a:picks,s:right,t:qs.length};keep();
        result(box,right,qs.length);
        if(window.markRead)markRead(i,true);
        if(window.SITE)SITE.saveQuiz(ch,i,right,qs.length,picks);
        changed();
      });
    });
  }
  var quiz=fetch(main.getAttribute('data-quiz')).then(function(r){return r.json()}).catch(function(){return null});
  // Logged in: the account's answers since the last reset replace this device's.
  var mine=window.SITE&&!PROOF?SITE.ready.then(function(st){return st.user?SITE.loadQuiz(ch):null}).catch(function(){return null}):Promise.resolve(null);
  Promise.all([quiz,mine]).then(function(r){
    data=r[0];
    if(r[1]){online=true;saved={};r[1].rows.forEach(function(x){saved[x.section]={a:x.answers||null,s:x.score,t:x.total}})}
    loaded=true;
    if(data)[].forEach.call(document.querySelectorAll('[data-iq]'),render);
    changed();
  });
})();

// Reading bar fixed to the screen bottom: previous / menu (read count) / accessibility / next.
// In a chapter with questions, "הבא" stays half see-through until the section's questions are all answered.
// It replaces each section's own bar and the page footer.
(function(){
  var main=document.querySelector('main.chapter'), toc=document.getElementById('toc');
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  if(!main||!toc||!secs.length) return;
  if(PROOF) return;
  var priv=main.hasAttribute('data-track'), n=secs.length;
  // A solid arrow (filled shape, not a text character) for the two big buttons.
  function ARROW(d){return '<svg class="rb-arr" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="'+(d==='r'?'M13 4.5 21 12l-8 7.5V15H4.5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 4.5 9H13z':'M11 4.5 3 12l8 7.5V15h8.5a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 19.5 9H11z')+'"/></svg>'}
  var bar=document.createElement('nav');bar.className='rbar';bar.dir='rtl';bar.setAttribute('aria-label','ניווט בפרק');
  bar.innerHTML='<div class="rb-row">'+
    '<button type="button" class="rb-pill rb-prev" data-go="-1">'+ARROW('r')+'<span>הקודם</span></button>'+
    '<button type="button" class="rb-b" data-rb="menu"><i>☰</i><span class="rb-count"></span></button>'+
    '<button type="button" class="rb-b" data-rb="design"><i>♿</i><span>נגישות</span></button>'+
    '<button type="button" class="rb-pill rb-next" data-go="1"><span>הבא</span>'+ARROW('l')+'</button>'+
    '</div>';
  document.body.appendChild(bar);
  document.documentElement.classList.add('has-rbar');
  var prog=document.createElement('div');prog.className='rb-prog';prog.innerHTML='<i></i>';
  (document.querySelector('.chbar')||bar).appendChild(prog);
  // Pressing "הבא" before the questions are done explains why it is not active yet.
  var dlg=document.createElement('dialog');dlg.className='rb-dlg';dlg.dir='rtl';
  dlg.innerHTML='<p>אחרי הקריאה, תוכל למלא את השאלון המופיע בהמשך העמוד, למטה.<br>לאחר מילוי השאלון - כפתור "הבא" יהפוך לפעיל.</p><button type="button" class="primary" data-close>הבנתי</button>';
  document.body.appendChild(dlg);
  dlg.addEventListener('click',function(e){if(e.target===dlg||e.target.closest('[data-close]'))dlg.close()});
  function cur(){var s=document.querySelector('.sec:not([hidden])');return s?+s.id.slice(1):0} // 0 = תוכן עניינים
  function gated(i){return !!window.iqOpen&&i>0&&!iqOpen(i)}
  function go(i){var back=main.querySelector('header .back');if(i<0||i>n){location.href=back?back.getAttribute('href'):'/';return}if(i===0){location.hash='#toc';return}location.hash='#s'+i}
  function paint(){
    var i=cur(), done=toc.querySelectorAll('a.done').length, nx=bar.querySelector('.rb-next'), g=gated(i);
    // The opening page (תוכן עניינים) has no "הקודם".
    var pv=bar.querySelector('.rb-prev');pv.classList.toggle('none',i===0);pv.querySelector('span').textContent=i>1?'הקודם':'תוכן';
    nx.querySelector('span').textContent=i>=n?'סיום':'הבא';
    nx.classList.toggle('off',g);nx.setAttribute('aria-disabled',g?'true':'false');
    bar.querySelector('.rb-count').textContent=priv?'כותרות':'✓ '+done+'/'+n;
    prog.firstChild.style.width=(100*(priv?i:done)/n)+'%';
  }
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    e.stopPropagation();
    var i=cur(), g=b.getAttribute('data-go'), k=b.getAttribute('data-rb');
    if(g==='1'){
      if(gated(i)){dlg.showModal();return}
      // Sections without questions (or readers without a quiz) count as read when moving on.
      if(i>0&&!priv&&window.markRead&&!toc.querySelector('a[href="#s'+i+'"].done'))markRead(String(i),true);
      return go(i+1);
    }
    if(g)return go(i-1);
    if(k==='menu'){if(window.openChapterMenu)openChapterMenu();else{toc.open=true;toc.scrollIntoView({block:'start'})}}
    if(k==='design'){var t=document.getElementById('theme');if(t)t.click()}
  });
  // Swipe on the text: right = next section, left = previous (like turning a Hebrew book's page).
  var sx=null, sy=0;
  main.addEventListener('touchstart',function(e){if(e.touches.length!==1){sx=null;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  main.addEventListener('touchend',function(e){
    if(sx===null)return;var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;sx=null;
    if(Math.abs(dx)<70||Math.abs(dy)>Math.abs(dx)*0.6)return;
    if(String(window.getSelection&&getSelection())!=='')return;
    var i=cur();if(dx>0&&i<n&&!gated(i))go(i+1);else if(dx<0&&i>=1)go(i-1);
  },{passive:true});
  new MutationObserver(paint).observe(toc,{subtree:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(paint).observe(main,{attributes:true,attributeFilter:['class']}); // access level arrives later
  window.addEventListener('hashchange',function(){setTimeout(paint,0)});
  document.addEventListener('iq-change',paint);
  paint();
})();
