// Accounts: login state, per-user grants, and saving progress to Supabase.
// The publishable key is meant to be public; row-level security in supabase/schema.sql guards the data.
(function(){
  var URL='https://pfoxbjttzfdhunkxhkvz.supabase.co', KEY='sb_publishable_-UFwu9rEcGomns606YfG7Q_ij2q_oQs';
  // Turn on once the Google provider is set up in Supabase (Authentication -> Sign In / Providers).
  var GOOGLE=false;

  // Content tree. A grant on a path opens it and everything under it.
  var TREE=[
    {path:'halacha', title:'הלכה'},
    {path:'halacha/family', title:'טהרת המשפחה'},
    {path:'halacha/family/harchakot', title:'הרחקות'},
    // Opens together with הרחקות: a grant on הרחקות opens it too (it can also have a grant of its own).
    {path:'halacha/family/yoledet', title:'יולדת', with:'halacha/family/harchakot'},
    // Opens only with its own grant (a wider grant does not cover it), for one week at a time.
    {path:'tumat-betulim', title:'טומאת בתולים', own:true, days:7},
    {path:'leil-hachatuna', title:'סדר ליל החתונה', own:true, days:7}
  ];

  var sb=null;
  try{ if(window.supabase) sb=window.supabase.createClient(URL,KEY) }catch(e){}

  var state={user:null, profile:null, grants:[]};
  var ready=(async function(){
    if(!sb) return state;
    try{
      var s=(await sb.auth.getSession()).data.session;
      if(!s) return state;
      state.user=s.user;
      var p=await sb.from('profiles').select('*').eq('id',s.user.id).maybeSingle();
      state.profile=p.data||null;
      var g=await sb.from('grants').select('*').eq('user_id',s.user.id);
      state.grants=g.data||[];
      touch();
    }catch(e){}
    return state;
  })();

  function touch(){
    try{
      var k='seen:'+state.user.id, last=+sessionStorage.getItem(k)||0;
      if(Date.now()-last<10*60e3) return;
      sessionStorage.setItem(k,Date.now());
    }catch(e){}
    sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',state.user.id).then(function(){});
  }

  // 'study' (text + quiz), 'read' (text only), 'quiz' (quiz only, older grants) or null.
  // A grant counts between its opening time (if scheduled) and its closing time (if any).
  function live(g){ var now=new Date(); return (!g.starts_at||new Date(g.starts_at)<=now)&&(!g.expires_at||new Date(g.expires_at)>now) }
  function access(path){
    if(state.profile&&state.profile.is_admin) return 'study';
    var best=null, own=TREE.some(function(n){return n.path===path&&n.own});
    state.grants.forEach(function(g){
      if(!live(g)) return;
      if(path===g.path||(!own&&path.indexOf(g.path+'/')===0)){ var rank={study:3,read:2,quiz:1}; if((rank[g.mode]||0)>(rank[best]||0)) best=g.mode }
    });
    var node=TREE.find(function(n){return n.path===path});
    if(node&&node.with){ var w=access(node.with), rank={study:3,read:2,quiz:1}; if((rank[w]||0)>(rank[best]||0)) best=w }
    return best;
  }

  function name(){
    var p=state.profile||{};
    return (p.first_name||p.last_name?[p.first_name,p.last_name].filter(Boolean).join(' '):p.full_name)||(state.user&&state.user.email)||'';
  }
  // Google sign-ups arrive without a phone number; ask them to complete their details.
  function incomplete(){ return !!(state.profile&&!state.profile.is_admin&&!state.profile.phone) }

  // Account link at the top of every page.
  function paintBar(){
    var main=document.querySelector('main'); if(!main) return;
    var bar=document.createElement('div'); bar.className='acct';
    var next=encodeURIComponent(location.pathname+location.hash);
    if(state.user){
      bar.innerHTML=(state.profile&&state.profile.is_admin?'<a href="/admin/">ניהול</a><span>·</span>':'')+
        '<a class="acct-name" href="/me/" title="האזור האישי"></a>'+(incomplete()?'<span>·</span><a href="/login/?complete=1&next='+next+'">השלמת פרטים</a>':'')+'<span>·</span><button type="button" class="link" data-out>יציאה</button>';
      bar.querySelector('.acct-name').textContent=name();
      bar.querySelector('[data-out]').onclick=async function(){await sb.auth.signOut();location.reload()};
    } else {
      bar.innerHTML='<a href="/login/?next='+next+'">כניסה / הרשמה</a>';
    }
    main.insertBefore(bar,main.firstChild);
  }
  ready.then(function(){
    if(location.pathname.indexOf('/login')===0) return;
    // A student the admin added still has the default password: change it before anything else.
    if(state.profile&&state.profile.must_change_pw){ location.replace('/login/?change=1&next='+encodeURIComponent(location.pathname+location.hash)); return }
    paintBar();
  });

  window.SITE={sb:sb, ready:ready, state:state, access:access, live:live, name:name, incomplete:incomplete, GOOGLE:GOOGLE, TREE:TREE,
    loadReads:async function(ch){ if(!state.user) return null; var r=await sb.from('reads').select('section').eq('user_id',state.user.id).eq('chapter',ch); return r.error?null:(r.data||[]).map(function(x){return String(x.section)}) },
    saveRead:function(ch,sec,on){ if(!state.user) return; var q=on?sb.from('reads').upsert({user_id:state.user.id,chapter:ch,section:+sec}):sb.from('reads').delete().eq('user_id',state.user.id).eq('chapter',ch).eq('section',+sec); q.then(function(){}) },
    // A section's quiz: the score and the chosen answers (the answers column comes with supabase/v8.sql; without it, score only).
    saveQuiz:function(ch,sec,score,total,answers){ if(!state.user) return; var row={user_id:state.user.id,chapter:ch,section:+sec,score:score,total:total};
      sb.from('quiz_results').insert(Object.assign({answers:answers||null},row)).then(function(r){ if(r.error) sb.from('quiz_results').insert(row).then(function(){}) }) },
    // The current round of a chapter's quiz: results since the last reset (the latest per section), oldest first.
    loadQuiz:async function(ch){ if(!state.user) return null;
      var z=await sb.from('quiz_resets').select('reset_at').eq('user_id',state.user.id).eq('chapter',ch).order('reset_at',{ascending:false}).limit(1);
      var since=!z.error&&z.data&&z.data[0]?z.data[0].reset_at:null;
      var q=sb.from('quiz_results').select('*').eq('user_id',state.user.id).eq('chapter',ch).order('taken_at');
      if(since) q=q.gt('taken_at',since);
      var r=await q; if(r.error) return null;
      var last={}; (r.data||[]).forEach(function(x){last[x.section]=x});
      return {since:since, rows:Object.keys(last).map(function(k){return last[k]})} },
    // Reset the whole quiz of a chapter: nothing is deleted, a new round starts (the admin sees every round).
    resetQuiz:async function(ch){
      try{localStorage.removeItem('iq:'+ch);localStorage.removeItem('quiz:'+ch)}catch(e){}
      if(!state.user) return null;
      var r=await sb.from('quiz_resets').insert({user_id:state.user.id,chapter:ch});
      return r.error||null },
    // Undo the latest reset of a chapter's quiz (the older round comes back). Needs supabase/v10.sql (a delete policy on quiz_resets).
    undoReset:async function(ch){
      if(!state.user) return null;
      var z=await sb.from('quiz_resets').select('id').eq('user_id',state.user.id).eq('chapter',ch).order('reset_at',{ascending:false}).limit(1);
      if(z.error) return z.error;
      if(!z.data||!z.data[0]) return null;
      var r=await sb.from('quiz_resets').delete().eq('id',z.data[0].id);
      return r.error||null },
    // The only place a quiz is reset: a button with a warning, and a way back from the latest reset. Used by /me/ and /admin/.
    quizResetControls:async function(host,ch){
      if(!state.user){host.innerHTML='';return}
      var q=await this.loadQuiz(ch), answered=q?q.rows.length:0, since=q&&q.since;
      var d=since?new Date(since).toLocaleDateString('he-IL',{day:'numeric',month:'numeric',year:'numeric'})+' '+new Date(since).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}):'';
      host.innerHTML='<div class="qreset">'+
        (answered?'<button type="button" class="link" data-qreset>איפוס השאלון</button>':'')+
        (since?'<button type="button" class="link" data-qundo>ביטול האיפוס האחרון</button><span class="me-meta"> (בוצע ב־'+d+')</span>':'')+
        '<span class="qmsg" role="status"></span></div>';
      var self=this, msg=host.querySelector('.qmsg');
      var rb=host.querySelector('[data-qreset]'), ub=host.querySelector('[data-qundo]');
      if(rb)rb.onclick=async function(){
        if(!confirm('לאפס את כל השאלון של הפרק?\n\nאפשר יהיה לענות מחדש על כל השאלות, וכפתור "הבא" ייסגר שוב בכל קטע עד שתענה. התשובות הקודמות נשמרות, ואפשר לבטל את האיפוס האחרון.'))return;
        var err=await self.resetQuiz(ch);
        if(err){msg.textContent='האיפוס לא הצליח: '+err.message;return}
        location.reload();
      };
      if(ub)ub.onclick=async function(){
        if(!confirm('לבטל את האיפוס האחרון?\n\nהתשובות מהסבב הקודם יחזרו להופיע.'))return;
        var err=await self.undoReset(ch);
        if(err){msg.textContent='הביטול לא הצליח: '+err.message;return}
        location.reload();
      };
    }
  };
})();
