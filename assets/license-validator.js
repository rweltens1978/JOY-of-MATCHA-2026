/* 
 * Shopify Theme License System with Suspend/Revoke Support
 * Insert this code into your theme's main JavaScript file or assets/theme.js
 */

class ShopifyLicenseValidator {
    constructor(options = {}) {
        this.licenseServer = options.licenseServer || window.THEME_LICENSE_CONFIG?.serverUrl || 'https://base.surgetheme.com';
        this.licenseKey = null;
        this.storeUrl = null; // Manual store URL from settings
        this.isValid = false;
        this.licenseStatus = 'unknown'; // active, suspended, revoked
        this.domain = null; // Will be set from manual store URL
        this.checkInterval = options.checkInterval || 24 * 60 * 60 * 1000; // 24 hours
        this.retryAttempts = options.retryAttempts || 3;
        this.cacheDuration = options.cacheDuration || 7 * 24 * 60 * 60 * 1000; // 7 days fallback cache
        
        // Flags for immediate status handling
        this.hasImmediateStatus = false;
        this.immediateStatusApplied = false;
        
        //  DEBUG MODE - Set window.THEME_LICENSE_DEBUG = true to enable detailed logs
        this.debugMode = options.debugMode || window.THEME_LICENSE_DEBUG || false;
        
        // Bind methods to maintain proper 'this' context
        this.boundLicenseClickHandler = this.licenseClickHandler.bind(this);
        
        this.init();
    }
    
    // Silent logging - no console output in production
    log(message, data = null) {
        // Completely silent in production
        return;
    }
    
    // Silent error logging
    logError(message) {
        // Completely silent in production
        return;
    }

    init() {
        this.log(' Initializing...');
        
        // Get license key and store URL from theme settings
        this.licenseKey = this.getLicenseFromSettings();
        this.storeUrl = this.getStoreUrlFromSettings();
        
        // Validate and extract domain from store URL
        if (this.storeUrl) {
            // Validate store URL format first
            if (!this.validateStoreUrl(this.storeUrl)) {
                this.storeUrl = null;
                this.domain = null;
            } else {
                this.domain = this.extractDomainFromUrl(this.storeUrl);
                this.log('Domain extracted');
            }
        }
        
        this.log('Init status check');
        
        // Set up DOM observer for dynamic content
        this.setupDOMObserver();
        
        if (this.licenseKey && this.storeUrl) {
            this.log(' Both license key and store URL found - starting validation process');
            
            // Check for cached valid license FIRST (7-day grace period)
            const cachedData = this.getCachedValidation();
            if (cachedData && cachedData.isValid && cachedData.status === 'active') {
                const cacheAge = Date.now() - cachedData.timestamp;
                const gracePeriod = this.cacheDuration; // 7 days
                
                if (cacheAge < gracePeriod) {
                    this.log('Using cached valid license on page load');
                    this.isValid = true;
                    this.licenseStatus = 'active';
                    this.removeLicenseRestrictions();
                    
                    // Validate in background without blocking
                    setTimeout(() => {
                        this.validateLicense(0); // Background validation
                    }, 2000);
                    
                    this.startPeriodicCheck();
                    return; // Skip immediate validation
                }
            }
            
            // Check for cached license status BEFORE validation
            const cachedStatus = localStorage.getItem('licenseStatus');
            const cachedIsValid = localStorage.getItem('isLicenseValid');
            this.log(' Cached license status check:', {
                status: cachedStatus,
                isValid: cachedIsValid
            });
            
            // CRITICAL FIX: Apply cached invalid status immediately for consistency
            if (cachedStatus === 'invalid' && cachedIsValid === 'false') {
                this.log(' Applying cached invalid status for consistency');
                this.licenseStatus = 'invalid';
                this.isValid = false;
                this.applyLicenseRestrictions();
                
                // Set flags to prevent validation overwrite initially
                this.hasImmediateStatus = true;
                this.immediateStatusApplied = true;
                
                this.log(' Invalid status applied - will validate in background');
                // Continue with validation process to check if status changed
            }
            
            // Apply cached restrictions immediately if suspended/revoked
            else if ((cachedStatus === 'suspended' || cachedStatus === 'revoked') && cachedIsValid === 'false') {
                this.log(' Applying cached restrictions for status:', cachedStatus);
                this.licenseStatus = cachedStatus;
                this.isValid = false;
                this.applyLicenseRestrictions();
                
                // Set flags to prevent validation overwrite
                this.hasImmediateStatus = true;
                this.immediateStatusApplied = true;
                
                // Skip validation for suspended/revoked status to prevent overwrite
                this.log(' Skipping validation due to cached suspended/revoked status');
                return;
            } else if (cachedStatus === 'active' && cachedIsValid === 'true') {
                this.log(' Cached active status found - will validate in background');
                this.licenseStatus = 'active';
                this.isValid = true;
                this.removeLicenseRestrictions();
            }
            
            // Check if this is a theme settings save
            this.checkThemeSettingsSave();
            
            // Only start periodic check if license is already validated
            if (this.isValid) {
                this.startPeriodicCheck();
            }
        } else {
            this.log(' Missing required fields - license key or store URL not provided');
            
            // Save license state for next page load
            localStorage.setItem('lastLicenseState', 'invalid');
            
            this.handleInvalidLicense('License key and store URL are required');
            return;
        }
        
        // Set up DOM observer for dynamic content
        this.setupDOMObserver();
        
        // Only start periodic check if license is already validated
        if (this.isValid) {
            this.startPeriodicCheck();
        }
    }

    checkThemeSettingsSave() {
        // CRITICAL: Skip validation if immediate status was applied
        if (this.hasImmediateStatus && this.immediateStatusApplied) {
            this.log(' Skipping theme settings validation - immediate status already applied');
            
            // SPECIAL CASE: Allow validation for invalid status to check if license was fixed
            if (this.licenseStatus !== 'invalid') {
                return;
            } else {
                this.log(' Invalid status detected - allowing validation to check if license was fixed');
                // Continue with validation to see if license is now valid
                this.hasImmediateStatus = false;
                this.immediateStatusApplied = false;
            }
        }
        
        // Check if this is from a manual theme settings save
        const manualSave = sessionStorage.getItem('manualSaveTriggered');
        const isThemeSettingsPage = window.location.href.includes('/admin/themes/') || 
                                   window.location.href.includes('/customize') ||
                                   window.location.href.includes('/editor') ||
                                   window.location.href.includes('admin.shopify.com') ||
                                   document.body.classList.contains('theme-settings');
        
        this.log(' Theme Settings Save Check:', {
            manualSave: !!manualSave,
            isSettingsPage: isThemeSettingsPage,
            hasFields: !!(this.licenseKey && this.storeUrl),
            currentUrl: window.location.href,
            isThemeEditor: window.location.href.includes('admin.shopify.com')
        });
        
        // AUTO-DETECT: If both fields are present and we're not in admin, validate immediately
        if (this.licenseKey && this.storeUrl && !isThemeSettingsPage) {
            // Skip client-side domain matching - let server validate custom domains
            this.log(' License fields present - proceeding with server validation');
            
            // Check if license was previously validated
            const lastState = localStorage.getItem('lastLicenseState');
            
            if (lastState === 'active') {
                this.log(' Background validation for previously active license');
                this.validateLicense();
                this.startPeriodicCheck();
            } else {
                this.log(' Both fields present on regular page - auto-validating license');
                // Set manual save flag for this session
                sessionStorage.setItem('manualSaveTriggered', 'true');
                this.validateLicense();
                this.startPeriodicCheck();
            }
            return;
        }
        
        // MANUAL MODE: Only validate if manual save was triggered or fields just became available
        if (manualSave && this.licenseKey && this.storeUrl) {
            this.log(' Manual theme settings save detected - starting validation');
            
            // Skip client-side domain matching - let server validate custom domains
            this.log(' Manual save - proceeding with server validation');
            
            this.log('License data ready');
            
            // Clear the manual save flag
            sessionStorage.removeItem('manualSaveTriggered');
            
            // Start validation for manual domain capture
            this.validateLicense();
            
            // Start periodic checking after successful manual validation
            this.startPeriodicCheck();
            
        } else if (this.licenseKey && this.storeUrl) {
            // Check if license was previously validated
            const lastState = localStorage.getItem('lastLicenseState');
            
            if (lastState === 'active') {
                this.log(' Background validation for previously active license');
                this.validateLicense();
                this.startPeriodicCheck();
            } else if (isThemeSettingsPage) {
                this.log(' Theme editor detected - providing manual activation option');
                this.showThemeEditorHelper();
            } else {
                this.log(' License fields present but no manual save detected - applying restrictions');
                this.log(' User needs to save theme settings to activate license');
                
                // Apply restrictions until manual save is done
                this.handleInvalidLicense('Please save theme settings to activate license');
            }
        } else {
            this.log(' Missing required fields - license key or store URL not provided');
            this.handleInvalidLicense('License key and store URL are required');
        }
    }

