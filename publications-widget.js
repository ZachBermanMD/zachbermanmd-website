(function () {
  // Broadened to catch "Berman Z" indexing variants, then disambiguated from
  // other same-name authors (a Jinan-University-collaborating basic-science
  // "Zachary Berman" also lists UCSD Radiology, and an unrelated psychiatry
  // "Berman Z" exists elsewhere) via affiliation. Verified against PubMed to
  // include his full radiology output (not just oncology-labeled papers)
  // while excluding both name collisions. ORCID is OR'd in (not AND'd) since
  // not all of his papers are ORCID-tagged in PubMed yet.
  var AUTHOR_QUERY = '(Berman Z[Author] AND ("San Diego"[Affiliation] OR "interventional radiology"[Affiliation] OR "Naval Medical Center"[Affiliation]) NOT ("Jinan University"[Affiliation] OR "Guangzhou"[Affiliation])) OR 0000-0002-8651-9772[Author - Identifier]';
  var EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  var TOOL = 'zachbermanmd-site';
  var EMAIL = 'ZachBermanMD@gmail.com';
  var CACHE_KEY = 'zbPubsCacheV1';

  var FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'y90', label: 'Y90 / Radioembolization' },
    { key: 'ablation', label: 'Ablation' },
    { key: 'immuno', label: 'Immunotherapy' },
    { key: 'hcc', label: 'HCC' },
    { key: 'review', label: 'Reviews & Chapters' },
  ];

  var CAT_RULES = [
    { key: 'y90', re: /\by-?90\b|yttrium|radioembolization|radioembolisation|\btare\b|radiation segmentectomy/i },
    { key: 'ablation', re: /ablation|cryoablation|microwave|irreversible electroporation|\bire\b/i },
    { key: 'immuno', re: /immun|checkpoint|nivolumab|durvalumab|tremelimumab|pd-?1|ctla-?4|tlr9|oncolytic|pembrolizumab/i },
    { key: 'hcc', re: /hepatocellular|\bhcc\b/i },
  ];

  var TYPE_PRIORITY = [
    { match: 'Randomized Controlled Trial', label: 'Clinical Trial' },
    { match: 'Clinical Trial', label: 'Clinical Trial' },
    { match: 'Review', label: 'Review' },
    { match: 'Case Reports', label: 'Case Series' },
    { match: 'Comment', label: 'Commentary' },
    { match: 'Editorial', label: 'Commentary' },
  ];

  // Shown only if PubMed is unreachable AND the visitor has no cached copy yet.
  var FALLBACK_PUBLICATIONS = [
    { pmid: '42084516', year: '2026', journal: 'Radiology', type: 'Original Research', title: 'Consortium on Bridging Radiation Segmentectomy (COBRAS): A Multicenter Study of Complete Pathologic Necrosis in Hepatocellular Carcinoma', authors: '<strong>Berman ZT</strong>, De la Garza-Ramos C, Montazeri SA, et al.', link: 'https://doi.org/10.1148/radiol.251923', cats: ['y90', 'hcc'] },
    { pmid: '41765078', year: '2026', journal: 'Journal of Vascular and Interventional Radiology', type: 'Original Research', title: 'Initial Experience with Robotic-Assisted CT-Guided Ablation: Analysis from a Single Center’s Learning Curve in the First 54 Patients', authors: '<strong>Berman ZT</strong>, Louie B, Minocha J, et al.', link: 'https://doi.org/10.1016/j.jvir.2026.108681', cats: ['ablation'] },
    { pmid: '40836102', year: '2025', journal: 'Cardiovascular and Interventional Radiology', type: 'Original Research', title: 'Comparison of Dosimetry Models and Dose Thresholds for Predicting Pathologic Response to Yttrium-90 Radioembolization with Glass Microspheres', authors: 'Pianka KT, Barahman M, Minocha J, et al., <strong>Berman ZT</strong>', link: 'https://doi.org/10.1007/s00270-025-04161-0', cats: ['y90'] },
  ];

  var root = document.getElementById('zb-publications-root');
  if (!root) return;
  root.id = 'zb-publications';
  root.innerHTML =
    '<div class="zbpub-filters" role="group" aria-label="Filter publications by topic"></div>' +
    '<div class="zbpub-list" aria-live="polite"></div>' +
    '<div class="zbpub-footer">' +
      '<a class="zbpub-viewall" href="#" target="_blank" rel="noopener">View all publications on PubMed &rarr;</a>' +
      '<span class="zbpub-status"></span>' +
    '</div>';

  var filtersEl = root.querySelector('.zbpub-filters');
  var listEl = root.querySelector('.zbpub-list');
  var statusEl = root.querySelector('.zbpub-status');
  var viewAllEl = root.querySelector('.zbpub-viewall');
  if (viewAllEl) {
    viewAllEl.href = 'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(AUTHOR_QUERY) + '&sort=pubdate';
  }

  var state = { activeFilter: 'all', pubs: null };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function deriveType(pubtypes) {
    for (var i = 0; i < TYPE_PRIORITY.length; i++) {
      if (pubtypes.indexOf(TYPE_PRIORITY[i].match) !== -1) return TYPE_PRIORITY[i].label;
    }
    return 'Original Research';
  }

  function deriveCats(title, pubtypes) {
    var cats = CAT_RULES.filter(function (r) { return r.re.test(title); }).map(function (r) { return r.key; });
    if (pubtypes.indexOf('Review') !== -1 || /review/i.test(title)) cats.push('review');
    return cats;
  }

  function formatAuthors(names) {
    var joined = names.map(escapeHtml).join(', ');
    return joined.replace(/Berman ZT/g, '<strong>Berman ZT</strong>');
  }

  function parseRecord(rec) {
    var yearMatch = /(\d{4})/.exec(rec.pubdate || rec.sortpubdate || '');
    var year = yearMatch ? yearMatch[1] : '';
    var journal = rec.fulljournalname || rec.source || '';
    var title = (rec.title || '').replace(/\.$/, '');
    var authorNames = (rec.authors || []).map(function (a) { return a.name; });
    var doi = (rec.articleids || []).filter(function (a) { return a.idtype === 'doi'; })[0];
    var link = doi ? 'https://doi.org/' + doi.value : 'https://pubmed.ncbi.nlm.nih.gov/' + rec.uid + '/';
    var pubtypes = rec.pubtype || [];
    return {
      pmid: rec.uid,
      year: year,
      journal: journal,
      title: title,
      authors: formatAuthors(authorNames),
      link: link,
      type: deriveType(pubtypes),
      cats: deriveCats(title, pubtypes),
    };
  }

  function fetchPubmedPublications() {
    var searchUrl = EUTILS + '/esearch.fcgi?db=pubmed&term=' + encodeURIComponent(AUTHOR_QUERY) +
      '&retmode=json&retmax=200&sort=pub_date&tool=' + TOOL + '&email=' + encodeURIComponent(EMAIL);

    return fetch(searchUrl).then(function (res) {
      if (!res.ok) throw new Error('esearch failed');
      return res.json();
    }).then(function (searchJson) {
      var ids = (searchJson.esearchresult && searchJson.esearchresult.idlist) || [];
      if (!ids.length) return [];
      var summaryUrl = EUTILS + '/esummary.fcgi?db=pubmed&id=' + ids.join(',') +
        '&retmode=json&tool=' + TOOL + '&email=' + encodeURIComponent(EMAIL);
      return fetch(summaryUrl).then(function (res) {
        if (!res.ok) throw new Error('esummary failed');
        return res.json();
      }).then(function (summaryJson) {
        var result = summaryJson.result || {};
        return ids.map(function (id) { return result[id]; })
          .filter(Boolean)
          .map(parseRecord)
          .sort(function (a, b) { return (b.year || '0') - (a.year || '0'); });
      });
    });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(pubs) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ pubs: pubs, savedAt: Date.now() }));
    } catch (e) { /* storage unavailable, safe to skip */ }
  }

  function renderFilters() {
    filtersEl.innerHTML = '';
    FILTERS.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zbpub-chip';
      btn.textContent = f.label;
      btn.setAttribute('aria-pressed', String(state.activeFilter === f.key));
      btn.addEventListener('click', function () {
        state.activeFilter = f.key;
        renderFilters();
        renderList();
      });
      filtersEl.appendChild(btn);
    });
  }

  function renderList() {
    if (!state.pubs) {
      listEl.innerHTML = '<div class="zbpub-skel"></div><div class="zbpub-skel"></div><div class="zbpub-skel"></div>';
      return;
    }
    var filtered = state.activeFilter === 'all'
      ? state.pubs
      : state.pubs.filter(function (p) { return p.cats.indexOf(state.activeFilter) !== -1; });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="zbpub-empty">No publications found in this category yet.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(function (pub) {
      return '' +
        '<div class="zbpub-card">' +
          '<div class="zbpub-meta">' +
            '<span class="zbpub-year">' + escapeHtml(pub.year) + '</span>' +
            '<span>&middot;</span>' +
            '<span>' + escapeHtml(pub.journal) + '</span>' +
            '<span class="zbpub-type">' + escapeHtml(pub.type) + '</span>' +
          '</div>' +
          '<div class="zbpub-title">' + escapeHtml(pub.title) + '</div>' +
          '<div class="zbpub-authors">' + pub.authors + '</div>' +
          '<a class="zbpub-link" href="' + escapeHtml(pub.link) + '" target="_blank" rel="noopener">View Article &rarr;</a>' +
        '</div>';
    }).join('');
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  renderFilters();
  renderList();

  var cached = readCache();
  if (cached && cached.pubs && cached.pubs.length) {
    state.pubs = cached.pubs;
    renderList();
    setStatus('Refreshing from PubMed...');
  }

  fetchPubmedPublications().then(function (pubs) {
    if (pubs.length) {
      state.pubs = pubs;
      writeCache(pubs);
      renderList();
      setStatus('');
    } else if (!state.pubs) {
      state.pubs = FALLBACK_PUBLICATIONS;
      renderList();
      setStatus('Showing a recent snapshot - see PubMed for the complete list.');
    }
  }).catch(function () {
    if (!state.pubs) {
      state.pubs = FALLBACK_PUBLICATIONS;
      renderList();
    }
    setStatus('Could not reach PubMed just now - showing the last available list.');
  });
})();
