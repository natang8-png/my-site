// Edit mode (admin only; switched on from "מצב עריכה" in the account line, loaded by auth.js).
// The site works as usual. A warning line sticks to the top of every page; tapping it switches edit mode off.
// Tap any line (text, heading, question, answer, explanation) for a small menu: edit it, add a handwritten note,
// mark the right answer, or undo. Everything is saved in the "edits" table (supabase/v13.sql), so it shows on every
// device; Claude reads it from there and puts the changes into the site itself. Offline, it waits on this device.
(function(){
  var html=document.documentElement, main=document.querySelector('main');if(!main)return;
  var chMain=document.querySelector('main.chapter[data-chapter]');
  var ch=chMain?chMain.getAttribute('data-chapter'):'page:'+location.pathname;
  var LS='edits:'+ch, NOTAG=/^\/(admin|login)\//.test(location.pathname);
  html.classList.add('editing');
  var rows={}, online=false, blocks={}, cur=null, editing=null;
  function id(r){return r.key+'|'+r.kind}
  function esc(t){var d=document.createElement('div');d.textContent=t==null?'':t;return d.innerHTML}
  function plain(h){var d=document.createElement('div');d.innerHTML=h;return d.textContent.replace(/\s+/g,' ').trim()}

  // ---- The warning line at the top ----
  var bar=document.createElement('div');bar.className='edit-top';bar.dir='rtl';
  bar.innerHTML='<button type="button" class="et-off" title="לחיצה מבטלת את מצב העריכה"><b>✎ מצב עריכה</b><span>· לחיצה מבטלת</span></button>'+
    '<span class="et-info"><span class="eb-count"></span> <span class="eb-save"></span></span><button type="button" class="eb-list">רשימה</button>';
  document.body.insertBefore(bar,document.body.firstChild);
  bar.querySelector('.et-off').onclick=function(){SITE.setEdit(false)};
  var dlg=document.createElement('dialog');dlg.className='edit-dlg';dlg.dir='rtl';document.body.appendChild(dlg);
  bar.querySelector('.eb-list').onclick=openList;
  function status(t,bad){var s=bar.querySelector('.eb-save');s.textContent=t;s.classList.toggle('bad',!!bad)}
  if(NOTAG){bar.querySelector('.et-info').hidden=true;bar.querySelector('.eb-list').hidden=true}

  // ---- Blocks: every line that can be edited gets a key ----
  function secNum(el){var s=el.closest('.sec');return s?+s.id.slice(1):0}
  function tag(el,key,kind){el.setAttribute('data-ek',key);el.setAttribute('data-et',kind);
    blocks[key]={el:el,orig:el.innerHTML,kind:kind,sec:secNum(el)}}
  var SKIP='.acct,.toc,.chbar,.rbar,.edit-top,.e-menu,.e-tools,.e-hand,.lock-note,.qsum,.proof-note,.iq,form,footer,dialog,script,style';
  function ok(el){
    if(el.closest(SKIP))return false;
    if(el.parentNode.closest('[data-ek]'))return false;                          // already inside a block
    if((el.tagName==='LI'||el.tagName==='BLOCKQUOTE')&&el.querySelector('p'))return false; // its <p> is the block
    return plain(el.innerHTML)!=='';
  }
  var SEL='h1,h2,h3,h4,p,li,blockquote,dt,dd,figcaption';
  function tagText(){
    if(chMain){
      // Chapters: keys by section, so they stay put when other sections change.
      [].forEach.call(document.querySelectorAll('.sec'),function(sec){
        var n=0, sid=sec.id;
        var h=sec.querySelector('.sec-head h2');if(h)tag(h,sid+'.h','text');
        var c=sec.querySelector('.content');if(!c)return;
        [].forEach.call(c.querySelectorAll('p,h3,h4,li,blockquote'),function(el){if(ok(el))tag(el,sid+'.t'+(++n),'text')});
      });
      var hd=chMain.querySelector('header'), k=0;
      if(hd)[].forEach.call(hd.querySelectorAll('h1,p,.eyebrow'),function(el){if(ok(el))tag(el,'hd'+(++k),'text')});
      return;
    }
    var n=0;[].forEach.call(main.querySelectorAll(SEL+',.lead,.eyebrow,.topic b,.topic strong,.topic span.t,.topic small'),function(el){if(ok(el))tag(el,'b'+(++n),'text')});
  }
  function tagQuiz(){
    [].forEach.call(document.querySelectorAll('[data-iq]'),function(box){
      var s='s'+box.getAttribute('data-iq');
      [].forEach.call(box.querySelectorAll('.qq'),function(f){
        if(f.querySelector('[data-ek]'))return;
        var k=+f.getAttribute('data-k')+1, lg=f.querySelector('legend');
        var m=lg.textContent.match(/^(\d+\.\s*)([\s\S]*)$/);
        if(m){lg.innerHTML='<span class="qn">'+esc(m[1])+'</span><span class="qt">'+esc(m[2])+'</span>'}
        tag(lg.querySelector('.qt')||lg,s+'.q'+k+'.q','question');
        [].forEach.call(f.querySelectorAll('.opts button'),function(b,j){tag(b,s+'.q'+k+'.a'+(j+1),'answer')});
        var w=f.querySelector('.why');if(w)tag(w,s+'.q'+k+'.why','why');
      });
    });
  }

  // ---- Showing saved rows on the page ----
  // Notes on an answer go under the answers; on a section heading, under the heading's row (not beside it).
  function anchor(el){return el.tagName==='BUTTON'?el.parentNode:el.parentNode.classList.contains('sec-head')?el.parentNode:el}
  function fits(b,r){return !r.orig||r.orig===plain(b.orig)} // the line still says what it said when the row was saved
  function paint(key){
    var b=blocks[key];if(!b)return;
    var t=rows[key+'|text'], n=rows[key+'|note'];
    if(t&&!fits(b,t))t=null;
    if(editing!==b.el)b.el.innerHTML=t?t.val:b.orig;
    b.el.classList.toggle('e-changed',!!t);
    var nn=document.querySelector('.e-hand[data-for="'+key+'"]');
    if(n&&n.val){
      if(!nn){nn=document.createElement('div');nn.className='e-hand hand';nn.setAttribute('data-for',key);insertNote(b.el,nn)}
      if(nn!==editing)nn.textContent=n.val;
    }else if(nn&&nn!==editing)nn.remove();
  }
  function insertNote(el,nn){
    var after=anchor(el);
    while(after.nextElementSibling&&after.nextElementSibling.classList.contains('e-hand'))after=after.nextElementSibling;
    after.insertAdjacentElement('afterend',nn);
  }
  function paintCorrect(){
    [].forEach.call(document.querySelectorAll('.qq'),function(f){
      var lg=f.querySelector('[data-ek$=".q"]');if(!lg)return;
      var base=lg.getAttribute('data-ek').replace(/\.q$/,''), r=rows[base+'.c|correct'];
      var bs=f.querySelectorAll('.opts button');if(!bs.length)return;
      if(!f.hasAttribute('data-c0'))[].forEach.call(bs,function(b,j){if(b.classList.contains('ok'))f.setAttribute('data-c0',j)});
      var c=r?+r.val-1:+f.getAttribute('data-c0');
      [].forEach.call(bs,function(b,j){b.classList.toggle('ok',j===c);b.classList.toggle('e-changed-c',!!r&&j===c)});
    });
  }
  function paintAll(){Object.keys(blocks).forEach(paint);paintCorrect();count()}
  function count(){
    var t=0,n=0,c=0;Object.keys(rows).forEach(function(k){var r=rows[k];if(r.kind==='note')n++;else if(r.kind==='correct')c++;else t++});
    var e=bar.querySelector('.eb-count');e.textContent=(t||n||c)?'✎'+t+' ✍'+n+(c?' ✓'+c:''):'';e.title=t+' שינויים, '+n+' הערות'+(c?', '+c+' תשובות':'');
  }

  // ---- Saving ----
  function keepLocal(){try{localStorage.setItem(LS,JSON.stringify(rows))}catch(e){}}
  function save(r){
    var k=id(r);
    if(r.val==null||r.val===''){delete rows[k]}else{r.updated_at=new Date().toISOString();rows[k]=r}
    keepLocal();count();
    if(!online){status('⚠ רק במכשיר',true);return}
    status('שומר...');
    var q=r.val==null||r.val===''?SITE.sb.from('edits').delete().eq('chapter',ch).eq('key',r.key).eq('kind',r.kind)
      :SITE.sb.from('edits').upsert({chapter:ch,key:r.key,kind:r.kind,sec:r.sec,orig:r.orig,val:r.val,updated_at:r.updated_at});
    q.then(function(x){status(x.error?'⚠ רק במכשיר':'נשמר ✓',!!x.error)});
  }

  // ---- The small menu under a tapped line ----
  var menu=document.createElement('div');menu.className='e-menu';menu.dir='rtl';
  function closeMenu(){menu.remove();if(cur)cur.classList.remove('e-cur');cur=null}
  function openMenu(el){
    closeMenu();cur=el;el.classList.add('e-cur');
    var key=el.getAttribute('data-ek'), kind=el.getAttribute('data-et');
    var h='<button type="button" data-a="edit">✎ '+({question:'עריכת השאלה',answer:'עריכת התשובה',why:'עריכת ההסבר'}[kind]||'עריכת טקסט')+'</button><button type="button" data-a="note">✍ הערה בכתב יד</button>';
    if(kind==='answer')h+='<button type="button" data-a="right">✓ זו התשובה הנכונה</button>';
    if(rows[key+'|text'])h+='<button type="button" data-a="undo">↺ החזר למקור</button>';
    var a=el.closest('a[href]');if(a)h+='<a class="e-go" href="'+esc(a.getAttribute('href'))+'">← לקישור</a>';
    h+='<button type="button" data-a="x" aria-label="סגירה">✕</button>';
    menu.innerHTML=h;
    // inside a link (a card), the menu goes after the link so tapping it does not open the link
    var at=a&&!a.contains(anchor(el))?anchor(el):a?a:anchor(el);
    at.insertAdjacentElement('afterend',menu);
  }
  menu.addEventListener('click',function(e){
    var a=e.target.closest('button');if(!a||!cur)return;e.stopPropagation();e.preventDefault();
    var el=cur, key=el.getAttribute('data-ek'), b=blocks[key], act=a.getAttribute('data-a');
    if(act==='x'){closeMenu();return}
    if(act==='edit'){closeMenu();startText(el);return}
    if(act==='note'){closeMenu();startNote(el);return}
    if(act==='undo'){closeMenu();save({key:key,kind:'text',sec:b.sec,orig:plain(b.orig),val:null});paint(key);return}
    if(act==='right'){
      var f=el.closest('.qq'), base=key.replace(/\.a\d+$/,''), j=+key.match(/\.a(\d+)$/)[1]-1;
      var c0=+f.getAttribute('data-c0');
      save({key:base+'.c',kind:'correct',sec:b.sec,orig:String(c0+1),val:j===c0?null:String(j+1)});
      paintCorrect();closeMenu();
    }
  });

  var tools=document.createElement('div');tools.className='e-tools';tools.dir='rtl';
  function place(el,node){var a=el.closest('a[href]');(a||anchor(el)).insertAdjacentElement('afterend',node)}
  // Questions, answers, explanations and lines inside links are edited in a text box: an answer is a button,
  // and on phones (iPhone above all) a button can't be typed into directly.
  function startBox(el){
    stop();editing=el;var key=el.getAttribute('data-ek'), b=blocks[key];
    el.classList.add('e-editing');
    var ta=document.createElement('textarea');ta.className='e-box';ta.dir='rtl';ta.value=el.textContent.replace(/\s+/g,' ').trim();ta.rows=Math.max(2,Math.ceil(ta.value.length/38));
    tools.innerHTML='';tools.appendChild(ta);
    tools.insertAdjacentHTML('beforeend','<button type="button" class="primary" data-a="ok">שמירה</button><button type="button" data-a="no">ביטול</button>');
    place(el,tools);tools.onmousedown=null;ta.focus();
    tools.onclick=function(e){var a=e.target.closest('button');if(!a)return;var act=a.getAttribute('data-a');
      var v=ta.value.replace(/\s+/g,' ').trim();stop();
      if(act==='no'){paint(key);return}
      save({key:key,kind:'text',sec:b.sec,orig:plain(b.orig),val:!v||v===plain(b.orig)?null:esc(v)});paint(key);
    };
  }
  function startText(el){
    if(el.closest('.qq,a[href],button'))return startBox(el);
    stop();editing=el;var key=el.getAttribute('data-ek'), b=blocks[key], before=el.innerHTML;
    el.contentEditable='true';el.classList.add('e-editing');el.focus();
    tools.innerHTML='<button type="button" class="primary" data-a="ok">שמירה</button><button type="button" data-a="bold"><b>מודגש</b></button><button type="button" data-a="no">ביטול</button>';
    place(el,tools);
    tools.onmousedown=function(e){e.preventDefault()}; // keep the selection for "מודגש"
    tools.onclick=function(e){var a=e.target.closest('button');if(!a)return;var act=a.getAttribute('data-a');
      if(act==='bold'){document.execCommand('bold');return}
      var v=el.innerHTML;stop();
      if(act==='no'){el.innerHTML=before;return}
      save({key:key,kind:'text',sec:b.sec,orig:plain(b.orig),val:v===b.orig?null:v});paint(key);
    };
  }
  // A note: a handwritten line under the block; empty = deleted.
  function startNote(el){
    stop();var key=el.getAttribute('data-ek'), b=blocks[key];
    var nn=document.querySelector('.e-hand[data-for="'+key+'"]');
    if(!nn){nn=document.createElement('div');nn.className='e-hand hand';nn.setAttribute('data-for',key);
      var a=el.closest('a[href]');if(a)a.insertAdjacentElement('afterend',nn);else insertNote(el,nn)}
    editing=nn;nn.contentEditable='true';nn.classList.add('e-editing');nn.focus();
    tools.innerHTML='<button type="button" class="primary" data-a="ok">שמירת ההערה</button><button type="button" data-a="del">מחיקה</button><button type="button" data-a="no">ביטול</button>';
    nn.insertAdjacentElement('afterend',tools);tools.onmousedown=null;
    tools.onclick=function(e){var a=e.target.closest('button');if(!a)return;var act=a.getAttribute('data-a');
      var v=nn.innerText.trim();stop();
      if(act==='no'){paint(key);return}
      save({key:key,kind:'note',sec:b.sec,orig:plain(b.orig),val:act==='del'?null:v});paint(key);
    };
  }
  function stop(){if(editing){editing.contentEditable='false';editing.classList.remove('e-editing')}editing=null;tools.remove()}

  // One listener for the whole page (the questions drawer is outside <main>).
  document.addEventListener('click',function(e){
    if(NOTAG||bar.contains(e.target)||dlg.contains(e.target))return;
    if(editing&&(editing.contains(e.target)||tools.contains(e.target)))return;
    if(menu.contains(e.target))return;
    var nn=e.target.closest('.e-hand');
    if(nn&&!editing){e.preventDefault();e.stopPropagation();var bb=blocks[nn.getAttribute('data-for')];if(bb)startNote(bb.el);return}
    var el=e.target.closest('[data-ek]');
    if(!el||editing)return;
    if(e.target.closest('sup a,a.nb'))return; // footnote links still work
    e.preventDefault();e.stopPropagation();openMenu(el);
  },true);

  // ---- The list of everything changed on this page ----
  function openList(){
    var ks=Object.keys(rows).map(function(k){return rows[k]}).sort(function(a,b){return ((a.sec||0)-(b.sec||0))||a.key.localeCompare(b.key,undefined,{numeric:true})});
    var lbl={text:'שינוי טקסט',note:'הערה',correct:'תשובה נכונה'};
    var h='<h3>השינויים בעמוד הזה ('+ks.length+')</h3>';
    if(!ks.length)h+='<p>עוד אין שינויים בעמוד הזה.</p>';
    h+='<ol>'+ks.map(function(r){
      var b=blocks[r.kind==='correct'?r.key.replace(/\.c$/,'.q'):r.key], lost=!b||(r.kind==='text'&&!fits(b,r));
      var body=r.kind==='note'?'<div class="hand">'+esc(r.val)+'</div>'
        :r.kind==='correct'?'התשובה הנכונה: '+esc(r.val)+' (במקור '+esc(r.orig)+')'
        :'<div class="was">'+esc(r.orig)+'</div><div class="now">'+esc(plain(r.val))+'</div>';
      return '<li><a href="#" data-go="'+esc(lost?'':b===blocks[r.key]?r.key:r.key.replace(/\.c$/,'.q'))+'">'+(r.sec?'קטע '+r.sec+' · ':'')+lbl[r.kind]+'</a>'+(lost?' <small>(המקום לא נמצא)</small>':'')+body+'</li>';
    }).join('')+'</ol><button type="button" class="primary" data-close>סגירה</button>';
    dlg.innerHTML=h;dlg.showModal();
  }
  dlg.addEventListener('click',function(e){
    if(e.target.closest('[data-close]')||e.target===dlg){dlg.close();return}
    var a=e.target.closest('[data-go]');if(!a)return;e.preventDefault();dlg.close();
    var b=blocks[a.getAttribute('data-go')];if(!b)return;
    var sec=b.el.closest('.sec');if(sec&&sec.hidden&&!b.el.closest('.qdrawer')){location.hash='#'+sec.id}
    var q=b.el.closest('.iq');if(q&&!q.closest('.qdrawer')&&window.openQuiz&&!html.classList.contains('proof'))openQuiz(q.getAttribute('data-iq'));
    setTimeout(function(){b.el.scrollIntoView({block:'center'});b.el.classList.add('e-flash');setTimeout(function(){b.el.classList.remove('e-flash')},1500)},150);
  });

  // ---- Start ----
  function load(){
    try{rows=JSON.parse(localStorage.getItem(LS))||{}}catch(e){rows={}}
    paintAll();
    SITE.sb.from('edits').select('*').eq('chapter',ch).then(function(x){
      if(x.error){status('⚠ רק במכשיר',true);paintAll();return}
      online=true;
      var local=rows;rows={};(x.data||[]).forEach(function(r){rows[id(r)]=r});
      // anything saved only on this device while offline goes up now
      Object.keys(local).forEach(function(k){var r=local[k];if(!rows[k]||(r.updated_at||'')>(rows[k].updated_at||'')){rows[k]=r;
        SITE.sb.from('edits').upsert({chapter:ch,key:r.key,kind:r.kind,sec:r.sec,orig:r.orig,val:r.val,updated_at:r.updated_at}).then(function(){})}});
      keepLocal();status(Object.keys(rows).length?'נשמר ✓':'');paintAll();
    });
  }
  if(NOTAG)return;
  tagText();
  function quiz(){tagQuiz();paintAll()}
  if(document.querySelector('main[data-inline-quiz]')){if(window.IQ_READY)quiz();document.addEventListener('iq-rendered',quiz)}
  load();
})();