    showThemeEditorHelper() {
        // Show helper for theme editor environment
        this.log(' Theme Editor Helper - providing manual activation');
        
        const helper = document.createElement('div');
        helper.id = 'license-editor-helper';
        helper.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #007cba;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 350px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        helper.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong> Theme Editor Detected</strong>
            </div>
            <div style="margin-bottom: 15px;">
                License fields detected but not activated yet.
            </div>
            <div style="margin-bottom: 15px;">
                <button onclick="window.licenseValidator.manualActivate()" 
                        style="background: white; color: #007cba; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                     Activate License Now
                </button>
            </div>
            <div style="margin-bottom: 10px;">
                <small>Or add license fields to theme settings and save to activate automatically.</small>
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <button onclick="document.getElementById('license-editor-helper').remove()" 
                        style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(helper);
        
        // Auto-remove after 20 seconds
        setTimeout(() => {
            if (document.getElementById('license-editor-helper')) {
                helper.remove();
            }
        }, 20000);
    }

    manualActivate() {
        this.log(' Manual license activation triggered');
        
        // Set manual save flag
        sessionStorage.setItem('manualSaveTriggered', 'true');
        
        // Remove helper
        const helper = document.getElementById('license-editor-helper');
        if (helper) helper.remove();
        
        // Trigger validation
        this.validateLicense();
    }

