class customVariant extends HTMLElement {
  constructor() {
    super();
    this.selected = {};
  }

  connectedCallback() {
    this.variants = this.getJson('#json_prod_var');
    this.options = this.getJson('#json_prod_options');

    if (!this.variants || !this.options) return;

    this.setupSizeButtons();
    this.setupColorRadios();
    this.setupDropdowns();

    // Preselect by variant ID first (sets all options at once)
    // This should run before preselectColor to avoid partial selection issues
    const variantIdPreselected = this.preselectVariantById();

    // Only preselect color if variant ID preselection didn't work
    // This handles cases where variant ID might not be available initially
    if (!variantIdPreselected) {
      this.preselectColor();
    }

    // Ensure price is updated on initial load to match listing page (fix for issue #1)
    // This handles cases where Liquid-rendered price might differ from JavaScript-updated price
    this.ensurePriceSyncOnLoad();
  }

  ensurePriceSyncOnLoad() {
    // Wait for DOM to be fully ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.syncPriceOnLoad();
      });
    } else {
      // Use setTimeout to ensure all other scripts have run
      setTimeout(() => {
        this.syncPriceOnLoad();
      }, 100);
    }
  }

  syncPriceOnLoad() {
    const variantIdEl = document.querySelector('#product-variant-id');
    if (!variantIdEl) return;

    const variantId = parseInt(variantIdEl.value, 10);
    if (!variantId || isNaN(variantId)) return;

    const variant = this.variants.find(v => v.id === variantId);
    if (!variant) return;

    // Update price display to ensure it matches the selected variant
    // This ensures consistency with listing pages that show selected_or_first_available_variant price
    this.updatePriceDisplay(variant);
  }

  getJson(selector) {
    const el = document.querySelector(selector);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      return null;
    }
  }

  setupSizeButtons() {
    // Find the actual size option name (case-insensitive)
    const sizeOptionName = this.options.find(opt => {
      const optNameLower = opt.name.toLowerCase();
      return optNameLower === 'size' || optNameLower === 'sizes';
    })?.name;

    if (!sizeOptionName) return;

    this.querySelectorAll('.size-button-list .size-button').forEach(button => {
      if (button.dataset.initialized === 'true') return;
      button.dataset.initialized = 'true';

      button.addEventListener('click', () => {
        const value = button.dataset.size;
        button.closest('.size-button-list')
          .querySelectorAll('.size-button')
          .forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        this.selected[sizeOptionName] = value;
        this.updateSelectedVariant();
      });
    });
  }

  setupColorRadios() {
    // Find the actual color option name (case-insensitive)
    const colorOptionName = this.options.find(opt => {
      const optNameLower = opt.name.toLowerCase();
      return optNameLower === 'color' || optNameLower === 'colors';
    })?.name;

    if (!colorOptionName) return;

    this.querySelectorAll('input[name="option_color"]').forEach(radio => {
      if (radio.dataset.initialized === 'true') return;
      radio.dataset.initialized = 'true';

      radio.addEventListener('change', () => {
        const value = radio.value;
        this.selected[colorOptionName] = value;

        const wrapper = radio.closest('.color-circles-active');
        const labelEl = wrapper?.querySelector('.active-color');
        if (labelEl) labelEl.textContent = value;

        this.updateSelectedVariant();
      });
    });
  }

  setupDropdowns() {
    this.querySelectorAll('.custom-select').forEach(select => {
      if (select.dataset.initialized === 'true') return;
      select.dataset.initialized = 'true';

      const trigger = select.querySelector('.select-trigger');
      const options = select.querySelectorAll('.option-value');
      const optionGroup = select.closest('.option-group');
      const label = optionGroup?.querySelector('label')?.textContent?.trim();
      const optionName = label?.replace(/:$/, '');

      if (!trigger || !optionName) return;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        select.classList.toggle('open');
      });

      options.forEach(opt => {
        opt.addEventListener('click', () => {
          const value = opt.dataset.value;
          const optionName = opt.dataset.optionName;
          if (value && optionName) {
            trigger.innerHTML = opt.innerHTML;
            select.classList.remove('open');
            this.selected[optionName] = value;
            this.updateSelectedVariant();
          }
        });
      });

      document.addEventListener('click', (e) => {
        if (!select.contains(e.target)) {
          select.classList.remove('open');
        }
      });
    });
  }

  preselectColor() {
    const preselected = this.querySelector('input[name="option_color"]:checked');
    if (preselected) {
      preselected.dispatchEvent(new Event('change'));
    }
  }

  updateSelectedVariant() {
    // Check if all options are selected before trying to match
    const allOptionsSelected = this.options.every(opt => {
      const value = this.selected[opt.name];
      return value !== null && value !== undefined && value !== '';
    });

    // Don't try to match if not all options are selected yet
    if (!allOptionsSelected) {
      return;
    }

    const ordered = this.options.map(opt => this.selected[opt.name] || null);
    const match = this.variants.find(v => JSON.stringify(v.options) === JSON.stringify(ordered));

    if (match) {
      const variantIdEl = document.querySelector('#product-variant-id');
      if (!variantIdEl) return;
      variantIdEl.value = match.id;
      variantIdEl.dispatchEvent(new Event('change'));

      // ✅ Снять disabled, если вариант доступен
      if (match.available) {
        variantIdEl.removeAttribute('disabled');
      } else {
        variantIdEl.setAttribute('disabled', 'disabled');
      }

      this.updatePriceDisplay(match);
      this.updateButtonState(match);
      this.updateStockMessage(match);
    } else {
      // No matching variant found - mark as unavailable
      this.updateButtonState(null);
    }
  }

  updateStockMessage(variant) {
    const instockEl = document.querySelector('.price-block .instock');
    if (!instockEl) {
      return;
    }

    // Get existing text elements
    let instockTextEl = instockEl.querySelector('.instock-text');
    let outstockTextEl = instockEl.querySelector('.outstock-text');
    let svgEl = instockEl.querySelector('svg');

    // Get data attributes from container
    const instockText = instockEl.dataset.instockText || (instockTextEl && instockTextEl.dataset.instockText);
    const outstockText = instockEl.dataset.outstockText || (instockTextEl && instockTextEl.dataset.outstockText);
    const instockColor = instockEl.dataset.instockColor || (instockTextEl && instockTextEl.dataset.instockColor) || '#34A853';
    const outstockColor = instockEl.dataset.outstockColor || (instockTextEl && instockTextEl.dataset.outstockColor) || '#FF0000';

    // Determine if variant is available
    // Check inventory management and policy (matching Liquid logic)
    const inventoryManagement = variant.inventory_management;
    const inventoryPolicy = variant.inventory_policy;
    const inventoryQuantity = variant.inventory_quantity != null ? parseInt(variant.inventory_quantity, 10) : 0;

    // Handle variant.available - could be boolean, string, or undefined
    let variantAvailable = true; // Default to true
    if (variant.available !== undefined && variant.available !== null) {
      if (typeof variant.available === 'boolean') {
        variantAvailable = variant.available;
      } else if (typeof variant.available === 'string') {
        variantAvailable = variant.available.toLowerCase() === 'true' || variant.available === '1';
      } else {
        variantAvailable = Boolean(variant.available);
      }
    }

    let showInStock = false;

    if (inventoryManagement === 'shopify') {
      if (inventoryPolicy === 'continue') {
        // Allow backorders - always show in stock
        showInStock = true;
      } else if (inventoryPolicy === 'deny') {
        // Don't allow backorders - check quantity
        // If inventory_quantity is null/undefined, it means inventory is not tracked, so use variant.available
        if (variant.inventory_quantity == null || variant.inventory_quantity === undefined) {
          showInStock = variantAvailable;
        } else {
          // Inventory is tracked, check if quantity > 0
          showInStock = inventoryQuantity > 0 && variantAvailable;
        }
      } else {
        // inventoryPolicy is undefined/null - use variant.available as primary indicator
        // This handles cases where policy isn't explicitly set but variant says it's available
        showInStock = variantAvailable;
      }
    } else {
      // No inventory management - use variant.available
      showInStock = variantAvailable;
    }

    // Update the display based on structure
    if (showInStock) {
      // Show in-stock message

      // Create instock-text if it doesn't exist
      if (!instockTextEl && instockText) {
        instockTextEl = document.createElement('div');
        instockTextEl.className = 'instock-text';
        instockEl.appendChild(instockTextEl);
      }

      if (instockTextEl) {
        instockTextEl.textContent = instockText || instockTextEl.textContent;
        instockTextEl.style.setProperty('--instock-color', instockColor);
        instockTextEl.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important;';
      }

      // Create SVG if it doesn't exist (for yas-product-block structure)
      if (!svgEl && instockColor) {
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('width', '25');
        svgEl.setAttribute('height', '25');
        svgEl.setAttribute('viewBox', '0 0 25 25');
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgEl.style.cssText = 'overflow: visible; display: block;';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12.5');
        circle.setAttribute('cy', '12.5');
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', instockColor);
        svgEl.appendChild(circle);

        // Add ripple circles
        for (let i = 0; i < 3; i++) {
          const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ripple.setAttribute('class', 'ripple');
          ripple.setAttribute('cx', '12.5');
          ripple.setAttribute('cy', '12.5');
          ripple.setAttribute('r', '4');
          ripple.setAttribute('fill', 'none');
          ripple.setAttribute('stroke', instockColor);
          ripple.setAttribute('stroke-width', '1');
          svgEl.appendChild(ripple);
        }

        // Insert SVG before instock-text if it exists, otherwise append
        if (instockTextEl) {
          instockEl.insertBefore(svgEl, instockTextEl);
        } else {
          instockEl.appendChild(svgEl);
        }
      }

      if (svgEl) {
        svgEl.style.cssText += 'display: block !important; visibility: visible !important;';
        const circle = svgEl.querySelector('circle:not(.ripple)');
        if (circle) {
          circle.setAttribute('fill', instockColor);
        }
        const ripples = svgEl.querySelectorAll('circle.ripple');
        ripples.forEach(ripple => {
          ripple.setAttribute('stroke', instockColor);
        });
      }

      // Hide outstock-text if it exists
      if (outstockTextEl) {
        outstockTextEl.style.cssText += 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
      }
    } else {
      // Show out-of-stock message

      // Create outstock-text if it doesn't exist
      if (!outstockTextEl && outstockText) {
        outstockTextEl = document.createElement('div');
        outstockTextEl.className = 'outstock-text';
        instockEl.appendChild(outstockTextEl);
      }

      if (outstockTextEl) {
        outstockTextEl.textContent = outstockText || outstockTextEl.textContent;
        outstockTextEl.style.setProperty('--outstock-color', outstockColor);
        outstockTextEl.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important;';
      }

      // Hide instock-text if it exists
      if (instockTextEl) {
        if (outstockTextEl) {
          // If there's a separate outstock element (yas-product-block.liquid structure), hide instock
          instockTextEl.style.cssText += 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
        } else {
          // If instock-text is the only element (yas-product-section.liquid structure), update its content
          if (instockTextEl.dataset.outstockText || outstockText) {
            instockTextEl.textContent = outstockText || instockTextEl.dataset.outstockText;
            instockTextEl.style.setProperty('--instock-color', outstockColor);
            instockTextEl.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important;';
          } else {
            instockTextEl.style.cssText += 'display: none !important; visibility: hidden !important;';
          }
        }
      }

      // Update SVG color to outstock color instead of hiding it
      if (svgEl) {
        svgEl.style.cssText += 'display: block !important; visibility: visible !important;';
        const circle = svgEl.querySelector('circle:not(.ripple)');
        if (circle) {
          circle.setAttribute('fill', outstockColor);
        }
        const ripples = svgEl.querySelectorAll('circle.ripple');
        ripples.forEach(ripple => {
          ripple.setAttribute('stroke', outstockColor);
        });
      } else if (outstockColor) {
        // Create SVG if it doesn't exist (for yas-product-block structure)
        svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('width', '25');
        svgEl.setAttribute('height', '25');
        svgEl.setAttribute('viewBox', '0 0 25 25');
        svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgEl.style.cssText = 'overflow: visible; display: block;';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12.5');
        circle.setAttribute('cy', '12.5');
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', outstockColor);
        svgEl.appendChild(circle);

        // Add ripple circles
        for (let i = 0; i < 3; i++) {
          const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          ripple.setAttribute('class', 'ripple');
          ripple.setAttribute('cx', '12.5');
          ripple.setAttribute('cy', '12.5');
          ripple.setAttribute('r', '4');
          ripple.setAttribute('fill', 'none');
          ripple.setAttribute('stroke', outstockColor);
          ripple.setAttribute('stroke-width', '1');
          svgEl.appendChild(ripple);
        }

        // Insert SVG before outstock-text if it exists, otherwise append
        if (outstockTextEl) {
          instockEl.insertBefore(svgEl, outstockTextEl);
        } else {
          instockEl.appendChild(svgEl);
        }
      }
    }
  }

  updateButtonState(variant) {
    const button = document.querySelector('button[type="submit"].submit_add_cart');
    if (!button) return;

    const textSpan = button.querySelector('[data-atc-text-span]');
    if (!textSpan) return;

    // Handle null variant (unavailable/unmatched variant)
    if (variant === null || variant === undefined) {
      button.setAttribute('disabled', '');
      textSpan.textContent = 'Unavailable';
      return;
    }

    if (!variant.available) {
      button.setAttribute('disabled', '');
      textSpan.textContent = 'Sold out';
    } else {
      button.removeAttribute('disabled');
      textSpan.textContent = 'Add to cart';
    }
  }

  preselectVariantById() {
    const variantIdEl = document.querySelector('#product-variant-id');
    if (!variantIdEl) return false;

    const variantId = parseInt(variantIdEl.value, 10);
    if (!variantId || isNaN(variantId)) return false;

    const variant = this.variants.find(v => v.id === variantId);
    if (!variant) return false;

    // Set all options in this.selected first before any UI updates or events
    this.options.forEach((opt, index) => {
      const optionName = opt.name;
      const optionValue = variant.options[index];
      this.selected[optionName] = optionValue;
    });

    // Update UI without dispatching events (to avoid triggering updateSelectedVariant multiple times)
    this.options.forEach((opt, index) => {
      const optionName = opt.name;
      const optionValue = variant.options[index];

      const radio = this.querySelector(`input[name="option_${optionName.toLowerCase()}"][value="${optionValue}"]`);
      if (radio) {
        radio.checked = true;
        // Don't dispatch event here - we'll call updateSelectedVariant once at the end
      }

      const sizeBtn = this.querySelector(`.size-button[data-size="${optionValue}"]`);
      if (sizeBtn) {
        sizeBtn.classList.add('active');
      }

      this.querySelectorAll('.custom-select').forEach(select => {
        const trigger = select.querySelector('.select-trigger');
        const options = select.querySelectorAll('.option-value');
        options.forEach(opt => {
          if (opt.dataset.value === optionValue) {
            trigger.innerHTML = opt.innerHTML;
          }
        });
      });
    });

    // Trigger updateSelectedVariant once with all options set
    this.updateSelectedVariant();

    return true;
  }

  updatePriceDisplay(variant) {
    const priceEl = document.querySelector('.price-block .price');
    const compareEl = document.querySelector('.price-block .cprice');
    const saveEl = document.querySelector('.price-block .priced');

    const price = variant.price;
    const compare = variant.compare_at_price;

    if (priceEl) {
      priceEl.textContent = this.formatMoney(price);
      priceEl.style.display = '';
    }

    if (compare && compare > price) {
      if (compareEl) {
        compareEl.textContent = this.formatMoney(compare);
        compareEl.style.display = '';
      }
      if (saveEl) {
        const discount = Math.round(100 - (price / compare) * 100);
        saveEl.textContent = `save ${discount}%`;
        saveEl.style.display = '';
      }
    } else {
      if (compareEl) compareEl.style.display = 'none';
      if (saveEl) saveEl.style.display = 'none';
    }
  }

  formatMoney(cents) {
    // Use Shopify's formatMoney function with shop's money format
    const moneyFormat = (window.theme && window.theme.settings && window.theme.settings.moneyFormat)
      || (window.CartJS && window.CartJS.settings && window.CartJS.settings.moneyFormat)
      || (window.Shopify && window.Shopify.money_format);

    if (typeof Shopify !== 'undefined' && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents, moneyFormat);
    }

    // Fallback to basic formatting if Shopify.formatMoney is not available
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }
}

