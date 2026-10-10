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
