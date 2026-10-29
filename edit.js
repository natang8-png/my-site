// Edit mode (?edit on a chapter page, admin only).
// The whole chapter in one scroll, every question with its right answer. Tap any line (text, heading, question,
// answer, explanation) for a small menu: edit the text, add a handwritten note, mark the right answer, or undo.
// Everything is saved in the "edits" table (supabase/v13.sql), so it shows on every device; Claude reads it from
// there and puts the changes into the chapter itself. If the table can't be reached, it is kept on this device.
(function(){
  var main=document.querySelector('main.chapter');if(!main)return;
  var ch=main.getAttribute('data-chapter'), LS='edits:'+ch, html=document.documentElement;
  html.classList.add('editing');
  var rows={}, online=false, blocks={}, cur=null, editing=null;
  function id(r){return r.key+'|'+r.kind}
  function esc(t){var d=document.createElement('div');d.textContent=t==null?'':t;return d.innerHTML}
  function plain(h){var d=document.createElement('div');d.innerHTML=h;return d.textContent.replace(/\s+/g,' ').trim()}

  // Note at the top, and the bar at the bottom.
  var head=main.querySelector('header'), note=document.createElement('div');note.className='edit-note';
  note.innerHTML='<b>מצב עריכה</b> · לוחצים על שורה כדי לערוך אותה או להוסיף הערה בכתב יד. השינויים נשמרים מעצמם. '+
    '<a href="'+location.pathname+'">יציאה ממצב עריכה</a>';
  head.appendChild(note);
  var bar=document.createElement('div');bar.className='edit-bar';bar.dir='rtl';
  bar.innerHTML='<span class="eb-count"></span><span class="eb-save"></span>'+
    '<label class="eb-orig"><input type="checkbox"> הצג מקור</label><button type="button" class="eb-list">רשימת השינויים</button>';
  document.body.appendChild(bar);
  var dlg=document.createElement('dialog');dlg.className='edit-dlg';dlg.dir='rtl';document.body.appendChild(dlg);
  bar.querySelector('.eb-orig input').onchange=function(){html.classList.toggle('show-orig',this.checked)};
  bar.querySelector('.eb-list').onclick=openList;
  function status(t,bad){var s=bar.querySelector('.eb-save');s.textContent=t;s.classList.toggle('bad',!!bad)}

  // ---- Blocks: every line that can be edited gets a key ----
  function secNum(el){var s=el.closest('.sec');return s?+s.id.slice(1):0}
  function tag(el,key,kind){el.setAttribute('data-ek',key);el.setAttribute('data-et',kind);
    blocks[key]={el:el,orig:el.innerHTML,kind:kind,sec:secNum(el)}}
  function tagText(){
    [].forEach.call(document.querySelectorAll('.sec'),function(sec){
      var n=0, sid=sec.id;
      var h=sec.querySelector('.sec-head h2');if(h)tag(h,sid+'.h','text');
      var c=sec.querySelector('.content');if(!c)return;
      [].forEach.call(c.querySelectorAll('p,h3,h4,li,blockquote'),function(el){
        if(el.tagName==='LI'&&el.querySelector('p'))return;          // a footnote: its <p> is the block
        if(el.tagName==='BLOCKQUOTE'&&el.querySelector('p'))return;
        if(el.parentNode.closest('[data-ek]'))return;                 // already inside a block
        tag(el,sid+'.t'+(++n),'text');
      });
    });
  }
  function tagQuiz(){
    [].forEach.call(document.querySelectorAll('[data-iq]'),function(box){
      var s='s'+box.getAttribute('data-iq');
      [].forEach.call(box.querySelectorAll('.qq'),function(f){
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
  function anchor(el){return el.tagName==='BUTTON'?el.parentNode:el} // notes on an answer go under the answers
  function paint(key){
    var b=blocks[key];if(!b)return;
    var t=rows[key+'|text'], n=rows[key+'|note'];
    if(editing!==b.el)b.el.innerHTML=t?t.val:b.orig;
    b.el.classList.toggle('e-changed',!!t);
    var o=b.el.nextElementSibling;if(o&&o.classList.contains('e-orig')&&o.getAttribute('data-for')===key)o.remove();
    if(t){var od=document.createElement('div');od.className='e-orig';od.setAttribute('data-for',key);
      od.innerHTML='<small>במקור:</small> '+b.orig;(b.el.tagName==='BUTTON'?b.el.parentNode:b.el).insertAdjacentElement(b.el.tagName==='BUTTON'?'beforeend':'afterend',od);
      if(b.el.tagName==='BUTTON'){od.remove()} } // an answer's original shows in the list, not inside the buttons
    var nn=document.querySelector('.e-hand[data-for="'+key+'"]');
    if(n&&n.val){
      if(!nn){nn=document.createElement('div');nn.className='e-hand hand';nn.setAttribute('data-for',key);
        insertNote(b.el,nn)}
      if(nn!==editing)nn.textContent=n.val;
    }else if(nn&&nn!==editing)nn.remove();
  }
  function insertNote(el,nn){
    var a=anchor(el), after=a;
    // keep notes of one block (and of the answers) in order, after the original-text line
    while(after.nextElementSibling&&(after.nextElementSibling.classList.contains('e-orig')||after.nextElementSibling.classList.contains('e-hand')))after=after.nextElementSibling;
    after.insertAdjacentElement('afterend',nn);
  }
  function paintCorrect(){
    [].forEach.call(document.querySelectorAll('.qq'),function(f){
      var lg=f.querySelector('[data-ek$=".q"]');if(!lg)return;
      var base=lg.getAttribute('data-ek').replace(/\.q$/,''), r=rows[base+'.c|correct'];
      var bs=f.querySelectorAll('.opts button');if(!bs.length)return;
      if(!f.hasAttribute('data-c0'))[].forEach.call(bs,function(b,j){if(b.classList.contains('ok'))f.setAttribute('data-c0',j)});
      var c=r?+r.val:+f.getAttribute('data-c0');
      [].forEach.call(bs,function(b,j){b.classList.toggle('ok',j===c);b.classList.toggle('e-changed-c',!!r&&j===c)});
    });
  }
  function paintAll(){Object.keys(blocks).forEach(paint);paintCorrect();count()}
  function count(){
    var t=0,n=0,c=0;Object.keys(rows).forEach(function(k){var r=rows[k];if(r.kind==='note')n++;else if(r.kind==='correct')c++;else t++});
    bar.querySelector('.eb-count').textContent=t+' שינויים · '+n+' הערות'+(c?' · '+c+' תשובות':'');
  }

  // ---- Saving ----
  function keepLocal(){try{localStorage.setItem(LS,JSON.stringify(rows))}catch(e){}}
  function save(r){
    var k=id(r);
    if(r.val==null||r.val===''){delete rows[k]}else{r.updated_at=new Date().toISOString();rows[k]=r}
    keepLocal();count();
    if(!online){status('נשמר במכשיר הזה בלבד',true);return}
    status('שומר...');
    var q=r.val==null||r.val===''?SITE.sb.from('edits').delete().eq('chapter',ch).eq('key',r.key).eq('kind',r.kind)
      :SITE.sb.from('edits').upsert({chapter:ch,key:r.key,kind:r.kind,sec:r.sec,orig:r.orig,val:r.val,updated_at:r.updated_at});
    q.then(function(x){status(x.error?'לא נשמר בשרת (נשמר במכשיר)':'נשמר ✓',!!x.error)});
  }

  // ---- The small menu under a tapped line ----
  var menu=document.createElement('div');menu.className='e-menu';menu.dir='rtl';
  function closeMenu(){menu.remove();if(cur)cur.classList.remove('e-cur');cur=null}
  function openMenu(el){
    closeMenu();cur=el;el.classList.add('e-cur');
    var key=el.getAttribute('data-ek'), kind=el.getAttribute('data-et');
    var h='<button type="button" data-a="edit">✎ עריכת טקסט</button><button type="button" data-a="note">✍ הערה בכתב יד</button>';
    if(kind==='answer')h+='<button type="button" data-a="right">✓ זו התשובה הנכונה</button>';
    if(rows[key+'|text'])h+='<button type="button" data-a="undo">↺ החזר למקור</button>';
    h+='<button type="button" data-a="x" aria-label="סגירה">✕</button>';
    menu.innerHTML=h;
    anchor(el).insertAdjacentElement('afterend',menu);
  }
  menu.addEventListener('click',function(e){
    var a=e.target.closest('button');if(!a||!cur)return;e.stopPropagation();
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

  // Editing a line: it becomes editable, with שמירה / ביטול / מודגש under it.
  var tools=document.createElement('div');tools.className='e-tools';tools.dir='rtl';
  function startText(el){
    stop();editing=el;var key=el.getAttribute('data-ek'), b=blocks[key], before=el.innerHTML;
    el.contentEditable='true';el.classList.add('e-editing');el.focus();
    tools.innerHTML='<button type="button" class="primary" data-a="ok">שמירה</button><button type="button" data-a="bold"><b>מודגש</b></button><button type="button" data-a="no">ביטול</button>';
    anchor(el).insertAdjacentElement('afterend',tools);
    tools.onmousedown=function(e){e.preventDefault()}; // keep the selection for "מודגש"
    tools.onclick=function(e){var a=e.target.closest('button');if(!a)return;var act=a.getAttribute('data-a');
      if(act==='bold'){document.execCommand('bold');return}
      var v=el.innerHTML;stop();
      if(act==='no'){el.innerHTML=before;return}
      var same=plain(v)===plain(b.orig)&&v===b.orig;
      save({key:key,kind:'text',sec:b.sec,orig:plain(b.orig),val:same?null:v});paint(key);
    };
  }
  // A note: a handwritten line under the block; empty = deleted.
  function startNote(el){
    stop();var key=el.getAttribute('data-ek'), b=blocks[key];
    var nn=document.querySelector('.e-hand[data-for="'+key+'"]');
    if(!nn){nn=document.createElement('div');nn.className='e-hand hand';nn.setAttribute('data-for',key);insertNote(el,nn)}
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

  main.addEventListener('click',function(e){
    if(editing&&(editing.contains(e.target)||tools.contains(e.target)))return;
    if(menu.contains(e.target))return;
    var nn=e.target.closest('.e-hand');
    if(nn&&!editing){startNote(blocks[nn.getAttribute('data-for')].el);return}
    var el=e.target.closest('[data-ek]');
    if(!el||editing){return}
    if(e.target.closest('a[href]'))return; // footnote links still work
    e.preventDefault();openMenu(el);
  },true);

  // ---- The list of everything changed ----
  function openList(){
    var ks=Object.keys(rows).map(function(k){return rows[k]}).sort(function(a,b){return (a.sec-b.sec)||a.key.localeCompare(b.key,undefined,{numeric:true})});
    var lbl={text:'שינוי טקסט',note:'הערה',correct:'תשובה נכונה'};
    var h='<h3>רשימת השינויים ('+ks.length+')</h3>';
    if(!ks.length)h+='<p>עוד אין שינויים.</p>';
    h+='<ol>'+ks.map(function(r){
      var b=blocks[r.kind==='correct'?r.key.replace(/\.c$/,'.q'):r.key];
      var body=r.kind==='note'?'<div class="hand">'+esc(r.val)+'</div>'
        :r.kind==='correct'?'התשובה הנכונה: '+esc(r.val)+' (במקור '+esc(r.orig)+')'
        :'<div class="was">'+esc(r.orig)+'</div><div class="now">'+esc(plain(r.val))+'</div>';
      return '<li><a href="#" data-go="'+esc(b?r.key:'')+'">קטע '+r.sec+' · '+lbl[r.kind]+'</a>'+(b?'':' <small>(המקום לא נמצא)</small>')+body+'</li>';
    }).join('')+'</ol><button type="button" class="primary" data-close>סגירה</button>';
    dlg.innerHTML=h;dlg.showModal();
  }
  dlg.addEventListener('click',function(e){
    if(e.target.closest('[data-close]')||e.target===dlg){dlg.close();return}
    var a=e.target.closest('[data-go]');if(!a)return;e.preventDefault();dlg.close();
    var k=a.getAttribute('data-go'), b=blocks[k]||blocks[k.replace(/\.c$/,'.q')];
    if(b){b.el.scrollIntoView({block:'center'});b.el.classList.add('e-flash');setTimeout(function(){b.el.classList.remove('e-flash')},1500)}
  });

  // ---- Start: admin only ----
  function begin(){
    tagText();
    function quiz(){tagQuiz();load()}
    if(!document.querySelector('main[data-inline-quiz]')||window.IQ_READY)quiz();
    else document.addEventListener('iq-rendered',quiz,{once:true});
  }
  function load(){
    try{rows=JSON.parse(localStorage.getItem(LS))||{}}catch(e){rows={}}
    SITE.sb.from('edits').select('*').eq('chapter',ch).then(function(x){
      if(x.error){status('נשמר במכשיר הזה בלבד',true);paintAll();return}
      online=true;
      var local=rows;rows={};(x.data||[]).forEach(function(r){rows[id(r)]=r});
      // anything saved only on this device while offline goes up now
      Object.keys(local).forEach(function(k){var r=local[k];if(!rows[k]||(r.updated_at||'')>(rows[k].updated_at||'')){rows[k]=r;
        SITE.sb.from('edits').upsert({chapter:ch,key:r.key,kind:r.kind,sec:r.sec,orig:r.orig,val:r.val,updated_at:r.updated_at}).then(function(){})}});
      keepLocal();status('נשמר ✓');paintAll();
    });
  }
  if(!window.SITE){note.innerHTML='<b>מצב עריכה</b> לא נטען.';return}
  SITE.ready.then(function(st){
    if(st.profile&&st.profile.is_admin){begin();return}
    html.classList.remove('editing');bar.remove();
    note.innerHTML='<b>מצב עריכה</b> פתוח רק למנהל. '+(st.user?'':'<a href="/login/?next='+encodeURIComponent(location.pathname+location.search)+'">כניסה</a>');
  });
})();
