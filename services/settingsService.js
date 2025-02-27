class SettingsService {
    constructor(dataService) {
        if (!dataService) {
            throw new Error('DataService is required for SettingsService initialization');
        }
        this.dataService = dataService;
        this.initializeDefaults();
    }

    initializeDefaults() {
        if (!this.dataService || typeof this.dataService.getSettings !== 'function') {
            throw new Error('DataService is not properly initialized');
        }

        const settings = this.dataService.getSettings();
        const defaults = {
            ai: {
                model: 'openai',
                apiKey: '',
                autoTag: false
            },
            images: {
                personalPath: '',
                sortBy: 'dateAdded', // 'dateAdded', 'name', 'size'
                sortDirection: 'desc', // 'asc', 'desc'
                thumbnailSize: 'medium' // 'small', 'medium', 'large'
            },
            search: {
                imagesPerPage: 12,
                defaultSearchType: 'all' // 'all', 'ocr', 'tags', 'title'
            }
        };

        // Initialize with defaults if not set
        if (!settings || !settings.ai || !settings.images || !settings.search) {
            this.dataService.updateSettings(defaults);
        }
    }

    // AI Settings
    getAISettings() {
        const settings = this.dataService.getSettings();
        return settings?.ai || {
            model: 'openai',
            apiKey: '',
            autoTag: false
        };
    }

    setAISettings(settings) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.ai) currentSettings.ai = {};
        currentSettings.ai = {
            ...currentSettings.ai,
            ...settings
        };
        this.dataService.updateSettings(currentSettings);
    }

    // Image Settings
    getImageSettings() {
        const settings = this.dataService.getSettings();
        return settings?.images || {
            personalPath: '',
            sortBy: 'dateAdded',
            sortDirection: 'desc',
            thumbnailSize: 'medium'
        };
    }

    setImageSettings(settings) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.images) currentSettings.images = {};
        currentSettings.images = {
            ...currentSettings.images,
            ...settings
        };
        this.dataService.updateSettings(currentSettings);
    }


    // Search Settings
    getSearchSettings() {
        const settings = this.dataService.getSettings();
        return settings?.search || {
            imagesPerPage: 12,
            defaultSearchType: 'all'
        };
    }

    setSearchSettings(settings) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.search) currentSettings.search = {};
        currentSettings.search = {
            ...currentSettings.search,
            ...settings
        };
        this.dataService.updateSettings(currentSettings);
    }

    // Individual Settings
    setPersonalPath(path) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.images) currentSettings.images = {};
        currentSettings.images.personalPath = path;
        this.dataService.updateSettings(currentSettings);
    }

    getPersonalPath() {
        return this.getImageSettings().personalPath;
    }

    setAIModel(model) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.ai) currentSettings.ai = {};
        currentSettings.ai.model = model;
        this.dataService.updateSettings(currentSettings);
    }

    getAIModel() {
        return this.getAISettings().model;
    }

    setAPIKey(apiKey) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.ai) currentSettings.ai = {};
        currentSettings.ai.apiKey = apiKey;
        this.dataService.updateSettings(currentSettings);
    }

    getAPIKey() {
        return this.getAISettings().apiKey;
    }

    setAutoTag(autoTag) {
        const currentSettings = this.dataService.getSettings() || {};
        if (!currentSettings.ai) currentSettings.ai = {};
        currentSettings.ai.autoTag = autoTag;
        this.dataService.updateSettings(currentSettings);
    }

    getAutoTag() {
        return this.getAISettings().autoTag;
    }

    // Reset Settings
    resetToDefaults() {
        this.initializeDefaults();
    }

    // Export/Import Settings
    exportSettings() {
        return this.dataService.getSettings();
    }

    importSettings(settings) {
        this.dataService.updateSettings(settings);
    }
}

module.exports = SettingsService; 