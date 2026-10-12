// Chapters that need their own permission (e.g. "סדר ליל החתונה", opened for one week at a time).
// Without permission the reader gets "אין לך הרשאה, האם לשלוח בקשה?" and a button that sends a request to the admin.
(function(){
  var css='.req-box{display:grid;gap:12px;padding:18px 20px;border:1px dashed var(--line);border-radius:14px;background:var(--soft)}'+
    '.req-box p{margin:0}.req-box .acts{display:flex;gap:8px;flex-wrap:wrap}'+
    'dialog.req{border:1px solid var(--line);border-radius:16px;padding:0;background:var(--bg);color:var(--fg);width:min(26rem,calc(100vw - 32px))}'+
    'dialog.req::backdrop{background:rgb(0 0 0/.45)}dialog.req .req-box{border:0;background:none}'+
    '.topic .lock{font-size:.85em;margin-inline-start:6px}.until{color:var(--muted);font-size:.92rem;margin:0}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function day(t){return new Date(t).toLocaleDateString('he-IL',{day:'numeric',month:'long'})}
  function node(path){return (SITE.TREE||[]).find(function(n){return n.path===path})||{path:path,title:path}}

  // The newest grant on this exact path, live or expired.
  function grantOf(path){
    return SITE.state.grants.filter(function(g){return g.path===path}).sort(function(a,b){return (b.expires_at||'9')>(a.expires_at||'9')?1:-1})[0]||null;
  }

  // Fills box with the right message for this reader. Returns true when the chapter is open to them.
  async function paint(box, path, inDialog){
    await SITE.ready;
    if(SITE.access(path)) return true;
    var n=node(path), s=SITE.state, next=encodeURIComponent('/halacha/'+path+'/');
    box.className='req-box';
    if(!s.user){
      box.innerHTML='<p><b>אין לך הרשאה לפרק "'+n.title+'".</b></p><p>הפרק נפתח בהרשאה אישית מנתן. כדי לבקש אותה צריך קודם להיכנס לאתר.</p>'+
        '<div class="acts"><a class="primary" href="/login/?next='+next+'" style="text-decoration:none;border-radius:999px">כניסה / הרשמה</a>'+(inDialog?'<button type="button" data-x>סגירה</button>':'')+'</div>';
      return false;
    }
    var open=await SITE.sb.from('access_requests').select('created_at').eq('user_id',s.user.id).eq('path',path).is('handled_at',null).maybeSingle();
    if(open.data){
      box.innerHTML='<p><b>הבקשה שלך נשלחה ✓</b></p><p>שלחת בקשה ב־'+day(open.data.created_at)+'. כשנתן יאשר, הפרק ייפתח לך ל־'+(n.days||7)+' ימים.</p>'+(inDialog?'<div class="acts"><button type="button" data-x>סגירה</button></div>':'');
      return false;
    }
    var g=grantOf(path);
    box.innerHTML=(g&&g.expires_at?'<p><b>ההרשאה שלך לפרק "'+n.title+'" הסתיימה ב־'+day(g.expires_at)+'.</b></p><p>האם לשלוח בקשה חדשה?</p>'
        :'<p><b>אין לך הרשאה לפרק "'+n.title+'".</b></p><p>האם לשלוח בקשה?</p>')+
      '<div class="acts"><button type="button" class="primary" data-ask>שליחת בקשה</button>'+(inDialog?'<button type="button" data-x>לא עכשיו</button>':'')+'</div><p class="msg" role="status"></p>';
    box.querySelector('[data-ask]').onclick=async function(){
      this.disabled=true;
      var r=await SITE.sb.from('access_requests').insert({user_id:s.user.id,path:path});
      if(r.error&&r.error.code!=='23505'){
        var m=box.querySelector('.msg');m.classList.add('err');
        m.textContent=/access_requests/.test(r.error.message)?'אי אפשר לשלוח בקשות עדיין, המערכת בהכנה.':r.error.message;
        this.disabled=false;return;
      }
      paint(box,path,inDialog);
    };
    return false;
  }

  // Links marked data-lock="path" open a request window instead of a closed page.
  document.addEventListener('click',async function(e){
    var a=e.target.closest('a[data-lock]'); if(!a||!window.SITE) return;
    e.preventDefault();
    var d=document.createElement('dialog'), box=document.createElement('div');
    d.className='req';d.appendChild(box);
    if(await paint(box,a.getAttribute('data-lock'),true)){ location.href=a.href; return }
    document.body.appendChild(d);
    d.addEventListener('click',function(ev){ if(ev.target===d||ev.target.closest('[data-x]')) d.close() });
    d.addEventListener('close',function(){d.remove()});
    d.showModal();
  });

  window.LOCK={paint:paint, grantOf:grantOf, day:day};
})();
