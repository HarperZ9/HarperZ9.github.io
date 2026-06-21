/* reveal.js — lightweight scroll-reveal, shared across the site now that the
   worlds engine (hero.js) is retired. Resting state is already visible in CSS,
   so no-JS and prefers-reduced-motion show everything; this only adds the
   gentle entrance as sections scroll in. */
(function () {
  var els = document.querySelectorAll('.reveal, .reveal-children');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion:reduce)').matches) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('visible');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (e) { io.observe(e); });
})();