    setupDOMObserver() {
        // Observer for dynamically loaded buttons (with safety checks)
        try {
            // Only set up observer if not already exists
            if (this.domObserver) {
                this.domObserver.disconnect();
            }
            
            let refreshTimeout;
            const observer = new MutationObserver((mutations) => {
                // Throttle refresh to prevent performance issues
                if (refreshTimeout) return;
                
                let shouldRefresh = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                try {
                                    // Check if added node contains purchase buttons
                                    const hasButtons = node.matches && (
                                        node.matches('button[type="submit"][name="add"], .btn-cart, .add-to-cart, .buy-now, .btn-buy-now') ||
                                        node.querySelector('button[type="submit"][name="add"], .btn-cart, .add-to-cart, .buy-now, .btn-buy-now, .shopify-payment-button')
                                    );
                                    
                                    if (hasButtons) {
                                        shouldRefresh = true;
                                    }
                                } catch (e) {
                                    // Silently ignore selector errors
                                }
                            }
                        });
                    }
                });
                
                if (shouldRefresh) {
                    // Throttled refresh with timeout
                    refreshTimeout = setTimeout(() => {
                        try {
                            this.refreshRestrictions();
                        } catch (e) {
                            this.log('DOM refresh error:', e.message);
                        }
                        refreshTimeout = null;
                    }, 200);
                }
            });
            
            // Start observing with limited scope
            observer.observe(document.body, {
                childList: true,
                subtree: false // Reduce scope for better performance
            });
            
            this.domObserver = observer;
            
        } catch (e) {
            this.log('DOM Observer setup failed:', e.message);
            // Continue without observer if it fails
        }
    }

    getLicenseFromSettings() {
        // Priority order: THEME_LICENSE_CONFIG > window.themeLicenseKey > localStorage
        let licenseKey = null;
        
        // Check theme configuration first
        if (window.THEME_LICENSE_CONFIG && window.THEME_LICENSE_CONFIG.licenseKey) {
            licenseKey = window.THEME_LICENSE_CONFIG.licenseKey.trim();
        }
        
        // Fallback to global window variable
        if (!licenseKey && window.themeLicenseKey) {
            licenseKey = window.themeLicenseKey.trim();
        }
        
        // Fallback to localStorage
        if (!licenseKey) {
            const stored = localStorage.getItem('themeLicenseKey');
            if (stored) {
                licenseKey = stored.trim();
            }
        }
        
        // Return null for empty strings or invalid format
        // Valid license key should be at least 10 characters and contain dashes or alphanumeric
        if (!licenseKey || licenseKey.length < 10 || !/^[A-Z0-9\-]+$/i.test(licenseKey)) {
            return null;
        }
        
        return licenseKey;
    }

    getStoreUrlFromSettings() {
        // Get store URL from theme settings
        let storeUrl = null;
        
        // Check theme configuration first
        if (window.THEME_LICENSE_CONFIG && window.THEME_LICENSE_CONFIG.storeUrl) {
            storeUrl = window.THEME_LICENSE_CONFIG.storeUrl.trim();
        }
        
        // Fallback to global window variable
        if (!storeUrl && window.themeStoreUrl) {
            storeUrl = window.themeStoreUrl.trim();
        }
        
        // Fallback to localStorage
        if (!storeUrl) {
            const stored = localStorage.getItem('themeStoreUrl');
            if (stored) {
                storeUrl = stored.trim();
            }
        }
        
        // Return null for empty strings
        if (!storeUrl || storeUrl.length < 5) {
            return null;
        }
        
        return storeUrl;
    }

    validateStoreUrl(url) {
        if (!url) return false;
        
        // Remove protocol and www if present
        const cleanUrl = url.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
        
        // Check if it's a Shopify URL
        const isShopifyUrl = cleanUrl.endsWith('.myshopify.com');
        
        // If it's a Shopify URL, accept it immediately
        if (isShopifyUrl) {
            this.log(' Valid Shopify URL:', cleanUrl);
            return true;
        }
        
        // For custom domains, just check basic domain structure
        const domainParts = cleanUrl.split('.');
        if (domainParts.length < 2) {
            this.log(' Invalid domain format - missing extension:', cleanUrl);
            return false;
        }
        
        // Check if it has a valid domain format (basic check)
        const isValidDomainFormat = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*$/.test(domainParts[0]);
        
        this.log(' Store URL Validation:', {
            url: url,
            cleanUrl: cleanUrl,
            domainParts: domainParts.length,
            isValidFormat: isValidDomainFormat,
            isShopify: isShopifyUrl
        });
        
        if (!isValidDomainFormat) {
            this.log(' Invalid domain format:', cleanUrl);
            return false;
        }
        
        this.log(' Valid URL format:', cleanUrl);
        return true;
    }
    
    cleanUrlForComparison(url) {
        if (!url) return '';
        
        // Convert to lowercase
        let clean = url.toLowerCase();
        
        // Remove protocol (http:// or https://)
        clean = clean.replace(/^https?:\/\//, '');
        
        // Remove www.
        clean = clean.replace(/^www\./, '');
        
        // Remove trailing slash and anything after it
        clean = clean.split('/')[0];
        
        // Remove port number if present
        clean = clean.split(':')[0];
        
        // DO NOT add .myshopify.com for custom domains!
        // Return the clean domain as-is to support both custom domains and Shopify domains
        
        return clean;
    }

    // CRITICAL: Get current store domain safely
    getCurrentStoreDomain() {
        // Try multiple methods to get the current store domain
        let currentDomain = null;
        
        // Method 1: Use Shopify.shop if available (most reliable)
        if (window.Shopify && window.Shopify.shop) {
            currentDomain = window.Shopify.shop;
            this.log(' Store domain from Shopify.shop:', currentDomain);
        }
        // Method 2: Use window.location.hostname
        else if (window.location && window.location.hostname) {
            currentDomain = window.location.hostname;
            this.log(' Store domain from location.hostname:', currentDomain);
        }
        // Method 3: Use document.location.hostname as fallback
        else if (document.location && document.location.hostname) {
            currentDomain = document.location.hostname;
            this.log(' Store domain from document.location:', currentDomain);
        }
        
        if (!currentDomain) {
            this.log(' Could not detect current store domain');
            return null;
        }
        
        // Clean and return the domain
        const cleanDomain = this.extractDomainFromUrl(currentDomain);
        this.log(' Current store domain detected:', cleanDomain);
        return cleanDomain;
    }

    // ENHANCED: Get all possible store domains (original + custom)
    getCurrentStoreDomains() {
        const domains = [];
        
        // Get original Shopify domain (from Shopify.shop)
        if (window.Shopify && window.Shopify.shop) {
            const shopifyDomain = this.extractDomainFromUrl(window.Shopify.shop);
            if (shopifyDomain) {
                domains.push(shopifyDomain);
                this.log(' Original Shopify domain:', shopifyDomain);
            }
        }
        
        // Get current visiting domain (custom domain if exists)
        if (window.location && window.location.hostname) {
            const currentDomain = this.extractDomainFromUrl(window.location.hostname);
            if (currentDomain && !domains.includes(currentDomain)) {
                domains.push(currentDomain);
                this.log(' Current visiting domain:', currentDomain);
            }
        }
        
        // Fallback to document.location.hostname
        if (document.location && document.location.hostname) {
            const docDomain = this.extractDomainFromUrl(document.location.hostname);
            if (docDomain && !domains.includes(docDomain)) {
                domains.push(docDomain);
                this.log(' Document domain:', docDomain);
            }
        }
        
        this.log(' All detected store domains:', domains);
        return domains;
    }

    // CRITICAL: Validate if entered URL matches current store (supports custom domains)
    validateStoreUrlMatch(enteredUrl) {
        if (!enteredUrl) {
            this.log(' No URL provided for validation');
            return false;
        }
        
        // Step 1: Validate URL format
        const isValidFormat = this.validateStoreUrl(enteredUrl);
        if (!isValidFormat) {
            this.log(' Invalid URL format:', enteredUrl);
            return false;
        }
        
        // Step 2: Get current store domains (both original and custom)
        const currentDomains = this.getCurrentStoreDomains();
        if (!currentDomains || currentDomains.length === 0) {
            this.log(' Could not detect current store domains - will rely on server validation');
            // Don't block - let server validate custom domains
            return true;
        }
        
        // Step 3: Extract domain from entered URL
        const enteredDomain = this.extractDomainFromUrl(enteredUrl);
        if (!enteredDomain) {
            this.log(' Could not extract domain from entered URL:', enteredUrl);
            return false;
        }
        
        // Step 4: Check if entered domain matches any current domain
        const domainsMatch = currentDomains.includes(enteredDomain);
        
        this.log(' Domain Match Validation (Custom Domain Support):', {
            enteredUrl: enteredUrl,
            currentDomains: currentDomains,
            enteredDomain: enteredDomain,
            match: domainsMatch
        });
        
        if (!domainsMatch) {
            this.log(' Domain mismatch detected - but allowing for custom domain validation:', {
                currentDomains: currentDomains,
                entered: enteredDomain,
                note: 'Custom domains may not be detected in browser. Server will validate.'
            });
            // IMPORTANT: Don't block! Custom domains won't match browser URL
            // Let the server validate if this custom domain is valid for this store
            return true;
        }
        
        this.log(' Store URL validation passed (direct match):', enteredUrl);
        return true;
    }

    extractDomainFromUrl(url) {
        // First clean the URL
        const clean = this.cleanUrlForComparison(url);
        
        if (!clean) {
            this.log(' Invalid store URL:', url);
            return null;
        }
        
        this.log(' Domain extracted:', clean);
        return clean;
    }

    async validateLicense(retryCount = 0) {
        // CRITICAL: Skip validation if immediate suspended/revoked status was applied
        if (this.hasImmediateStatus && this.immediateStatusApplied && 
            (this.licenseStatus === 'suspended' || this.licenseStatus === 'revoked')) {
            this.log(' Skipping validation - immediate suspended/revoked status should persist');
            return;
        }
        
        // Get actual Shopify store URL
        const actualShopifyUrl = window.Shopify?.shop || 
                               window.location.hostname || 
                               document.location.hostname;
        
        // Get current fields
        const currentLicenseKey = this.getLicenseFromSettings();
        const currentStoreUrl = this.getStoreUrlFromSettings();
        
        if (!currentLicenseKey || !currentStoreUrl) {
            this.log(' Missing fields:', {
                hasLicense: !!currentLicenseKey,
                hasStoreUrl: !!currentStoreUrl
            });
            this.handleInvalidLicense('License key and store URL are required');
            return;
        }

        // Clean up URLs for comparison
        const cleanEnteredUrl = this.cleanUrlForComparison(currentStoreUrl);
        const cleanActualUrl = this.cleanUrlForComparison(actualShopifyUrl);

        this.log(' URL Comparison:', {
            entered: cleanEnteredUrl,
            actual: cleanActualUrl
        });

        // ENHANCED: Bidirectional custom domain support
        // Support BOTH scenarios:
        // 1. Entered is custom, actual is .myshopify.com (accessing via custom domain)
        // 2. Entered is .myshopify.com, actual is custom (accessing via Shopify admin)
        let urlsMatch = false;
        
        if (cleanEnteredUrl === cleanActualUrl) {
            // Direct match
            urlsMatch = true;
            this.log(' Direct URL match');
        } else if (window.Shopify?.shop) {
            // One is custom domain, other is .myshopify.com - both valid for same store
            const enteredIsShopify = cleanEnteredUrl.includes('.myshopify.com');
            const actualIsShopify = cleanActualUrl.includes('.myshopify.com');
            
            if (enteredIsShopify !== actualIsShopify) {
                // One is custom domain, one is .myshopify.com - this is valid
                urlsMatch = true;
                this.log(' Custom domain <-> Shopify domain detected - allowing validation');
            } else if (enteredIsShopify && actualIsShopify) {
                // Both are .myshopify.com - must match exactly
                urlsMatch = (cleanEnteredUrl === cleanActualUrl);
            }
        }

        // Verify URLs match
        if (!urlsMatch) {
            this.log(' Store URL mismatch:', {
                entered: cleanEnteredUrl,
                actual: cleanActualUrl
            });
            this.handleInvalidLicense('The entered store URL does not match this store');
            return;
        }

        // Update instance after validation passes
        this.licenseKey = currentLicenseKey;
        this.storeUrl = currentStoreUrl;
        this.domain = this.extractDomainFromUrl(currentStoreUrl);

        this.log('URL verified, proceeding with validation');

        // CRITICAL FIX: Check if license is cached as suspended/revoked 
        // Skip server validation to preserve status
        const cachedStatus = localStorage.getItem('licenseStatus');
        const cachedValid = localStorage.getItem('isLicenseValid');
        
        if (cachedStatus === 'suspended' || cachedStatus === 'revoked') {
            this.log(' Found cached suspended/revoked status - skipping server validation');
            this.log(' Cached Status:', { status: cachedStatus, valid: cachedValid });
            
            // Apply cached status immediately
            this.licenseStatus = cachedStatus;
            this.isValid = false;
            this.hasImmediateStatus = true;
            this.immediateStatusApplied = true;
            
            this.handleValidationResult({
                success: false,
                license_status: cachedStatus,
                message: cachedStatus === 'suspended' ? 'License is suspended' : 'License is revoked'
            });
            return;
        }
        
        this.log(' No cached restrictions - validating with server for real-time status');

        try {
            this.log('Making license validation request...');
            
            const response = await fetch(`${this.licenseServer}/api/license/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify({
                    license_key: this.licenseKey,
                    domain: this.domain
                })
            });

            if (!response.ok) {
                // CRITICAL FIX: Handle 403 Forbidden as suspended/revoked status
                if (response.status === 403) {
                    this.log(' License access forbidden (403) - treating as suspended');
                    
                    // Check if we have cached status to determine if suspended or revoked
                    const cachedStatus = localStorage.getItem('licenseStatus');
                    const statusToUse = (cachedStatus === 'revoked') ? 'revoked' : 'suspended';
                    
                    this.log(' Using status:', statusToUse);
                    
                    // Handle as suspended/revoked instead of error
                    this.handleValidationResult({
                        success: false,
                        license_status: statusToUse,
                        message: statusToUse === 'suspended' ? 'License is suspended' : 'License is revoked'
                    });
                    return;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.log(' License validation response:', data);
            
            this.handleValidationResult(data);

        } catch (error) {
            this.logError('Validation request failed');
            
            // 🔄 FALLBACK: Check for valid cached license (7 days grace period)
            const cachedData = this.getCachedValidation();
            if (cachedData && cachedData.isValid && cachedData.status === 'active') {
                const cacheAge = Date.now() - cachedData.timestamp;
                const gracePeriod = this.cacheDuration; // 7 days
                
                if (cacheAge < gracePeriod) {
                    this.log('Server offline but using valid cached license (Grace Period)');
                    this.log(`Cache valid for ${Math.floor((gracePeriod - cacheAge) / (24 * 60 * 60 * 1000))} more days`);
                    
                    // Apply cached valid status
                    this.isValid = true;
                    this.licenseStatus = 'active';
                    this.removeLicenseRestrictions();
                    
                    // Show subtle notification about offline mode
                    this.showOfflineModeNotification(Math.floor((gracePeriod - cacheAge) / (24 * 60 * 60 * 1000)));
                    
                    // Retry in background without blocking
                    setTimeout(() => {
                        this.validateLicense(0); // Silent retry
                    }, 60000); // Retry after 1 minute
                    
                    return; // Exit - store remains active
                }
            }
            
            // Retry logic
            if (retryCount < this.retryAttempts) {
                this.log(` Retrying validation... (${retryCount + 1}/${this.retryAttempts})`);
                setTimeout(() => {
                    this.validateLicense(retryCount + 1);
                }, 2000 * (retryCount + 1)); // Exponential backoff
            } else {
                this.logError(' All retry attempts failed');
                
                // SECURITY: Check if license was previously suspended/revoked
                // Don't allow bypassing restrictions by clearing cache when server is down
                const lastKnownStatus = localStorage.getItem('licenseStatus');
                if (lastKnownStatus === 'suspended' || lastKnownStatus === 'revoked') {
                    this.log(' Previous suspended/revoked status found - maintaining restrictions');
                    this.licenseStatus = lastKnownStatus;
                    this.isValid = false;
                    this.applyLicenseRestrictions();
                    return;
                }
                
                // If no cache and no previous bad status, apply restrictions as unknown
                this.handleValidationError();
            }
        }
    }

    handleValidationResult(data) {
        this.log(' Handling validation result:', data);
        
        // CRITICAL: Don't override immediate status if it was applied
        if (this.hasImmediateStatus && this.immediateStatusApplied && 
            (this.licenseStatus === 'suspended' || this.licenseStatus === 'revoked')) {
            this.log(' Validation result ignored - immediate status takes precedence');
            return;
        }
        
        // NEW: Check if response indicates suspended/revoked even with success: false
        if (data.status === 'suspended' || data.status === 'revoked') {
            this.log(' License status detected:', data.status);
            this.licenseStatus = data.status;
            this.isValid = false;
            
            if (data.status === 'suspended') {
                this.log(' License is SUSPENDED (from status field)');
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'suspended');
                
                this.clearValidationCache();
                this.handleSuspendedLicense({
                    suspension_reason: data.error || 'License is suspended',
                    customer_portal_url: 'https://base.surgetheme.com'
                });
                this.dispatchLicenseEvent('licenseSuspended', { status: 'suspended', data: data });
                return;
            } else if (data.status === 'revoked') {
                this.logError(' License is REVOKED (from status field)');
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'revoked');
                
                this.clearValidationCache();
                this.handleRevokedLicense({
                    revocation_reason: data.error || 'License is revoked',
                    customer_portal_url: 'https://base.surgetheme.com'
                });
                this.dispatchLicenseEvent('licenseRevoked', { status: 'revoked', data: data });
                return;
            }
        }
        
        if (data.success) {
            // Check license status even for successful responses
            const licenseStatus = data.license?.status || 'active';
            this.licenseStatus = licenseStatus;
            
            this.log(' License Status Check:', {
                success: data.success,
                status: licenseStatus,
                firstTime: data.first_time_capture || false
            });
            
            // Handle different license statuses
            if (licenseStatus === 'active') {
                this.log(' License is ACTIVE - proceeding normally');
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'active');
                localStorage.setItem('licenseStatus', 'active');
                localStorage.setItem('isLicenseValid', 'true');
                
                // Check if this is manual domain capture vs normal validation
                if (data.manual_domain_capture) {
                    this.log(' Manual domain captured successfully from theme settings');
                    this.log(' Domain registered for license:', this.domain);
                    
                    // Always show success notification when license is entered from customizer
                    this.showManualCaptureSuccess(data);
                } else {
                    this.log(' Regular license validation successful');
                    this.log(' Licensed domain matches:', data.license?.domain || this.domain);
                    
                    // For regular validation (page reload), only show message if license changed
                    const previousLicense = localStorage.getItem('lastActivatedLicense');
                    const currentLicense = this.licenseKey;
                    
                    if (previousLicense !== currentLicense) {
                        this.log(' New license detected - showing activation message');
                        this.showLicenseActivatedSuccess(data);
                        localStorage.setItem('lastActivatedLicense', currentLicense);
                    } else {
                        this.log(' Same license - skipping activation message');
                    }
                }
                
                // Set valid state and remove restrictions
                this.isValid = true;
                this.removeLicenseRestrictions();
                
                // Reset immediate status flags for valid license
                this.hasImmediateStatus = false;
                this.immediateStatusApplied = false;
                
                // CACHE VALID LICENSE for 7-day grace period (server downtime fallback)
                this.cacheValidation(data);
                this.log('Valid license cached for 7-day grace period');
                
                // Dispatch custom event for theme integration
                this.dispatchLicenseEvent('licenseValidated', { valid: true, data: data });
                
                this.log(' License system fully activated - buttons should work normally');
                
            } else if (licenseStatus === 'suspended') {
                this.log(' License is SUSPENDED');
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'suspended');
                
                // Clear last activated license so message shows when re-activated
                localStorage.removeItem('lastActivatedLicense');
                
                // Set invalid state
                this.isValid = false;
                
                // Clear cache for suspended licenses
                this.clearValidationCache();
                
                // Handle suspended license
                this.handleSuspendedLicense(data);
                
                // Dispatch suspended event
                this.dispatchLicenseEvent('licenseSuspended', { status: 'suspended', data: data });
                
            } else if (licenseStatus === 'revoked') {
                this.logError(' License is REVOKED (Permanently Suspended)');
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'revoked');
                
                // Clear last activated license so message shows when re-activated
                localStorage.removeItem('lastActivatedLicense');
                
                // Set invalid state
                this.isValid = false;
                
                // Clear cache for revoked licenses
                this.clearValidationCache();
                
                // Handle revoked license
                this.handleRevokedLicense(data);
                
                // Dispatch revoked event
                this.dispatchLicenseEvent('licenseRevoked', { status: 'revoked', data: data });
                
            } else {
                this.log(' Unknown license status:', licenseStatus);
                
                // Save license state for next page load
                localStorage.setItem('lastLicenseState', 'invalid');
                
                // Clear last activated license
                localStorage.removeItem('lastActivatedLicense');
                
                // Treat unknown status as invalid
                this.isValid = false;
                this.handleInvalidLicense(data);
            }
            
        } else {
            this.log(' License validation failed:', data.error || 'Unknown error');
            
            // Save license state for next page load
            localStorage.setItem('lastLicenseState', 'invalid');
            localStorage.setItem('licenseStatus', 'invalid');
            localStorage.setItem('isLicenseValid', 'false');
            
            // Set invalid state
            this.isValid = false;
            this.licenseStatus = 'invalid';
            
            // Clear any existing cache
            this.clearValidationCache();
            
            // Handle the specific type of failure
            this.handleInvalidLicense(data);
            
            // Dispatch custom event for failed validation
            this.dispatchLicenseEvent('licenseValidated', { valid: false, error: data.error, data: data });
            
            this.log(' License restrictions applied due to validation failure');
        }
        
        // Log final state for debugging
        this.log(' Final license state logged');
    }

    handleSuspendedLicense(data) {
        this.log(' Handling suspended license');
        
        // CRITICAL: Set the license status first
        this.licenseStatus = 'suspended';
        this.isValid = false;
        
        // Save status to localStorage for persistence
        localStorage.setItem('licenseStatus', this.licenseStatus);
        localStorage.setItem('isLicenseValid', this.isValid.toString());
        
        // Apply restrictions
        this.applyLicenseRestrictions();
        
        // Force update the notice with suspended status
        this.showLicenseNotice();
        
        // Show suspended license notification
        this.showSuspendedLicenseNotification(data);
    }

    handleRevokedLicense(data) {
        this.logError(' Handling revoked license');
        
        // CRITICAL: Set the license status first
        this.licenseStatus = 'revoked';
        this.isValid = false;
        
        // Save status to localStorage for persistence
        localStorage.setItem('licenseStatus', this.licenseStatus);
        localStorage.setItem('isLicenseValid', this.isValid.toString());
        
        // Apply restrictions
        this.applyLicenseRestrictions();
        
        // Force update the notice with revoked status
        this.showLicenseNotice();
        
        // Show revoked license notification
        this.showRevokedLicenseNotification(data);
    }

    showSuspendedLicenseNotification(data) {
        // Remove any existing notifications
        this.removeAllLicenseNotifications();
        
        const notification = document.createElement('div');
        notification.id = 'license-suspended-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff9800;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong> License Suspended</strong>
            </div>
            <div style="margin-bottom: 15px;">
                Your theme license has been temporarily suspended. 
                Shopping features are disabled until the license is restored.
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Reason:</strong> ${data.suspension_reason || 'Violation of license terms'}
            </div>
            ${data.customer_portal_url ? `
            <div style="margin-bottom: 15px;">
                <a href="${data.customer_portal_url}" 
                   style="color: white; text-decoration: underline;" 
                   target="_blank">
                     Visit Customer Portal for Details
                </a>
            </div>
            ` : ''}
            <div style="text-align: right; margin-top: 10px;">
                <button onclick="document.getElementById('license-suspended-notification').remove()" 
                        style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.getElementById('license-suspended-notification')) {
                notification.remove();
            }
        }, 30000);
    }

    showRevokedLicenseNotification(data) {
        // Remove any existing notifications
        this.removeAllLicenseNotifications();
        
        const notification = document.createElement('div');
        notification.id = 'license-revoked-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong> License Revoked</strong>
            </div>
            <div style="margin-bottom: 15px;">
                Your theme license has been permanently revoked. 
                All theme features are disabled.
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Reason:</strong> ${data.revocation_reason || 'Severe violation of license terms'}
            </div>
            ${data.customer_portal_url ? `
            <div style="margin-bottom: 15px;">
                <a href="${data.customer_portal_url}" 
                   style="color: white; text-decoration: underline;" 
                   target="_blank">
                     Contact Support for Resolution
                </a>
            </div>
            ` : ''}
            <div style="text-align: right; margin-top: 10px;">
                <button onclick="document.getElementById('license-revoked-notification').remove()" 
                        style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Don't auto-remove revoked notifications - they should stay visible
    }

    showManualCaptureSuccess(data) {
        // Remove any existing notifications
        this.removeAllLicenseNotifications();
        
        const notification = document.createElement('div');
        notification.id = 'license-capture-success';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>✓ License Activated Successfully!</strong>
            </div>
            <div style="margin-bottom: 15px;">
                Your theme license has been activated for this store. 
                All features are now unlocked.
            </div>
            <div style="margin-bottom: 15px;">
                <strong>Domain:</strong> ${data.license?.domain || this.domain}
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <button onclick="document.getElementById('license-capture-success').remove()" 
                        style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.getElementById('license-capture-success')) {
                notification.remove();
            }
        }, 10000);
    }

    showLicenseActivatedSuccess(data) {
        // Remove any existing notifications
        this.removeAllLicenseNotifications();
        
        const notification = document.createElement('div');
        notification.id = 'license-activated-success';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 420px;
            font-size: 14px;
            line-height: 1.5;
            animation: slideInRight 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 24px;">
                    ✓
                </div>
                <strong style="font-size: 18px;">License Activated Successfully!</strong>
            </div>
            <div style="margin-bottom: 12px; padding-left: 55px;">
                Your theme license has been activated for this store. 
                All features are now unlocked.
            </div>
            <div style="margin-bottom: 15px; padding-left: 55px; font-size: 13px; opacity: 0.9;">
                <strong>Domain:</strong> ${data.license?.domain || this.domain}
            </div>
            <div style="text-align: right; margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.2);">
                <button onclick="document.getElementById('license-activated-success').remove()" 
                        style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (document.getElementById('license-activated-success')) {
                notification.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => {
                    notification.remove();
                }, 500);
            }
        }, 8000);
    }

    removeAllLicenseNotifications() {
        // Remove all possible license notifications
        const notifications = [
            'license-domain-notification',
            'license-suspended-notification', 
            'license-revoked-notification',
            'license-capture-success',
            'license-activated-success',
            'license-notice',
            'license-offline-notification'
        ];
        
        notifications.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        });
    }

    showOfflineModeNotification(daysRemaining) {
        // Remove any existing notifications
        const existing = document.getElementById('license-offline-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.id = 'license-offline-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            max-width: 380px;
            font-size: 13px;
            line-height: 1.5;
            animation: slideInRight 0.5s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 18px;">⚡</div>
                <strong style="font-size: 15px;">Offline Mode Active</strong>
            </div>
            <div style="padding-left: 44px; opacity: 0.95;">
                License server temporarily unavailable. Using cached license.<br>
                <strong>Grace period: ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining</strong>
            </div>
            <div style="text-align: right; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
                <button onclick="document.getElementById('license-offline-notification').remove()" 
                        style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    OK
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (document.getElementById('license-offline-notification')) {
                notification.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => notification.remove(), 500);
            }
        }, 10000);
    }

    handleInvalidLicense(responseData) {
        const reason = responseData?.error || responseData || 'Unknown error';
        this.log(' License validation failed:', reason);
        this.log(' Response Data:', responseData);
        
        // CRITICAL FIX: Set invalid status and persist it properly
        this.isValid = false;
        this.licenseStatus = 'invalid';
        
        // Save invalid status to localStorage for persistence across page reloads
        localStorage.setItem('lastLicenseState', 'invalid');
        localStorage.setItem('licenseStatus', 'invalid');
        localStorage.setItem('isLicenseValid', 'false');
        
        // Clear last activated license so message shows when re-entered
        localStorage.removeItem('lastActivatedLicense');
        
        this.log(' Invalid license status saved for persistence');
        
        // Check if this is a domain mismatch requiring customer portal redirect
        if (responseData.require_domain_update && responseData.customer_portal_url) {
            this.log(' Domain update required - redirecting to customer portal');
            
            // Show domain mismatch notification
            this.showDomainMismatchNotification(responseData);
        } else {
            // Apply normal restrictions for other validation failures
            this.applyLicenseRestrictions();
        }
    }

    showDomainMismatchNotification(data) {
        // Show notification on all pages for domain mismatch
        const isHomepage = window.location.pathname === '/' || 
                          window.location.pathname === '' || 
                          window.location.pathname.includes('/pages/');

        // Create notification for all pages, but adjust message for homepage
        const notification = document.createElement('div');
        notification.id = 'license-domain-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        // Adjust message for homepage vs other pages
        const messageTitle = isHomepage ? 
            ' Store License Issue' : 
            ' License Domain Mismatch';
            
        const messageBody = isHomepage ?
            'This theme license is registered to a different domain. Shopping features may be restricted.' :
            `Licensed Domain: <strong>${data.licensed_domain}</strong><br>Current Domain: <strong>${data.current_domain}</strong>`;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>${messageTitle}</strong>
            </div>
            <div style="margin-bottom: 15px;">
                ${messageBody}
            </div>
            <div>
                <a href="${data.customer_portal_url}" 
                   style="color: white; text-decoration: underline;" 
                   target="_blank">
                     Update Domain in Customer Portal
                </a>
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <button onclick="document.getElementById('license-domain-notification').remove()" 
                        style="background: rgba(255,255,255,0.3); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                     Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 15 seconds for homepage, 10 seconds for others
        const autoRemoveTime = isHomepage ? 15000 : 10000;
        setTimeout(() => {
            if (document.getElementById('license-domain-notification')) {
                notification.remove();
            }
        }, autoRemoveTime);
        
        // Always apply restrictions regardless of page
        this.applyLicenseRestrictions();
    }

    handleValidationError() {
        // Save license state for next page load
        localStorage.setItem('lastLicenseState', 'invalid');
        localStorage.setItem('licenseStatus', 'invalid');
        localStorage.setItem('isLicenseValid', 'false');
        
        // Set invalid state
        this.isValid = false;
        this.licenseStatus = 'invalid';
        
        // If we can't reach the server, apply restrictions but don't show modal
        this.applyLicenseRestrictions();
        this.log(' License server connection failed - restrictions applied');
    }

    applyLicenseRestrictions() {
        // Disable "Add to Cart" and "Buy Now" buttons
        this.disablePurchaseButtons();
        
        // Add watermark overlay
        this.addWatermark();
        
        // Show license notice based on status
        this.showLicenseNotice();
        
        // Mark theme as unlicensed
        document.body.classList.remove('theme-licensed');
        document.body.classList.add('theme-unlicensed');
        
        // Add specific status classes
        document.body.classList.remove('license-active', 'license-suspended', 'license-revoked');
        if (this.licenseStatus === 'suspended') {
            document.body.classList.add('license-suspended');
        } else if (this.licenseStatus === 'revoked') {
            document.body.classList.add('license-revoked');
        }
    }

    removeLicenseRestrictions() {
        // Enable "Add to Cart" and "Buy Now" buttons
        this.enablePurchaseButtons();
        
        // Remove watermark
        this.removeWatermark();
        
        // Hide license notice
        this.hideLicenseNotice();
        
        // Re-scan for any new buttons that might have loaded dynamically
        setTimeout(() => {
            this.enablePurchaseButtons();
        }, 1000);
        
        // Mark theme as licensed
        document.body.classList.remove('theme-unlicensed', 'license-suspended', 'license-revoked');
        document.body.classList.add('theme-licensed', 'license-active');
    }

    disablePurchaseButtons() {
        try {
            const purchaseButtons = document.querySelectorAll(
                'button[type="submit"][name="add"], .btn-cart, .add-to-cart, input[type="submit"][value*="cart" i], .buy-now, .btn-buy-now, button[value*="buy now" i], button[data-action="buy-now"], button[name="buy_now"], .shopify-payment-button button'
            );
            
            purchaseButtons.forEach(button => {
                try {
                    // Add license restriction class
                    button.classList.add('license-disabled');
                    
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                    
                    // Store original text only once
                    if (!button.dataset.originalText) {
                        button.dataset.originalText = button.textContent || button.value;
                    }
                    
                    // Change button text based on license status
                    let newText = 'LICENSE REQUIRED';
                    if (this.licenseStatus === 'suspended') {
                        newText = 'LICENSE SUSPENDED';
                    } else if (this.licenseStatus === 'revoked') {
                        newText = 'LICENSE REVOKED';
                    }
                    
                    // Change button text
                    if (button.tagName === 'INPUT') {
                        button.value = newText;
                    } else {
                        button.textContent = newText;
                    }
                    
                    // Remove existing click handlers and add license handler
                    button.removeEventListener('click', this.boundLicenseClickHandler);
                    button.addEventListener('click', this.boundLicenseClickHandler);
                    
                } catch (btnError) {
                    // Silently skip problematic buttons
                    this.log('Button disable error:', btnError.message);
                }
            });
            
            // Also disable Shopify payment buttons (dynamic)
            try {
                const paymentButtons = document.querySelectorAll('.shopify-payment-button iframe');
                paymentButtons.forEach(iframe => {
                    iframe.style.pointerEvents = 'none';
                    iframe.style.opacity = '0.5';
                });
            } catch (paymentError) {
                // Silently skip payment button errors
            }
            
        } catch (e) {
            this.log('Purchase button disable error:', e.message);
            // Continue execution even if button disabling fails
        }
    }
    
    licenseClickHandler(e) {
        // SAFER: Only prevent if we're sure this is our license handler
        this.log(' License click handler triggered for status:', this.licenseStatus);
        
        // Check if the license is actually invalid
        if (!this.isValid) {
            e.preventDefault();
            e.stopPropagation();
            
            // Show different tooltips based on license status
            let message = 'VALID LICENSE REQUIRED TO PURCHASE';
            if (this.licenseStatus === 'suspended') {
                message = 'LICENSE SUSPENDED - PURCHASE DISABLED';
            } else if (this.licenseStatus === 'revoked') {
                message = 'LICENSE REVOKED - PURCHASE PERMANENTLY DISABLED';
            }
            
            this.showTooltip(e.target, message);
            return false;
        } else {
            // License is valid - don't interfere with normal button behavior
            this.log(' License is valid - allowing normal button behavior');
            return true;
        }
    }

    enablePurchaseButtons() {
        this.log(' Enabling purchase buttons...');
        
        try {
            const purchaseButtons = document.querySelectorAll(
                'button[type="submit"][name="add"], .btn-cart, .add-to-cart, input[type="submit"][value*="cart" i], .buy-now, .btn-buy-now, button[value*="buy now" i], button[data-action="buy-now"], button[name="buy_now"], .shopify-payment-button button'
            );
            
            purchaseButtons.forEach(button => {
                try {
                    this.log('   Enabling button:', button.textContent || button.value);
                    
                    //  CRITICAL: Remove license click handler FIRST
                    button.removeEventListener('click', this.boundLicenseClickHandler);
                    
                    // Remove disabled state
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.cursor = 'pointer';
                    
                    // Restore original text if it exists
                    if (button.dataset.originalText) {
                        if (button.tagName === 'INPUT') {
                            button.value = button.dataset.originalText;
                        } else {
                            button.textContent = button.dataset.originalText;
                        }
                        // Clear the stored original text
                        delete button.dataset.originalText;
                    }
                    
                    // Remove license restriction class if exists
                    button.classList.remove('license-disabled');
                    
                    // IMPORTANT: Don't add any new event listeners here
                    // Let the theme's original handlers work normally
                    this.log('   Button enabled:', button.textContent || button.value);
                    
                } catch (btnError) {
                    this.log('Button enable error:', btnError.message);
                }
            });
            
            // Also enable any Shopify payment buttons that might be dynamically loaded
            setTimeout(() => {
                try {
                    const dynamicButtons = document.querySelectorAll('.shopify-payment-button iframe');
                    dynamicButtons.forEach(iframe => {
                        if (iframe.style.pointerEvents === 'none') {
                            iframe.style.pointerEvents = 'auto';
                            iframe.style.opacity = '1';
                        }
                    });
                } catch (paymentError) {
                    // Silently skip payment button errors
                }
            }, 500);
            
        } catch (e) {
            this.log('Purchase button enable error:', e.message);
            // Continue execution even if button enabling fails
        }
    }

    addWatermark() {
        // Remove existing watermark first
        this.removeWatermark();
        
        // Check if homepage for different watermark treatment
        const isHomepage = window.location.pathname === '/' || 
                          window.location.pathname === '' || 
                          window.location.pathname.includes('/pages/');
        
        const watermark = document.createElement('div');
        watermark.id = 'license-watermark';
        
        // Different watermarks based on license status
        let watermarkText = 'UNLICENSED THEME';
        let watermarkColor = 'rgba(255, 0, 0, 0.1)';
        
        if (this.licenseStatus === 'suspended') {
            watermarkText = isHomepage ? 'SUSPENDED' : 'SUSPENDED';
            watermarkColor = 'rgba(255, 152, 0, 0.15)';
        } else if (this.licenseStatus === 'revoked') {
            watermarkText = isHomepage ? 'PERMANENT SUSPENDED' : 'PERMANENT SUSPENDED';
            watermarkColor = 'rgba(255, 0, 0, 0.2)';
        } else {
            watermarkText = isHomepage ? 'UNLICENSED THEME' : 'UNLICENSED THEME';
        }
        
        watermark.innerHTML = watermarkText;
        
        // More prominent watermark for homepage
        const opacity = isHomepage ? '0.15' : '0.1';
        const fontSize = isHomepage ? '56px' : '48px';
        
        watermark.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: ${fontSize};
            font-weight: bold;
            color: ${watermarkColor};
            z-index: 999;
            pointer-events: none;
            user-select: none;
            font-family: Arial, sans-serif;
            letter-spacing: 10px;
        `;
        
        document.body.appendChild(watermark);
    }

    removeWatermark() {
        const watermark = document.getElementById('license-watermark');
        if (watermark) {
            watermark.remove();
        }
    }

    showLicenseNotice() {
        // Check if notice already exists - if so, update it instead of recreating
        let notice = document.getElementById('license-notice');
        let isExisting = !!notice;
        
        if (!notice) {
            // Create new notice if it doesn't exist
            notice = document.createElement('div');
            notice.id = 'license-notice';
        }
        
        // Different notices based on license status
        let noticeText = ' THIS THEME REQUIRES A VALID LICENSE';
        let backgroundColor = '#ff4444';
        
        if (this.licenseStatus === 'suspended') {
            noticeText = ' SUSPENDED';
            backgroundColor = '#ff9800';
        } else if (this.licenseStatus === 'revoked') {
            noticeText = ' PERMANENT SUSPENDED';
            backgroundColor = '#f44336';
        }
        
        // Set or update the notice content
        notice.innerHTML = `
            <div style="background: ${backgroundColor}; color: white; padding: 10px; text-align: center; position: fixed; top: 0; left: 0; right: 0; z-index: 1000; font-family: Arial, sans-serif;">
                <strong>${noticeText}</strong>
               
            </div>
        `;
        
        // Only append if it's a new notice
        if (!isExisting) {
            document.body.appendChild(notice);
        }
        
        this.log(' License notice updated:', {
            status: this.licenseStatus,
            text: noticeText,
            backgroundColor: backgroundColor,
            existing: isExisting
        });
    }

    showTooltip(button, message) {
        // Remove existing tooltip
        const existingTooltip = document.getElementById('license-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        const tooltip = document.createElement('div');
        tooltip.id = 'license-tooltip';
        tooltip.textContent = message;
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;

        // Position tooltip above the button
        const buttonRect = button.getBoundingClientRect();
        tooltip.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
        tooltip.style.top = (buttonRect.top - 40) + 'px';
        tooltip.style.transform = 'translateX(-50%)';

        document.body.appendChild(tooltip);

        // Remove tooltip after 3 seconds
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
    }

    hideLicenseNotice() {
        const notice = document.getElementById('license-notice');
        if (notice) {
            notice.remove();
        }
        
        // Also remove any tooltips
        const tooltip = document.getElementById('license-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    showLicensePrompt() {
        const modal = this.createLicenseModal();
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="margin-bottom: 20px; color: #333;">Enter License Key</h2>
                <p style="margin-bottom: 20px; color: #666;">Please enter your theme license key to activate this theme.</p>
                <input type="text" id="license-input" placeholder="Enter your license key" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 5px;">
                <div style="text-align: right;">
                    <button onclick="this.validateInputLicense()" style="background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Activate</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showLicenseModal() {
        const modal = this.createLicenseModal();
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="margin-bottom: 20px; color: #333;">LICENSE REQUIRED</h2>
                <p style="margin-bottom: 20px; color: #666;">This theme requires a valid license to enable shopping functionality.</p>
                <p style="margin-bottom: 20px; color: #666;">Please contact the store owner to resolve this issue.</p>
                <div style="text-align: right;">
                    <button onclick="this.closeLicenseModal()" style="background: #007cba; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showLicenseWarning(reason) {
        const modal = this.createLicenseModal();
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="margin-bottom: 20px; color: #d32f2f;">License Issue</h2>
                <p style="margin-bottom: 20px; color: #666;">${reason}</p>
                <p style="margin-bottom: 20px; color: #666;">Please contact support for assistance.</p>
                <div style="text-align: right;">
                    <button onclick="this.closeLicenseModal()" style="background: #d32f2f; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showServerError() {
        const modal = this.createLicenseModal();
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="margin-bottom: 20px; color: #ff9800;">Connection Error</h2>
                <p style="margin-bottom: 20px; color: #666;">Unable to verify license. Please check your internet connection.</p>
                <div style="text-align: right;">
                    <button onclick="this.retryValidation()" style="background: #ff9800; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px;">Retry</button>
                    <button onclick="this.closeLicenseModal()" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    createLicenseModal() {
        // Remove existing modal
        this.closeLicenseModal();
        
        const modal = document.createElement('div');
        modal.id = 'license-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;
        
        return modal;
    }

    closeLicenseModal() {
        const modal = document.getElementById('license-modal');
        if (modal) {
            modal.remove();
        }
    }

    validateInputLicense() {
        const input = document.getElementById('license-input');
        const licenseKey = input.value.trim();
        
        if (licenseKey) {
            this.licenseKey = licenseKey;
            this.closeLicenseModal();
            this.validateLicense();
            
            // Save to theme settings (you may need to implement this)
            this.saveLicenseToSettings(licenseKey);
        }
    }

    saveLicenseToSettings(licenseKey) {
        // This would typically save to Shopify theme settings
        // For now, we'll save to localStorage as a fallback
        localStorage.setItem('themeLicenseKey', licenseKey);
        window.themeLicenseKey = licenseKey;
    }

    retryValidation() {
        this.closeLicenseModal();
        this.validateLicense();
    }

    startPeriodicCheck() {
        setInterval(() => {
            this.validateLicense();
        }, this.checkInterval);
    }

    cacheValidation(data) {
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            domain: this.domain,
            licenseKey: this.licenseKey,
            status: this.licenseStatus,
            isValid: this.isValid
        };
        localStorage.setItem('licenseValidationCache', JSON.stringify(cacheData));
        
        // Also cache validation state for quick access
        localStorage.setItem('isLicenseValid', this.isValid.toString());
        localStorage.setItem('licenseStatus', this.licenseStatus);
    }

    getCachedValidation() {
        try {
            const cached = localStorage.getItem('licenseValidationCache');
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            
            // Validate cache is for same domain and license
            if (cacheData.domain !== this.domain || cacheData.licenseKey !== this.licenseKey) {
                // Clear invalid cache
                this.clearValidationCache();
                return null;
            }
            
            // Check if cache is expired (7 days grace period)
            const cacheAge = Date.now() - cacheData.timestamp;
            const maxAge = this.cacheDuration; // 7 days
            
            if (cacheAge > maxAge) {
                this.log('Cache expired after 7 days - clearing');
                this.clearValidationCache();
                return null;
            }
            
            this.log(`Valid cache found (${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days old)`);
            return cacheData;
        } catch (error) {
            // Clear corrupted cache
            this.clearValidationCache();
            return null;
        }
    }

    clearValidationCache() {
        localStorage.removeItem('licenseValidationCache');
        // Keep license status and validity for persistence
        // This ensures suspended/revoked/invalid status remains consistent
        this.log('Cache cleared but status preserved for consistency');
    }

    // Public method to check if license is valid
    isLicenseValid() {
        return this.isValid;
    }

    // Public method to get license status
    getLicenseStatus() {
        return {
            valid: this.isValid,
            status: this.licenseStatus,
            key: this.licenseKey,
            domain: this.domain
        };
    }

    // Dispatch custom events for theme integration
    dispatchLicenseEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { 
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        
        // Dispatch on window for global access
        window.dispatchEvent(event);
        
        // Also dispatch on document for compatibility
        document.dispatchEvent(event);
    }
    
    // Method to manually refresh restrictions (useful for dynamic content)
    refreshRestrictions() {
        if (this.isValid) {
            this.removeLicenseRestrictions();
        } else {
            this.applyLicenseRestrictions();
        }
    }
}

// Initialize license validator when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Production-safe initialization - no sensitive data in console
        
        // Add CSS animations for notifications
        if (!document.getElementById('license-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'license-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
                
                #license-activated-success button:hover {
                    background: rgba(255,255,255,0.3) !important;
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);
        }
        
        // Get configuration from theme settings or use defaults
        const licenseConfig = {
            licenseServer: window.THEME_LICENSE_CONFIG?.serverUrl || window.licenseServerUrl || 'https://base.surgetheme.com',
            checkInterval: 24 * 60 * 60 * 1000, // 24 hours
            retryAttempts: 3,
            cacheDuration: 7 * 24 * 60 * 60 * 1000 // 7 days grace period when server is down
        };
        
        // Initialize the license validator with error handling
        window.licenseValidator = new ShopifyLicenseValidator(licenseConfig);
        
        // Check for immediate cached status without logging sensitive data
        const immediateStatus = localStorage.getItem('licenseStatus');
        const immediateValidFlag = localStorage.getItem('isLicenseValid');
        
        if ((immediateStatus === 'suspended' || immediateStatus === 'revoked') && immediateValidFlag === 'false') {
            // Apply immediate restrictions silently
            
            // Apply restrictions immediately without delay
            if (window.licenseValidator) {
                window.licenseValidator.licenseStatus = immediateStatus;
                window.licenseValidator.isValid = false;
                
                // Apply restrictions immediately
                window.licenseValidator.applyLicenseRestrictions();
                
                // Set a flag to prevent validation from overwriting this
                window.licenseValidator.hasImmediateStatus = true;
                window.licenseValidator.immediateStatusApplied = true;
                
                this.log(' Immediate restrictions applied successfully');
            }
            
            // Also apply with a small delay as backup
            setTimeout(() => {
                if (window.licenseValidator && !window.licenseValidator.isValid) {
                    window.licenseValidator.licenseStatus = immediateStatus;
                    window.licenseValidator.isValid = false;
                    window.licenseValidator.applyLicenseRestrictions();
                    this.log(' Backup restrictions applied');
                }
            }, 50);
        }
        
    } catch (initError) {
        // Silent failure - continue page loading
        // Continue page loading even if license system fails
    }
});

 // End of ShopifyLicenseValidator class

// Export for potential use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShopifyLicenseValidator;
}
