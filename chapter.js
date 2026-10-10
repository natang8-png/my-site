(function(){
  var secs=[].slice.call(document.querySelectorAll('.sec'));
  if(!secs.length)return;
  var toc=document.getElementById('toc');
  document.documentElement.classList.add('one-sec');
  function show(){
    var id=(location.hash||'').slice(1), found=false;
    secs.forEach(function(s){var on=s.id===id;s.hidden=!on;if(on)found=true});
    if(!found){secs[0].hidden=false;id=secs[0].id}
    [].forEach.call(toc.querySelectorAll('a'),function(a){a.classList.toggle('current',a.getAttribute('href')==='#'+id)});
  }
  window.addEventListener('hashchange',function(){show();toc.open=false;document.querySelector('.sec:not([hidden])').scrollIntoView({block:'start'})});
  show();
  if(location.hash){var cur=document.querySelector('.sec:not([hidden])');if(cur)cur.scrollIntoView({block:'start'})}
})();
