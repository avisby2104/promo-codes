// Runs in the visitor's browser: local times, live expiry, copy buttons and personal marks.
(function () {
  var now = Date.now();

  document.querySelectorAll('time[datetime]').forEach(function (t) {
    var d = new Date(t.getAttribute('datetime'));
    if (isNaN(d)) return;
    t.textContent = d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    t.title = t.getAttribute('datetime');
  });

  // The page is rebuilt every few hours, so move codes that expired since then.
  var active = document.getElementById('active');
  var expired = document.getElementById('expired');
  if (active && expired) {
    active.querySelectorAll('.code[data-expires]').forEach(function (li) {
      if (new Date(li.dataset.expires).getTime() <= now) expired.prepend(li);
    });
    var none = document.getElementById('no-active');
    if (none) none.hidden = active.children.length > 0;
  }
  document.querySelectorAll('#latest li[data-expires]').forEach(function (li) {
    var label = li.querySelector('.count');
    if (label && new Date(li.dataset.expires).getTime() <= now) { label.textContent = 'expired'; label.classList.remove('on'); }
  });

  document.querySelectorAll('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(btn.dataset.code).then(function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      });
    });
  });

  function load(key) {
    try { return localStorage.getItem('mark:' + key); } catch (e) { return null; }
  }
  function save(key, value) {
    try {
      if (value) localStorage.setItem('mark:' + key, value);
      else localStorage.removeItem('mark:' + key);
    } catch (e) { /* marks are just not remembered */ }
  }
  function show(li, value) {
    li.classList.toggle('is-used', value === 'used');
    li.classList.toggle('is-failed', value === 'failed');
    li.querySelectorAll('[data-mark]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mark === value));
    });
  }
  document.querySelectorAll('.code').forEach(function (li) {
    var key = li.dataset.key;
    show(li, load(key));
    li.querySelectorAll('[data-mark]').forEach(function (b) {
      b.addEventListener('click', function () {
        var value = load(key) === b.dataset.mark ? null : b.dataset.mark;
        save(key, value);
        show(li, value);
      });
    });
  });
})();