class PacSection extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.quantityInput = document.querySelector('quantity-inputs input[name="quantity"]');
    this.quantityWrapper = document.querySelector('quantity-inputs');

    if (this.quantityWrapper) {
      this.quantityWrapper.style.display = 'none';
    }

    this.addEventListener('click', this.handleClick.bind(this));

    // При загрузке активный пак
    const defaultActive = this.querySelector('.pack.active');
    if (defaultActive) {
      this.setQuantityFromPack(defaultActive);
    }
  }

  handleClick(event) {
    const clickedPack = event.target.closest('.pack');
    if (!clickedPack || !this.contains(clickedPack)) return;

    this.querySelectorAll('.pack').forEach(pack => {
      pack.classList.remove('active');
    });

    clickedPack.classList.add('active');
    this.setQuantityFromPack(clickedPack);
    // Вызываем кастомное событие (опционально)
    this.dispatchEvent(new CustomEvent('pack:change', {
      detail: {
        id: clickedPack.dataset.packId,
        quantity: clickedPack.querySelector('[data-packquntity]')?.dataset.packquntity
      },
      bubbles: true
    }));
  }

  setQuantityFromPack(packElement) {
    const quantityElement = packElement.querySelector('[data-packquntity]');
    const quantity = quantityElement?.dataset.packquntity;

    if (this.quantityInput && quantity) {
      this.quantityInput.value = quantity;
      this.quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}


class QuantityInputs extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
    this._buttonClickInProgress = false;
    this._lastClickTime = 0;
  }

  connectedCallback() {
    if (this.initialized) return; // 🔐 Защита от повторного вызова
    this.initialized = true;

    this.input = this.querySelector('input[name="quantity"]');
    this.plusBtn = this.querySelector('button[name="plus"]');
    this.minusBtn = this.querySelector('button[name="minus"]');

    if (!this.input || !this.plusBtn || !this.minusBtn) return;

    this.plusBtn.addEventListener('click', (e) => this.increment(e));
    this.minusBtn.addEventListener('click', (e) => this.decrement(e));
    this.input.addEventListener('change', () => this.updateButtonStates());
    this.input.addEventListener('input', () => this.updateButtonStates());

    // Initialize button states
    this.updateButtonStates();
  }

  disableButtons() {
    if (this.plusBtn) {
      this.plusBtn.disabled = true;
      this.plusBtn.style.pointerEvents = 'none';
      this.plusBtn.style.opacity = '0.6';
    }
    if (this.minusBtn) {
      this.minusBtn.disabled = true;
      this.minusBtn.style.pointerEvents = 'none';
      this.minusBtn.style.opacity = '0.6';
    }
  }

  enableButtons() {
    if (this.plusBtn) {
      this.plusBtn.disabled = false;
      this.plusBtn.style.pointerEvents = '';
      this.plusBtn.style.opacity = '';
    }
    if (this.minusBtn) {
      this.minusBtn.disabled = false;
      this.minusBtn.style.pointerEvents = '';
      this.minusBtn.style.opacity = '';
    }
  }

  getMinValue() {
    const minValue = this.input.getAttribute('min');
    return minValue ? parseInt(minValue, 10) : 1;
  }

  updateButtonStates() {
    const current = parseInt(this.input.value, 10) || this.getMinValue();
    const minValue = this.getMinValue();

    // Disable minus button if current value is at or below minimum
    if (current <= minValue) {
      this.minusBtn.setAttribute('disabled', 'disabled');
    } else {
      this.minusBtn.removeAttribute('disabled');
    }
  }

  increment(e) {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Debounce: prevent clicks within 300ms
    const now = Date.now();
    if (now - this._lastClickTime < 300) {
      return;
    }
    this._lastClickTime = now;
    
    // Prevent multiple rapid clicks
    if (this._buttonClickInProgress) {
      return;
    }
    
    this._buttonClickInProgress = true;
    this.disableButtons();
    
    const current = parseInt(this.input.value, 10) || this.getMinValue();
    this.input.value = current + 1;
    
    // Dispatch change event
    this.input.dispatchEvent(new Event('change'));
    this.updateButtonStates();
    
    // Re-enable buttons after debounce delay
    setTimeout(() => {
      this._buttonClickInProgress = false;
      this.enableButtons();
    }, 300);
  }

  decrement(e) {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Debounce: prevent clicks within 300ms
    const now = Date.now();
    if (now - this._lastClickTime < 300) {
      return;
    }
    this._lastClickTime = now;
    
    // Prevent multiple rapid clicks
    if (this._buttonClickInProgress) {
      return;
    }
    
    this._buttonClickInProgress = true;
    this.disableButtons();
    
    const current = parseInt(this.input.value, 10) || this.getMinValue();
    const minValue = this.getMinValue();
    const newValue = Math.max(current - 1, minValue);
    this.input.value = newValue;
    
    // Dispatch change event
    this.input.dispatchEvent(new Event('change'));
    this.updateButtonStates();
    
    // Re-enable buttons after debounce delay
    setTimeout(() => {
      this._buttonClickInProgress = false;
      this.enableButtons();
    }, 300);
  }
}


