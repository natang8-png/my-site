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
