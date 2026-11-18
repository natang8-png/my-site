// "צור קשר" (Natan, 2026-11-15).
// Guests: a "אפשר לכתוב כאן" box on the home page. Signed-in readers: a box at the bottom of /contact/.
// Sending: with a name and a phone or e-mail the message goes out at once. With details missing, the message is
// saved right away as a draft (so it is never lost), and a window offers to add them; "שליחה" / "שליחה בלי פרטים" make it final.
(function(){
  var css='.cbox{display:grid;gap:10px;padding:18px 20px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}'+
    '.cbox input,.cbox textarea,dialog.csend input,dialog.csend textarea{font:inherit;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:inherit}'+
    '.cbox textarea,dialog.csend textarea{resize:vertical}'+
    '.cbox .primary,dialog.csend .primary{justify-self:start;border-radius:10px}'+
    '.cbox .primary:disabled{background:transparent;color:var(--muted);border:1px dashed var(--line);font-weight:500;cursor:default}'+
    'dialog.csend{border:0;border-radius:16px;padding:20px;background:var(--bg);color:var(--fg);width:min(26rem,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;box-shadow:0 10px 40px rgb(0 0 0/.25)}'+
    'dialog.csend::backdrop{background:rgb(0 0 0/.45)}dialog.csend h2{margin:0 0 14px}'+
    'dialog.csend label{display:grid;gap:6px;font-weight:700}dialog.csend label input,dialog.csend label textarea{font-weight:400}'+
    'dialog.csend .acts{display:flex;gap:14px;align-items:center;flex-wrap:wrap}dialog.csend .plain{background:none;border:0;padding:0;color:var(--muted);text-decoration:underline}'+
    'dialog.csend.done{text-align:center;padding:28px 20px}dialog.csend.done .ok{width:56px;height:56px;border-radius:50%;background:var(--accent);color:var(--bg);font-size:30px;line-height:56px;margin:0 auto 14px}'+
    'dialog.csend.done h2{margin:0 0 8px}dialog.csend.done p{margin:0 0 18px;color:var(--muted)}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function uuid(){
    if(window.crypto&&crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
  }
  function esc(t){var d=document.createElement('div');d.textContent=t==null?'':t;return d.innerHTML}
  function save(id,v,fin){
    // צפייה כ... (preview): the message is not sent, the page acts as if it was.
    if(SITE.state&&SITE.state.viewAs) return Promise.resolve({error:null,data:null});
    return SITE.sb.rpc('contact_save',{p_id:id,p_body:v.body,p_name:v.name||null,p_phone:v.phone||null,p_email:v.email||null,p_final:fin});
  }
  function fail(el,r){
    el.classList.add('err');
    el.textContent=/contact_save|schema cache|does not exist/.test(r.error.message||'')?'אי אפשר לשלוח הודעות עדיין, המערכת בהכנה.':
      /too many/.test(r.error.message)?'נשלחו יותר מדי הודעות כרגע. אפשר לנסות שוב מאוחר יותר.':'ההודעה לא נשלחה. אפשר לנסות שוב.';
  }
  function dialog(cls,html){
    var d=document.createElement('dialog');d.className='csend'+(cls?' '+cls:'');d.dir='rtl';d.innerHTML=html;
    document.body.appendChild(d);d.addEventListener('close',function(){d.remove()});
    d.addEventListener('click',function(e){if(e.target===d)d.close()});
    d.showModal();return d;
  }
  function thanks(canReply,after){
    var d=dialog('done','<div class="ok" aria-hidden="true">✓</div><h2>ההודעה נשלחה</h2><p>'+(canReply?'תודה. נחזור אליך בהקדם.':'תודה.')+'</p><button type="button" class="primary" data-x>סגירה</button>');
    d.querySelector('[data-x]').onclick=function(){d.close()};
    after();   // the box is emptied as soon as the message is out, so it cannot be sent twice
  }

  // box: the element holding the fields. withDetails=false on /contact/ (the site already knows the reader).
  function wire(box,withDetails){
    var f={body:box.querySelector('[name=body]'),name:box.querySelector('[name=name]'),phone:box.querySelector('[name=phone]'),email:box.querySelector('[name=email]')};
    var btn=box.querySelector('[data-send]'), msg=box.querySelector('.msg'), id=uuid();
    function vals(){var o={};Object.keys(f).forEach(function(k){o[k]=f[k]?f[k].value.trim():''});return o}
    function sync(){btn.disabled=!f.body.value.trim()}
    function reset(){Object.keys(f).forEach(function(k){if(f[k])f[k].value=''});id=uuid();sync()}
    f.body.addEventListener('input',sync);sync();

    btn.addEventListener('click',async function(){
      var v=vals(); if(!v.body) return;
      msg.textContent='';msg.classList.remove('err');btn.disabled=true;
      var full=!withDetails||(v.name&&(v.phone||v.email));
      var r=await save(id,v,!!full);
      btn.disabled=false;
      if(r.error){fail(msg,r);return}
      if(full){thanks(!withDetails||!!(v.phone||v.email),reset);return}
      ask(v);
    });

    // The details window. The message is already saved as a draft at this point.
    function ask(v){
      function row(k,label,q,type){return '<label>'+(v[k]?label:q)+'<input name="'+k+'" type="'+type+'" value="'+esc(v[k])+'"'+(k==='name'?'':' dir="ltr" style="text-align:right"')+'></label>'}
      var d=dialog('','<h2>שליחת הודעה</h2><div class="cbox"><label>ההודעה שלך:<textarea name="body" rows="4">'+esc(v.body)+'</textarea></label>'+
        row('name','שם:','רוצה להוסיף שם?','text')+row('phone','טלפון:','רוצה להוסיף טלפון?','tel')+row('email','אימייל:','רוצה להוסיף אימייל?','email')+
        '<div class="acts"><button type="button" class="primary" data-go>שליחה</button><button type="button" class="plain" data-skip>שליחה בלי פרטים</button></div><p class="msg" role="status"></p></div>');
      var sent=false;
      async function fin(useNew){
        var n=v;
        if(useNew){n={};['body','name','phone','email'].forEach(function(k){n[k]=d.querySelector('[name='+k+']').value.trim()});if(!n.body)n.body=v.body}
        var r=await save(id,n,true);
        if(r.error){fail(d.querySelector('.msg'),r);return}
        sent=true;d.close();thanks(!!(n.phone||n.email),reset);
      }
      d.querySelector('[data-go]').onclick=function(){fin(true)};
      d.querySelector('[data-skip]').onclick=function(){fin(false)};
      // Closed without choosing: what was typed in the window goes back to the page, the draft stays with the admin.
      d.addEventListener('close',function(){ if(sent)return; ['body','name','phone','email'].forEach(function(k){var x=d.querySelector('[name='+k+']');if(f[k]&&x)f[k].value=x.value});sync() });
    }
  }

  window.CONTACT={wire:wire,esc:esc};
})();
