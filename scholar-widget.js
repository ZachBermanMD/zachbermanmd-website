(function () {
  // Edit these four values whenever you refresh your metrics from
  // https://scholar.google.com/citations?user=wWlx5DQAAAAJ&hl=en
  var SCHOLAR_STATS = {
    hIndex: 12,
    citations: 595,
    i10Index: 14,
    updated: 'July 2026',
  };
  var PROFILE_URL = 'https://scholar.google.com/citations?user=wWlx5DQAAAAJ&hl=en';

  var root = document.getElementById('zb-scholar-root');
  if (!root) return;
  root.id = 'zb-scholar';
  root.innerHTML =
    '<div class="zbs-card">' +
      '<div class="zbs-header">Google Scholar</div>' +
      '<div class="zbs-primary">' +
        '<div class="zbs-primary-value">' + SCHOLAR_STATS.hIndex + '</div>' +
        '<div class="zbs-primary-label">h-index</div>' +
      '</div>' +
      '<div class="zbs-secondary">' +
        '<div class="zbs-stat"><div class="zbs-stat-value">' + SCHOLAR_STATS.citations + '</div><div class="zbs-stat-label">Citations</div></div>' +
        '<div class="zbs-stat"><div class="zbs-stat-value">' + SCHOLAR_STATS.i10Index + '</div><div class="zbs-stat-label">i10-index</div></div>' +
      '</div>' +
      '<div class="zbs-updated">As of ' + SCHOLAR_STATS.updated + '</div>' +
      '<a class="zbs-link" href="' + PROFILE_URL + '" target="_blank" rel="noopener">View full profile &rarr;</a>' +
    '</div>';
})();