class GiftBlock extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.input = document.querySelector('input[name="quantity"]');
    this.observeInputChanges();
    this.observeVariantChange();
    this.observePackChanges();
    this.checkGifts();
  }

  observeInputChanges() {
    if (!this.input) return;
    this.input.addEventListener('input', () => this.checkGifts());
    this.input.addEventListener('change', () => this.checkGifts());
  }

  observeVariantChange() {
    const variantInput = document.querySelector('#product-variant-id');
    if (variantInput) {
      variantInput.addEventListener('change', () => this.checkGifts());
    }
  }

  observePackChanges() {
    const pacSection = document.querySelector('pac-section');
    if (pacSection) {
      pacSection.addEventListener('pack:change', () => this.checkGifts());
    }
  }

  async fetchCartData() {
    try {
      const res = await fetch('/cart.js');
      if (!res.ok) throw new Error('Failed to fetch cart');
      const data = await res.json();
      return {
        quantity: data.items.reduce((total, item) => total + item.quantity, 0),
        total_price: data.items.reduce((total, item) => total + item.quantity * item.final_price, 0) // accurate item pricing
      };
    } catch (e) {
      return { quantity: 0, total_price: 0 };
    }
  }

  getSelectedVariantPriceFromJson() {
    const variantIdEl = document.querySelector('#product-variant-id');
    const jsonScript = document.querySelector('#json_prod_var');
    if (!variantIdEl || !jsonScript) return 0;

    try {
      const variantId = parseInt(variantIdEl.value);
      const variants = JSON.parse(jsonScript.textContent);
      const selected = variants.find(v => v.id === variantId);
      return selected ? selected.price : 0;
    } catch (e) {
      return 0;
    }
  }

  async checkGifts() {
    const gifts = this.querySelectorAll('.gift');
    const cart = await this.fetchCartData();
    const localQty = parseInt(this.input?.value || '0', 10);
    const selectedPrice = this.getSelectedVariantPriceFromJson();
    const localTotal = localQty * selectedPrice;
    const combinedQty = localQty + cart.quantity;
    const combinedTotal = localTotal + cart.total_price;

    gifts.forEach(gift => {
      const giftId = gift.dataset.giftid;
      if (!giftId || giftId === '0') return this.lockGift(gift);

      const area = gift.dataset.giftarea;
      const rule = gift.dataset.unlockrulle || 'price';
      const qtyUnlock = parseInt(gift.dataset.qtyunlock || '0', 10);
      const priceUnlock = parseInt(gift.dataset.priceunlock || '0', 10);

      let isUnlocked = false;

      if (area === 'global') {
        if (rule === 'quntity') {
          isUnlocked = qtyUnlock > 0 && combinedQty >= qtyUnlock;
        } else if (rule === 'price') {
          isUnlocked = priceUnlock > 0 && combinedTotal >= priceUnlock;
        }
      } else if (area === 'local') {
        if (rule === 'quntity') {
          isUnlocked = qtyUnlock > 0 && localQty >= qtyUnlock;
        } else if (rule === 'price') {
          isUnlocked = priceUnlock > 0 && localTotal >= priceUnlock;
        }
      }

      if (isUnlocked) {
        this.unlockGift(gift);
      } else {
        this.lockGift(gift);
      }
    });
  }
  unlockGift(gift) {
    gift.dataset.locked = 'false';
    const customImg = gift.dataset.giftimg?.trim();
    const productImg = gift.dataset.giftproductimg?.trim();

    // Check if URL is valid (not empty and has actual path before query params)
    const isValidUrl = (url) => {
      if (!url || url === '') return false;
      // Check for Liquid error messages
      if (url.includes('Liquid error') || url.includes('invalid url input')) return false;
      // Shopify returns URLs like "?width=400" when no image exists
      if (url.startsWith('?')) return false;
      // Check if there's actual content before the query params
      const pathPart = url.split('?')[0];
      return pathPart && pathPart.length > 0;
    };

    const imgSrc = isValidUrl(customImg) ? customImg :
      isValidUrl(productImg) ? productImg : null;

    const wrapper = gift.querySelector('.gift-image');

    if (imgSrc && wrapper) {
      // Add onerror handler to show placeholder if image fails to load
      wrapper.innerHTML = `<img src="${imgSrc}" alt="Gift" onerror="this.style.display='none'; this.parentElement.innerHTML='<svg width=\\'60\\' height=\\'60\\' viewBox=\\'0 0 60 60\\' fill=\\'none\\'><rect width=\\'60\\' height=\\'60\\' fill=\\'#f0f0f0\\'/><path d=\\'M30 20v20M20 30h20\\' stroke=\\'#999\\' stroke-width=\\'2\\'/></svg><div style=\\'color: #666; font-size: 12px; margin-top: 8px;\\'>Gift Image</div>';">`;
    } else if (wrapper) {
      // No valid image URL, show placeholder
      wrapper.innerHTML = `<svg width="60" height="60" viewBox="0 0 60 60" fill="none"><rect width="60" height="60" fill="#f0f0f0"/><path d="M30 20v20M20 30h20" stroke="#999" stroke-width="2"/></svg><div style="color: #666; font-size: 12px; margin-top: 8px;">Gift Image</div>`;
    }
  }


  lockGift(gift) {
    gift.dataset.locked = 'true';
    const wrapper = gift.querySelector('.gift-image');
    const maney = gift.dataset.priceunlock;
    const customLockImg = this.dataset.lockimg?.trim();

    if (wrapper) {
      if (customLockImg && customLockImg !== '') {
        // Use custom lock image
        wrapper.innerHTML = this.lockCustomImage(customLockImg, maney);
      } else {
        // Use default SVG lock icon
        wrapper.innerHTML = this.lockSVG(maney);
      }
    }
  }

  lockCustomImage(imgSrc, maney) {
    return `<img src="${imgSrc}" alt="Locked" style="max-width: 100px; max-height: 100px;">
            <div>Spend ${Shopify.formatMoney(maney, CartJS.settings.moneyFormat)} to unlock</div>`;
  }

  lockSVG(maney) {
    this
    return `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="23.5" fill="white" stroke="black"/>
            <path d="M30.75 34.3184H17.25C16.6533 34.3184 16.081 34.0813 15.659 33.6593C15.2371 33.2374 15 32.6651 15 32.0684V23.8184C15 23.2216 15.2371 22.6493 15.659 22.2274C16.081 21.8054 16.6533 21.5684 17.25 21.5684H30.75C31.3467 21.5684 31.919 21.8054 32.341 22.2274C32.7629 22.6493 33 23.2216 33 23.8184V32.0684C33 32.6651 32.7629 33.2374 32.341 33.6593C31.919 34.0813 31.3467 34.3184 30.75 34.3184ZM17.25 23.0684C17.0511 23.0684 16.8603 23.1474 16.7197 23.288C16.579 23.4287 16.5 23.6194 16.5 23.8184V32.0684C16.5 32.2673 16.579 32.458 16.7197 32.5987C16.8603 32.7393 17.0511 32.8184 17.25 32.8184H30.75C30.9489 32.8184 31.1397 32.7393 31.2803 32.5987C31.421 32.458 31.5 32.2673 31.5 32.0684V23.8184C31.5 23.6194 31.421 23.4287 31.2803 23.288C31.1397 23.1474 30.9489 23.0684 30.75 23.0684H17.25Z" fill="#101820"/>
            <path d="M30 23.0684H18C17.8011 23.0684 17.6103 22.9893 17.4697 22.8487C17.329 22.708 17.25 22.5173 17.25 22.3184V17.8184C17.25 16.2271 17.8821 14.7009 19.0074 13.5757C20.1326 12.4505 21.6587 11.8184 23.25 11.8184H24.75C26.3413 11.8184 27.8674 12.4505 28.9926 13.5757C30.1179 14.7009 30.75 16.2271 30.75 17.8184V22.3184C30.75 22.5173 30.671 22.708 30.5303 22.8487C30.3897 22.9893 30.1989 23.0684 30 23.0684ZM18.75 21.5684H29.25V17.8184C29.25 16.6249 28.7759 15.4803 27.932 14.6364C27.0881 13.7925 25.9435 13.3184 24.75 13.3184H23.25C22.0565 13.3184 20.9119 13.7925 20.068 14.6364C19.2241 15.4803 18.75 16.6249 18.75 17.8184V21.5684Z" fill="#101820"/>
            <path d="M24 28.3184C23.7033 28.3184 23.4133 28.2304 23.1666 28.0656C22.92 27.9007 22.7277 27.6665 22.6142 27.3924C22.5006 27.1183 22.4709 26.8167 22.5288 26.5257C22.5867 26.2348 22.7296 25.9675 22.9393 25.7577C23.1491 25.5479 23.4164 25.4051 23.7074 25.3472C23.9983 25.2893 24.2999 25.319 24.574 25.4325C24.8481 25.5461 25.0824 25.7383 25.2472 25.985C25.412 26.2317 25.5 26.5217 25.5 26.8184C25.5 27.2162 25.342 27.5977 25.0607 27.879C24.7794 28.1603 24.3978 28.3184 24 28.3184Z" fill="#101820"/>
            <path d="M24.75 27.5684H23.25V30.5684H24.75V27.5684Z" fill="#101820"/>
          </svg>
          <div>Spend ${Shopify.formatMoney(maney, CartJS.settings.moneyFormat)} to unlock</div>
          `;
  }
}

