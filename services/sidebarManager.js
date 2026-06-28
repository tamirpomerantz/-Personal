const feather = require('feather-icons');

class SidebarManager {
    constructor(settingsService, onSearchSelect) {
        this.settingsService = settingsService;
        this.onSearchSelect = onSearchSelect;
        this.recentSearchesEl = document.getElementById('recentSearches');
        this.topTagsEl = document.getElementById('topTags');
        this.maxRecent = 10;
        this.maxTopTags = 20;
        this.topTags = [];
        this.activeQuery = '';
    }

    getRecentSearches() {
        return this.settingsService.getSearchSettings().recentSearches || [];
    }

    addRecentSearch(query) {
        const trimmed = query.trim();
        if (!trimmed) return;

        const recent = this.getRecentSearches().filter((s) => s !== trimmed);
        recent.unshift(trimmed);
        this.settingsService.setSearchSettings({
            recentSearches: recent.slice(0, this.maxRecent)
        });
        this.renderRecentSearches();
    }

    setActiveQuery(query) {
        this.activeQuery = query.trim().toLowerCase();
        this.updateActiveStates();
    }

    updateActiveStates() {
        document.querySelectorAll('.sidebar-item').forEach((item) => {
            const query = (item.dataset.query || '').toLowerCase();
            item.classList.toggle('sidebar-item--active', query === this.activeQuery && this.activeQuery !== '');
        });
    }

    computeTopTags(images) {
        const counts = new Map();

        images.forEach((image) => {
            (image.tags || []).forEach((tag) => {
                const normalized = tag.trim().toLowerCase();
                if (!normalized) return;

                if (!counts.has(normalized)) {
                    counts.set(normalized, { tag: tag.trim(), count: 0 });
                }
                counts.get(normalized).count++;
            });
        });

        return Array.from(counts.values())
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
            .slice(0, this.maxTopTags);
    }

    updateTopTags(images) {
        this.topTags = this.computeTopTags(images);
        this.renderTopTags();
    }

    render() {
        this.renderRecentSearches();
        this.renderTopTags();
    }

    createSidebarItem({ label, icon, count, onClick }) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sidebar-item';
        item.dataset.query = label;

        const iconEl = document.createElement('span');
        iconEl.className = 'sidebar-item__icon';
        iconEl.innerHTML = feather.icons[icon].toSvg({ width: 16, height: 16 });

        const labelEl = document.createElement('span');
        labelEl.className = 'sidebar-item__label';
        labelEl.textContent = label;

        item.appendChild(iconEl);
        item.appendChild(labelEl);

        if (count !== undefined) {
            const countEl = document.createElement('span');
            countEl.className = 'sidebar-item__count';
            countEl.textContent = count;
            item.appendChild(countEl);
        }

        item.addEventListener('click', onClick);
        return item;
    }

    renderRecentSearches() {
        const recent = this.getRecentSearches();
        this.recentSearchesEl.innerHTML = '';

        if (recent.length === 0) {
            this.recentSearchesEl.innerHTML = '<div class="sidebar-empty">None</div>';
            return;
        }

        recent.forEach((query) => {
            const item = this.createSidebarItem({
                label: query,
                icon: 'search',
                onClick: () => this.onSearchSelect(query)
            });
            this.recentSearchesEl.appendChild(item);
        });

        this.updateActiveStates();
    }

    renderTopTags() {
        this.topTagsEl.innerHTML = '';

        if (this.topTags.length === 0) {
            this.topTagsEl.innerHTML = '<div class="sidebar-empty">None</div>';
            return;
        }

        this.topTags.forEach(({ tag, count }) => {
            const item = this.createSidebarItem({
                label: tag,
                icon: 'tag',
                count,
                onClick: () => this.onSearchSelect(tag)
            });
            this.topTagsEl.appendChild(item);
        });

        this.updateActiveStates();
    }
}

module.exports = SidebarManager;
