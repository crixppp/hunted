(function(doc){
  if (!doc) return;

  var bannerId = 'maintenanceBanner';
  var body = doc.body;
  if (!body) return;

  function ensureBanner(){
    var existing = doc.getElementById(bannerId);
    if (existing) return existing;

    var bar = doc.createElement('div');
    bar.id = bannerId;
    bar.className = 'maintenance-banner';

    var textWrap = doc.createElement('div');
    textWrap.className = 'maintenance-text';

    var title = doc.createElement('div');
    title.className = 'maintenance-title';
    title.textContent = 'Maintenance in Progress';

    var subtitle = doc.createElement('div');
    subtitle.className = 'maintenance-subtitle';
    subtitle.textContent = 'Some features may be limited or unavailable. Thanks for your patience';

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    bar.appendChild(textWrap);

    body.insertBefore(bar, body.firstChild);
    return bar;
  }

  function setVisible(force){
    var bar = ensureBanner();
    if (!bar) return;
    if (force) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  }

  function toggleVisibility(force){
    var bar = ensureBanner();
    if (!bar) return;
    if (typeof force === 'boolean') {
      setVisible(force);
      return;
    }
    var willShow = !bar.classList.contains('visible');
    setVisible(willShow);
  }

  if (!doc.defaultView) return;
  doc.defaultView.MaintenanceBanner = {
    show: function(){ toggleVisibility(true); },
    hide: function(){ toggleVisibility(false); },
    toggle: toggleVisibility,
    isVisible: function(){
      var bar = ensureBanner();
      return !!(bar && bar.classList.contains('visible'));
    }
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function(){ setVisible(false); });
  } else {
    setVisible(false);
  }
})(document);
