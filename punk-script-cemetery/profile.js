// ─── RudVentur Social — Profile Logic ───

(function() {
  const params = new URLSearchParams(window.location.search);
  const viewUID = params.get('uid');
  const entityType = params.get('type') || 'human';
  const isViewMode = !!viewUID;
  const myUID = isViewMode ? viewUID : getOrCreateUID();

  const typeInfo = ENTITY_TYPES[entityType] || ENTITY_TYPES.human;

  // ─── Set header ───
  document.getElementById('profile-type-icon').textContent = typeInfo.icon;
  document.getElementById('profile-type-label').textContent = typeInfo.label;

  // ─── Emoji picker ───
  const EMOJIS = ['😀','😎','🤠','🥳','👻','🤖','🧠','🐾','👑','🏢','🔥','⚡','💀','🌈','🎮','🎵','🚀','🌙','🍕','💎','🦊','🐱','🐶','🦁','🐸','🌻','🍄','🎯','🧩','✨','🪦'];

  const emojiGrid = document.getElementById('emoji-grid');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarUrlInput = document.getElementById('avatar-url');
  const emojiTab = document.getElementById('tab-emoji');
  const urlTab = document.getElementById('tab-url');
  const emojiPanel = document.getElementById('emoji-panel');
  const urlPanel = document.getElementById('url-panel');

  let selectedEmoji = entityType === 'cemetery' ? '🪦' : '😀';
  let avatarMode = 'emoji';

  // Set initial preview for cemetery
  if (entityType === 'cemetery') {
    avatarPreview.textContent = '🪦';
  }

  EMOJIS.forEach(function(em) {
    const el = document.createElement('span');
    el.className = 'emoji-option';
    el.textContent = em;
    el.onclick = function() {
      selectedEmoji = em;
      avatarPreview.textContent = em;
      emojiGrid.querySelectorAll('.emoji-option').forEach(function(e) { e.classList.remove('selected'); });
      el.classList.add('selected');
    };
    emojiGrid.appendChild(el);
  });

  emojiTab.onclick = function() {
    avatarMode = 'emoji';
    emojiTab.classList.add('active');
    urlTab.classList.remove('active');
    emojiPanel.style.display = 'block';
    urlPanel.style.display = 'none';
    avatarPreview.textContent = selectedEmoji;
    avatarPreview.querySelector('img') && avatarPreview.querySelector('img').remove();
  };

  urlTab.onclick = function() {
    avatarMode = 'url';
    urlTab.classList.add('active');
    emojiTab.classList.remove('active');
    emojiPanel.style.display = 'none';
    urlPanel.style.display = 'block';
    updateAvatarFromUrl();
  };

  avatarUrlInput.addEventListener('input', updateAvatarFromUrl);

  function updateAvatarFromUrl() {
    const url = avatarUrlInput.value.trim();
    if (url) {
      avatarPreview.textContent = '';
      let img = avatarPreview.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        avatarPreview.appendChild(img);
      }
      img.src = url;
      img.onerror = function() { avatarPreview.textContent = '❌'; img.remove(); };
    } else {
      avatarPreview.textContent = selectedEmoji;
      const img = avatarPreview.querySelector('img');
      if (img) img.remove();
    }
  }

  // ─── Type-specific fields ───
  const typeFieldsDef = {
    human: [
      { id: 'location', label: 'Location', placeholder: 'optional' },
      { id: 'pronouns', label: 'Pronouns', placeholder: 'optional' },
      { id: 'links', label: 'Links', placeholder: 'your links, comma separated' }
    ],
    bot: [
      { id: 'purpose', label: 'What it does', placeholder: 'what does this bot do?' },
      { id: 'creator', label: 'Who made it', placeholder: 'creator name or handle' },
      { id: 'commands', label: 'Commands', placeholder: 'commands it responds to' }
    ],
    ai: [
      { id: 'model', label: 'Model / Version', placeholder: 'optional — e.g. GPT-4, Claude, etc.' },
      { id: 'capabilities', label: 'Capabilities', placeholder: 'what can this AI do?' },
      { id: 'operator', label: 'Who runs it', placeholder: 'who operates this AI?' }
    ],
    pet: [
      { id: 'species', label: 'Species', placeholder: 'cat, dog, parrot, dragon...' },
      { id: 'breed', label: 'Breed', placeholder: 'optional' },
      { id: 'owner', label: 'Owner link', placeholder: 'profile link or name' },
      { id: 'snout_first', label: 'Snout First profile', placeholder: 'link to Snout First profile' }
    ],
    kingdom: [
      { id: 'members_count', label: 'Members', placeholder: 'how many?' },
      { id: 'purpose', label: 'Purpose', placeholder: 'what is this kingdom for?' },
      { id: 'invite_link', label: 'Invite link', placeholder: 'link to join' }
    ],
    directory: [
      { id: 'lists', label: 'What it lists', placeholder: 'what does this directory contain?' },
      { id: 'how_to_join', label: 'How to get listed', placeholder: 'how can someone get added?' }
    ],
    cemetery: [
      { id: 'birth_date', label: 'Birth date', placeholder: 'YYYY-MM-DD or year' },
      { id: 'death_date', label: 'Death date', placeholder: 'YYYY-MM-DD or year (or “still living”)' },
      { id: 'year_of_rest', label: 'Year of eternal rest', placeholder: 'since when? (if different)' },
      { id: 'location', label: 'Cemetery name & location', placeholder: 'where do you rest?' },
      { id: 'epitaph', label: 'Epitaph', placeholder: 'what does your stone say?' },
      { id: 'famous_neighbours', label: 'Famous neighbours', placeholder: 'who else is there?' },
      { id: 'unfinished_business', label: 'Unfinished business', placeholder: 'what still needs doing?' }
    ]
  };

  const typeFieldsContainer = document.getElementById('type-fields');
  const fields = typeFieldsDef[entityType] || [];
  if (fields.length > 0) {
    document.getElementById('type-fields-section').style.display = 'block';
    document.getElementById('type-fields-title').textContent = typeInfo.label + ' details';
    fields.forEach(function(f) {
      const div = document.createElement('div');
      div.className = 'field';
      div.innerHTML =
        '<label for="field-' + f.id + '">' + f.label + '</label>' +
        '<input type="text" id="field-' + f.id + '" placeholder="' + f.placeholder + '">';
      typeFieldsContainer.appendChild(div);
    });
  }

  // ─── Universe links ───
  const universeContainer = document.getElementById('universe-links');
  const links = getUniverseLinks(entityType);
  links.forEach(function(link) {
    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.className = 'universe-link';
    a.innerHTML = '<span>' + link.icon + '</span> ' + link.name;
    universeContainer.appendChild(a);
  });

  // ─── Collect form data ───
  function collectData() {
    const data = {
      type: entityType,
      name: document.getElementById('name').value.trim(),
      bio: document.getElementById('bio').value.trim(),
      avatarMode: avatarMode,
      avatarEmoji: selectedEmoji,
      avatarUrl: avatarUrlInput.value.trim(),
      created: Date.now()
    };
    fields.forEach(function(f) {
      data[f.id] = document.getElementById('field-' + f.id).value.trim();
    });
    return data;
  }

  // ─── Populate form from data ───
  function populateForm(data) {
    if (!data) return;
    document.getElementById('name').value = data.name || '';
    document.getElementById('bio').value = data.bio || '';

    if (data.avatarMode === 'url' && data.avatarUrl) {
      urlTab.click();
      avatarUrlInput.value = data.avatarUrl;
      updateAvatarFromUrl();
    } else {
      selectedEmoji = data.avatarEmoji || (entityType === 'cemetery' ? '🪦' : '😀');
      avatarPreview.textContent = selectedEmoji;
      emojiGrid.querySelectorAll('.emoji-option').forEach(function(e) {
        e.classList.toggle('selected', e.textContent === selectedEmoji);
      });
    }

    fields.forEach(function(f) {
      const el = document.getElementById('field-' + f.id);
      if (el && data[f.id]) el.value = data[f.id];
    });
  }

  // ─── Render view mode ───
  function renderViewMode(data) {
    if (!data) {
      document.getElementById('profile-form').innerHTML = '<div class="empty-state">profile not found.</div>';
      return;
    }

    const avatar = data.avatarMode === 'url' && data.avatarUrl
      ? '<img src="' + data.avatarUrl + '" onerror="this.parentNode.textContent=\'❌\';this.remove()">'
      : (data.avatarEmoji || '😀');

    const typeI = ENTITY_TYPES[data.type] || ENTITY_TYPES.human;
    const badgeClass = data.type === 'cemetery' ? ' cemetery-badge' : '';

    let html = '<div style="text-align:center;margin-bottom:1.5rem">' +
      '<div class="avatar-preview" style="margin:0 auto 0.8rem;width:96px;height:96px;font-size:3rem">' + avatar + '</div>' +
      '<h2 style="font-family:var(--font-display);font-size:1.8rem">' + escapeHtml(data.name || 'unnamed') + '</h2>' +
      '<div class="type-badge large' + badgeClass + '">' + typeI.icon + ' ' + typeI.label + '</div>' +
      '</div>';

    if (data.bio) {
      html += '<div class="form-section"><div class="view-field"><div class="view-label">Bio</div><div class="view-value">' + escapeHtml(data.bio) + '</div></div></div>';
    }

    // Type-specific fields
    const typeF = typeFieldsDef[data.type] || [];
    const hasTypeData = typeF.some(function(f) { return data[f.id]; });
    if (hasTypeData) {
      html += '<div class="form-section' + (data.type === 'cemetery' ? ' cemetery-fields' : '') + '"><h3>' + typeI.label + ' details</h3>';
      typeF.forEach(function(f) {
        if (data[f.id]) {
          html += '<div class="view-field"><div class="view-label">' + f.label + '</div><div class="view-value">' + escapeHtml(data[f.id]) + '</div></div>';
        }
      });
      html += '</div>';
    }

    document.getElementById('profile-form').innerHTML = html;
    document.getElementById('save-btn').style.display = 'none';
    document.getElementById('share-section').style.display = 'none';

    // Update universe links for view mode
    universeContainer.innerHTML = '';
    const viewLinks = getUniverseLinks(data.type);
    viewLinks.forEach(function(link) {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.className = 'universe-link';
      a.innerHTML = '<span>' + link.icon + '</span> ' + link.name;
      universeContainer.appendChild(a);
    });

    // Update header
    document.getElementById('profile-type-icon').textContent = typeI.icon;
    document.getElementById('profile-type-label').textContent = typeI.label;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Save ───
  document.getElementById('save-btn').onclick = function() {
    const data = collectData();
    if (!data.name) {
      showToast('give yourself a name at least');
      return;
    }
    saveProfile(myUID, data).then(function() {
      cacheProfile(myUID, data);
      showToast(entityType === 'cemetery' ? 'memorial saved. rest in peace.' : "that's you. saved.");
      document.getElementById('share-section').style.display = 'block';
      updateShareLink();
    }).catch(function() {
      // Save to cache anyway for offline
      cacheProfile(myUID, data);
      showToast('saved locally — firebase offline');
    });
  };

  // ─── Share link ───
  function updateShareLink() {
    const base = window.location.href.split('?')[0];
    const link = base + '?uid=' + myUID;
    document.getElementById('share-link').textContent = link;
    document.getElementById('share-link').onclick = function() {
      navigator.clipboard.writeText(link).then(function() {
        showToast('link copied!');
      }).catch(function() {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showToast('link copied!');
      });
    };
  }

  // ─── Init ───
  if (isViewMode) {
    // View someone else's profile
    loadProfile(viewUID).then(function(data) {
      if (data) {
        cacheProfile(viewUID, data);
        renderViewMode(data);
      } else {
        // Try cache
        const cached = getCachedProfile(viewUID);
        renderViewMode(cached);
      }
    }).catch(function() {
      const cached = getCachedProfile(viewUID);
      renderViewMode(cached);
    });
  } else {
    // Edit own profile — load existing data
    loadProfile(myUID).then(function(data) {
      if (data) {
        cacheProfile(myUID, data);
        populateForm(data);
        document.getElementById('share-section').style.display = 'block';
        updateShareLink();
      }
    }).catch(function() {
      const cached = getCachedProfile(myUID);
      if (cached) populateForm(cached);
    });
  }

})();
