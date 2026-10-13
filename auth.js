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
    {path:'halacha/family/tumat-betulim', title:'טומאת בתולים'},
    // Opens only with its own grant (a wider grant does not cover it), for one week at a time.
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
  function live(g){ return !g.expires_at||new Date(g.expires_at)>new Date() }
  function access(path){
    if(state.profile&&state.profile.is_admin) return 'study';
    var best=null, own=TREE.some(function(n){return n.path===path&&n.own});
    state.grants.forEach(function(g){
      if(!live(g)) return;
      if(path===g.path||(!own&&path.indexOf(g.path+'/')===0)){ var rank={study:3,read:2,quiz:1}; if((rank[g.mode]||0)>(rank[best]||0)) best=g.mode }
    });
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
        '<span class="who"></span>'+(incomplete()?'<span>·</span><a href="/login/?complete=1&next='+next+'">השלמת פרטים</a>':'')+'<span>·</span><button type="button" class="link" data-out>יציאה</button>';
      bar.querySelector('.who').textContent=name();
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
    saveQuiz:function(ch,sec,score,total){ if(!state.user) return; sb.from('quiz_results').insert({user_id:state.user.id,chapter:ch,section:+sec,score:score,total:total}).then(function(){}) }
  };
})();