// Helper function to update cart icon directly (fix for cart icon update issue)
function updateCartIconDirectly(itemCount) {
  const cartCountBubble = document.querySelector('.cart-count-bubble span[aria-hidden="true"]');
  const headerCartCount = document.querySelector('.header__cart-count');
  const cartLinkBubble = document.querySelector('.cart-link__bubble');
  
  if (cartCountBubble) {
    if (itemCount > 0 && itemCount < 100) {
      cartCountBubble.textContent = itemCount;
    } else if (itemCount >= 100) {
      cartCountBubble.textContent = '99+';
    } else {
      cartCountBubble.textContent = '';
    }
  }
  
  if (headerCartCount) {
    headerCartCount.textContent = itemCount || 0;
  }
  
  if (cartLinkBubble) {
    if (itemCount > 0) {
      cartLinkBubble.classList.add('cart-link__bubble--visible');
    } else {
      cartLinkBubble.classList.remove('cart-link__bubble--visible');
    }
  }
}

class AddCardProd extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const form = this.querySelector('form.form_add_cartp');
    if (!form) return;

    // Create error message container if it doesn't exist
    let errorContainer = form.querySelector('.cart-error-message');
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.className = 'cart-error-message';
      errorContainer.setAttribute('role', 'alert');
      errorContainer.setAttribute('aria-live', 'polite');
      // Apply inline styles for error message - stacked below button
      errorContainer.style.cssText = `
        display: none;
        margin-top: 12px;
        padding: 12px 16px;
        background-color: #fff5f5;
        border: 1px solid #feb2b2;
        border-left: 4px solid #f56565;
        border-radius: 6px;
        color: #c53030;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 400;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        width: 100%;
        clear: both;
      `;
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        // Find the button's parent container (could be add-card-prod or a wrapper)
        let insertTarget = submitBtn.parentElement;

        // If button is inside add-card-prod, insert after add-card-prod
        const addCardProd = submitBtn.closest('add-card-prod');
        if (addCardProd && addCardProd.parentNode) {
          insertTarget = addCardProd;
        }

        // Insert error container after the target element to ensure it's below
        if (insertTarget && insertTarget.parentNode) {
          insertTarget.parentNode.insertBefore(errorContainer, insertTarget.nextSibling);
        } else {
          // Fallback: append to form
          form.appendChild(errorContainer);
        }
      } else {
        form.appendChild(errorContainer);
      }
    }

    const showError = (message) => {
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
      // Scroll to error if needed
      errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const hideError = () => {
      errorContainer.style.display = 'none';
      errorContainer.textContent = '';
    };

    const resetQuantity = () => {
      const quantityInput = document.querySelector('quantity-inputs input[name="quantity"]');
      if (quantityInput) {
        const minValue = quantityInput.getAttribute('min');
        const resetValue = minValue ? parseInt(minValue, 10) : 1;
        quantityInput.value = resetValue;
        quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Clear any previous errors
      hideError();

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const variantInput = document.querySelector('#product-variant-id');
      const quantityInput = document.querySelector('quantity-inputs input[name="quantity"]');
      const variantId = variantInput?.value;
      const qta = parseInt(quantityInput?.value || '1', 10);

      if (!variantInput || variantInput.disabled || !variantId || isNaN(qta) || qta <= 0) {
        showError('Please select a valid product variant and quantity.');
        resetQuantity();
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const items = [];

      // ✅ Add main product
      const mainVariant = parseInt(variantId, 10);
      if (!isNaN(mainVariant)) {
        const mainItem = { id: mainVariant, quantity: qta };
        items.push(mainItem);
      } else {
        showError('Main product variant is invalid.');
        resetQuantity();
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // ✅ Add unlocked gifts if present
      document.querySelectorAll('.gift[data-locked="false"]').forEach(gift => {
        const giftId = gift.dataset.giftid;
        if (giftId && giftId !== '0') {
          const parsedId = parseInt(giftId, 10);
          if (!isNaN(parsedId)) {
            const giftItem = { id: parsedId, quantity: 1 };
            items.push(giftItem);
          }
        }
      });

      // ✅ Add checked addons if present
      // Search in the entire document, not just within the form, to catch addons in product sections
      const addonItems = document.querySelectorAll('.product-addons__item:not(.product-addons__item--placeholder)');

      addonItems.forEach((addon, index) => {
        const checkbox = addon.querySelector('.product-addons__toggle');
        const addonId = addon.dataset.variantId || addon.getAttribute('data-variant-id');

        if (checkbox && !checkbox.disabled && checkbox.checked && addonId) {
          const parsedAddonId = parseInt(addonId, 10);
          if (!isNaN(parsedAddonId)) {
            const addonItem = { id: parsedAddonId, quantity: 1 };
            items.push(addonItem);
          }
        }
      });

      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Extract error message from Shopify response
          let errorMessage = 'Unable to add items to cart.';
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.description) {
            errorMessage = errorData.description;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }

          // Show user-friendly error message below the button
          showError(errorMessage);
          resetQuantity();
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        const result = await response.json();

        // Clear any errors on success
        hideError();

        // Refresh CartJS to update cart drawer (fix for theme editor issue)
        if (typeof CartJS !== 'undefined' && typeof CartJS.getCart === 'function') {
          CartJS.getCart({
            success: (cart) => {
              // CRITICAL: Update CartJS.cart object properly for Rivets.js (fix for theme editor items not showing)
              // Rivets.js needs to see the change, so we update in place rather than replacing the object
              if (cart) {
                if (!CartJS.cart) {
                  CartJS.cart = {};
                }
                // Update all cart properties in place
                Object.keys(cart).forEach(key => {
                  if (key === 'items' && Array.isArray(cart.items)) {
                    // For items array, replace it completely to trigger Rivets.js rv-each
                    CartJS.cart.items = cart.items;
                  } else {
                    CartJS.cart[key] = cart[key];
                  }
                });
              }
              
              // Update cart icon immediately after adding product (fix for cart icon update issue)
              const cartSlide = document.querySelector('cart-slide');
              if (cartSlide && typeof cartSlide.updateCartIconCount === 'function') {
                cartSlide.updateCartIconCount(cart.item_count || 0);
              } else {
                // Fallback: update cart icon directly if cart-slide is not available
                updateCartIconDirectly(cart.item_count || 0);
              }
              
              // Trigger cart.requestComplete event for Rivets.js updates (after CartJS.cart is updated)
              if (typeof jQuery !== 'undefined') {
                jQuery(document).trigger('cart.requestComplete', [cart]);
              }
              
              // Refresh and open cart drawer (fix for theme editor PDP issue)
              if (cartSlide) {
                // Refresh cart drawer immediately
                if (typeof cartSlide.refreshCart === 'function') {
                  cartSlide.refreshCart();
                }
                
                // Use a delay to ensure Rivets.js updates before opening (theme editor fix)
                // Longer delay for theme editor to ensure proper updates
                const delay = (typeof Shopify !== 'undefined' && Shopify.designMode) ? 500 : 200;
                setTimeout(() => {
                  // Force refresh again to ensure Rivets.js has updated (theme editor fix)
                  if (typeof cartSlide.refreshCart === 'function') {
                    cartSlide.refreshCart();
                  }
                  // In theme editor, trigger another cart.requestComplete to force Rivets.js update
                  if (typeof Shopify !== 'undefined' && Shopify.designMode && cart) {
                    if (typeof CartJS !== 'undefined') {
                      CartJS.cart = cart;
                    }
                    if (typeof jQuery !== 'undefined') {
                      jQuery(document).trigger('cart.requestComplete', [cart]);
                    }
                  }
                  // Open cart drawer if it's not already open
                  if (typeof cartSlide.toggleCart === 'function' && !cartSlide.classList.contains('active')) {
                    cartSlide.toggleCart();
                  }
                }, delay);
              }
            }
          });
        } else {
          // Fallback: update cart icon even if CartJS is not available
          if (result && result.item_count !== undefined) {
            updateCartIconDirectly(result.item_count);
          } else {
            // Fetch cart to get item count
            fetch('/cart.js')
              .then(response => response.json())
              .then(cart => {
                updateCartIconDirectly(cart.item_count || 0);
                // Try to refresh cart drawer even without CartJS
                const cartSlide = document.querySelector('cart-slide');
                if (cartSlide) {
                  if (typeof cartSlide.refreshCart === 'function') {
                    cartSlide.refreshCart();
                  }
                  if (typeof cartSlide.toggleCart === 'function' && !cartSlide.classList.contains('active')) {
                    cartSlide.toggleCart();
                  }
                }
              })
              .catch(() => {
                // Silently fail
              });
          }
        }
        resetQuantity();
        if (submitBtn) submitBtn.disabled = false;
      } catch (error) {
        showError('An error occurred while adding items to cart. Please try again.');
        resetQuantity();
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", (event) => {


  customElements.define('custom-variant', customVariant);
  customElements.define('pac-section', PacSection);
  // 🛡 Проверка: не регистрировать повторно, если уже определено
  if (!customElements.get('quantity-inputs')) {
    customElements.define('quantity-inputs', QuantityInputs);
  }

  if (!customElements.get('gift-block')) {
    customElements.define('gift-block', GiftBlock);
  }

  if (!customElements.get('add-card-prod')) {
    customElements.define('add-card-prod', AddCardProd);
  }

})