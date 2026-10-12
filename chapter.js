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
    if(!found){secs[0].hidden=false;id=secs[0].id}
    [].forEach.call(toc.querySelectorAll('a'),function(a){a.classList.toggle('current',a.getAttribute('href')==='#'+id)});
  }
  window.addEventListener('hashchange',function(){show();toc.open=false;var t=document.getElementById(location.hash.slice(1));var cur=document.querySelector('.sec:not([hidden])');((t&&t.closest('.sec'))?t:cur).scrollIntoView({block:'start'})});
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

// Access: guests and users without a grant see headings only; "quiz" grants see quizzes without the text
(function(){
  var main=document.querySelector('main[data-path]');
  if(!main||!window.SITE)return;
  main.classList.add('checking');
  SITE.ready.then(function(st){
    var a=SITE.access(main.getAttribute('data-path'));
    main.classList.remove('checking');
    if(a==='study')return;
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
  function load(cb){if(data)return cb();fetch('quiz.json').then(function(r){return r.json()}).then(function(d){data=d;cb()}).catch(function(){data={};cb()})}
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

// Compact top bar while reading: back arrow, chapter name and the headings menu (with read count);
// a second, smaller row with the current section's title once its heading scrolls away.
(function(){
  var main=document.querySelector('main.chapter'), head=main&&main.querySelector('header'), toc=document.getElementById('toc');
  if(!main||!head||!toc) return;
  var total=+(toc.querySelector('[data-total]')||{}).getAttribute('data-total')||toc.querySelectorAll('a').length;
  var back=head.querySelector('.back'), title=head.querySelector('h1').textContent;
  var bar=document.createElement('div');bar.className='chbar';bar.setAttribute('aria-hidden','true');
  bar.innerHTML='<div class="cb-row"><a class="cb-back" href="'+(back?back.getAttribute('href'):'/')+'" aria-label="חזרה">→</a>'+
    '<span class="cb-title"></span><button type="button" class="cb-menu" aria-expanded="false" aria-label="תפריט כותרות"><span class="cb-ico">☰</span><span class="cb-read"></span></button></div>'+
    '<div class="cb-sec"><span class="cb-sname"></span><span class="cb-snum"></span></div>'+
    '<div class="cb-panel" hidden></div>';
  bar.querySelector('.cb-title').textContent=title;
  document.body.appendChild(bar);
  var panel=bar.querySelector('.cb-panel'), menu=bar.querySelector('.cb-menu');
  panel.appendChild(toc.querySelector('ol').cloneNode(true));
  function sync(){ // read marks and current section mirror the main menu
    var src=toc.querySelectorAll('a'), dst=panel.querySelectorAll('a');
    [].forEach.call(src,function(a,i){if(dst[i])dst[i].className=a.className});
    bar.querySelector('.cb-read').textContent=toc.querySelectorAll('a.done').length+'/'+total;
  }
  new MutationObserver(sync).observe(toc,{subtree:true,attributes:true,attributeFilter:['class']});sync();
  function setOpen(on){panel.hidden=!on;menu.setAttribute('aria-expanded',on);bar.classList.toggle('open',on)}
  menu.addEventListener('click',function(){setOpen(panel.hidden)});
  panel.addEventListener('click',function(e){if(e.target.closest('a'))setOpen(false)});
  document.addEventListener('click',function(e){if(!bar.contains(e.target))setOpen(false)});
  // Row 1 appears once the chapter header is gone.
  new IntersectionObserver(function(es){var on=!es[0].isIntersecting;bar.classList.toggle('show',on);bar.setAttribute('aria-hidden',!on);if(!on)setOpen(false)}).observe(head);
  // Row 2: the visible section's title, once its own heading has scrolled under the bar.
  var hio=new IntersectionObserver(function(es){es.forEach(function(e){
    var sec=e.target.closest('.sec');if(!sec||sec.hidden)return;
    bar.classList.toggle('sec-on',!e.isIntersecting&&e.boundingClientRect.top<0);
  })},{rootMargin:'-60px 0px 0px 0px'});
  function current(){
    var sec=document.querySelector('.sec:not([hidden])');if(!sec)return;
    var h=sec.querySelector('h2');bar.querySelector('.cb-sname').textContent=h.textContent;
    bar.querySelector('.cb-snum').textContent=sec.id.slice(1)+'/'+total;
    hio.disconnect();hio.observe(h);bar.classList.remove('sec-on');
  }
  window.addEventListener('hashchange',function(){setTimeout(current,0)});current();
})();

// One heading size for every section of the chapter: the largest size at which the longest title still fits on one line.
(function(){
  var hs=[].slice.call(document.querySelectorAll('.sec-head h2'));if(!hs.length)return;
  var probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap';
  function fit(){
    var head=document.querySelector('.sec:not([hidden]) .sec-head')||hs[0].parentNode, num=head.querySelector('.sec-num');
    var room=head.clientWidth-(num?num.offsetWidth+12:0); if(room<=0)return;
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
