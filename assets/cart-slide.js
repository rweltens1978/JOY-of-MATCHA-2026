(function () {
  if (customElements.get('cart-slide')) return;

  // Debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  class CartSlide extends HTMLElement {
    constructor() {
      super();
      this.timerInterval = null;
      this.reserveEndTime = null;
      this.reserveTimeRemaining = null;
      this._discountUpdateInProgress = false;
      this._quantityUpdateInProgress = new Set(); // Track which variants are being updated
      this.setupPolicyAgreement();
    }

    connectedCallback() {
      this.setupListeners();
      this.refreshCart();
      this.toggleCart = this.toggleCart.bind(this);
    }

    setupListeners() {
      const closeBtn = this.querySelector('.cart-slide__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.toggleCart();
        });
      }

      const overlay = document.getElementById('cart-overlay');
      if (overlay) {
        overlay.addEventListener('click', () => {
          this.toggleCart();
        });
      }



      // Debounced quantity update function
      this.debouncedQuantityUpdate = debounce((variantId, newQty, inputElement) => {
        if (typeof CartJS === 'undefined' || !CartJS.cart || !CartJS.cart.items) {
          this._quantityUpdateInProgress.delete(variantId);
          this.reEnableButtonsForVariant(variantId);
          return;
        }

        const cartItem = CartJS.cart.items.find(item => item.variant_id === variantId);
        
        // If item not found and newQty > 0, try to add it back (fix for issue #2)
        if (!cartItem && newQty > 0) {
          CartJS.addItem(variantId, newQty, {}, {
            success: (cart) => {
              this.hideErrorForVariant(variantId);
              this._quantityUpdateInProgress.delete(variantId);
              this.reEnableButtonsForVariant(variantId);
              // Update input value to match actual quantity added (fix for issue #2 & #3)
              if (cart && cart.items && inputElement) {
                const addedItem = cart.items.find(item => item.variant_id === variantId);
                if (addedItem) {
                  inputElement.value = addedItem.quantity;
                }
              }
              // Update cart icon count
              if (cart && cart.item_count !== undefined) {
                this.updateCartIconCount(cart.item_count);
              }
              this.refreshCart();
            },
            error: (err) => {
              // If add fails, check what quantity is actually in cart
              if (typeof CartJS !== 'undefined' && CartJS.cart && CartJS.cart.items) {
                const actualItem = CartJS.cart.items.find(item => item.variant_id === variantId);
                if (actualItem && inputElement) {
                  inputElement.value = actualItem.quantity;
                  this.handleQuantityUpdateError(variantId, err, inputElement, actualItem.quantity);
                } else {
                  this.handleQuantityUpdateError(variantId, err, inputElement, 0);
                }
              } else {
                this.handleQuantityUpdateError(variantId, err, inputElement, 0);
              }
            }
          });
          return;
        }
        
        // If item not found and newQty is 0 or less, nothing to do
        if (!cartItem) {
          this._quantityUpdateInProgress.delete(variantId);
          this.reEnableButtonsForVariant(variantId);
          return;
        }

        // Special case: If item exists but has quantity 0 and we're trying to increment to 1,
        // we need to add it back instead of updating (fix for quantity 0 + button issue)
        if (cartItem && cartItem.quantity === 0 && newQty > 0) {
          // Item was set to 0 but still exists in cart, add it back with new quantity
          CartJS.addItem(variantId, newQty, {}, {
            success: (cart) => {
              this.hideErrorForVariant(variantId);
              this._quantityUpdateInProgress.delete(variantId);
              this.reEnableButtonsForVariant(variantId);
              // Update input value to match actual quantity added
              if (cart && cart.items && inputElement) {
                const addedItem = cart.items.find(item => item.variant_id === variantId);
                if (addedItem) {
                  inputElement.value = addedItem.quantity;
                }
              }
              // Update cart icon count
              if (cart && cart.item_count !== undefined) {
                this.updateCartIconCount(cart.item_count);
              }
              this.refreshCart();
            },
            error: (err) => {
              // If add fails, try to get fresh cart state
              if (typeof CartJS !== 'undefined' && typeof CartJS.getCart === 'function') {
                CartJS.getCart({
                  success: (freshCart) => {
                    const actualItem = freshCart.items.find(item => item.variant_id === variantId);
                    if (actualItem && inputElement) {
                      inputElement.value = actualItem.quantity;
                      this.handleQuantityUpdateError(variantId, err, inputElement, actualItem.quantity);
                    } else {
                      this.handleQuantityUpdateError(variantId, err, inputElement, 0);
                    }
                  },
                  error: () => {
                    this.handleQuantityUpdateError(variantId, err, inputElement, 0);
                  }
                });
              } else {
                this.handleQuantityUpdateError(variantId, err, inputElement, 0);
              }
            }
          });
          return;
        }

        // If quantity is 0 or less, remove the item from cart
        if (newQty <= 0) {
          // Re-fetch cart to ensure we have the latest state before calculating line number (fix for issue #3)
          CartJS.getCart({
            success: (freshCart) => {
              // Find the item in the fresh cart to get the correct line number
              const freshCartItem = freshCart.items.find(item => item.variant_id === variantId);
              if (!freshCartItem) {
                // Item already removed, nothing to do
                this._quantityUpdateInProgress.delete(variantId);
                this.reEnableButtonsForVariant(variantId);
                this.refreshCart();
                return;
              }
              
              const line = freshCart.items.indexOf(freshCartItem) + 1;
              if (!line || line <= 0) {
                this._quantityUpdateInProgress.delete(variantId);
                this.reEnableButtonsForVariant(variantId);
                return;
              }

              CartJS.updateItem(line, 0, {}, {
                success: (updatedCart) => {
                  // Hide any error messages on success
                  this.hideErrorForVariant(variantId);
                  this._quantityUpdateInProgress.delete(variantId);
                  this.reEnableButtonsForVariant(variantId);
                  // Update cart icon count (fix for issue #4)
                  if (updatedCart && updatedCart.item_count !== undefined) {
                    this.updateCartIconCount(updatedCart.item_count);
                  }
                  this.refreshCart();
                },
                error: (err) => {
                  this.handleQuantityUpdateError(variantId, err, inputElement, freshCartItem.quantity);
                }
              });
            },
            error: () => {
              // If getCart fails, try with the original cartItem as fallback
              const line = CartJS.cart.items.indexOf(cartItem) + 1;
              if (line && line > 0) {
                CartJS.updateItem(line, 0, {}, {
                  success: (updatedCart) => {
                    this.hideErrorForVariant(variantId);
                    this._quantityUpdateInProgress.delete(variantId);
                    this.reEnableButtonsForVariant(variantId);
                    // Update cart icon count (fix for issue #4)
                    if (updatedCart && updatedCart.item_count !== undefined) {
                      this.updateCartIconCount(updatedCart.item_count);
                    }
                    this.refreshCart();
                  },
                  error: (err) => {
                    this.handleQuantityUpdateError(variantId, err, inputElement, cartItem.quantity);
                  }
                });
              } else {
                this._quantityUpdateInProgress.delete(variantId);
                this.reEnableButtonsForVariant(variantId);
              }
            }
          });
          return;
        }

        CartJS.updateItemById(variantId, newQty, {}, {
          success: (updatedCart) => {
            // Hide any error messages on success
            this.hideErrorForVariant(variantId);
            this._quantityUpdateInProgress.delete(variantId);
            this.reEnableButtonsForVariant(variantId);
            // Update input value to match actual cart quantity (fix for issue #2 & #3)
            if (updatedCart && updatedCart.items) {
              const updatedItem = updatedCart.items.find(item => item.variant_id === variantId);
              if (updatedItem && inputElement) {
                inputElement.value = updatedItem.quantity;
              }
            }
            // Update cart icon count
            if (updatedCart && updatedCart.item_count !== undefined) {
              this.updateCartIconCount(updatedCart.item_count);
            }
            this.refreshCart();
          },
          error: (err) => {
            // When error occurs (e.g., max limit reached), sync input with actual cart quantity
            // First, get fresh cart to see what quantity was actually set
            if (typeof CartJS !== 'undefined' && CartJS.cart && CartJS.cart.items) {
              const actualItem = CartJS.cart.items.find(item => item.variant_id === variantId);
              if (actualItem && inputElement) {
                // Update input to show actual quantity in cart (fix for issue #2 & #3)
                inputElement.value = actualItem.quantity;
                this.handleQuantityUpdateError(variantId, err, inputElement, actualItem.quantity);
              } else {
                this.handleQuantityUpdateError(variantId, err, inputElement, cartItem.quantity);
              }
            } else {
              this.handleQuantityUpdateError(variantId, err, inputElement, cartItem.quantity);
            }
          }
        });
      }, 300); // 300ms debounce delay

      // Handle quantity input changes
      this.addEventListener('change', (e) => {
        const target = e.target;

        // Check if CartJS is available
        if (typeof CartJS === 'undefined' || !CartJS.cart || !CartJS.cart.items) {
          return;
        }

        // Handle quantity input field changes
        if (target.classList.contains('cart-qty-input')) {
          // Get variant ID from data attribute (Rivets.js converts rv-data-* to data-*)
          const variantId = parseInt(target.dataset.variantId || target.getAttribute('data-variant-id'), 10);
          let newQty = parseInt(target.value, 10);

          if (!variantId || isNaN(newQty)) {
            // Reset to current quantity if invalid
            const cartItem = CartJS.cart.items.find(item => item.variant_id === variantId);
            if (cartItem) {
              target.value = cartItem.quantity;
            }
            return;
          }

          // Check if update is already in progress
          if (this._quantityUpdateInProgress.has(variantId)) {
            return;
          }

          // Ensure quantity doesn't exceed max (if set)
          if (target.max && newQty > parseInt(target.max, 10)) {
            const maxValue = parseInt(target.max, 10);
            newQty = maxValue;
            target.value = newQty;
          }

          // Mark as in progress and debounce the update
          this._quantityUpdateInProgress.add(variantId);
          this.debouncedQuantityUpdate(variantId, newQty, target);
        }

        // Handle old cart-qty-selector (dropdown) for backward compatibility
        if (target.classList.contains('cart-qty-selector')) {
          const variantId = parseInt(target.dataset.variantId || target.getAttribute('data-variant-id'), 10);
          const newQty = parseInt(target.value, 10);
          if (!variantId || isNaN(newQty)) return;

          const cartItem = CartJS.cart.items.find(item => item.variant_id === variantId);
          if (!cartItem) return;

          CartJS.updateItemById(variantId, newQty, {}, {
            success: () => {
              this.refreshCart();
            },
            error: (err) => {
              // Reset to current quantity on error
              target.value = cartItem.quantity;
            }
          });
        }

        // Handle addon toggles
        if (e.target.classList.contains('product-addons__toggle')) {
          const variantId = e.target.closest('.product-addons__item')?.dataset.variantId;
          if (variantId) {
            this.toggleAddon(variantId, e.target.checked);
          }
        }
      });

      // Handle quantity button clicks (plus/minus) with debouncing
      this.addEventListener('click', (e) => {
        const target = e.target.closest('.cart-qty-btn');

        if (target) {
          e.preventDefault();
          e.stopPropagation();
          
          const isPlus = target.classList.contains('cart-qty-plus');
          const isMinus = target.classList.contains('cart-qty-minus');
          
          // Get variant ID from data attribute (Rivets.js converts rv-data-* to data-*)
          const variantId = parseInt(target.dataset.variantId || target.getAttribute('data-variant-id'), 10);
          if (!variantId) {
            return;
          }

          // Check if update is already in progress for this variant
          if (this._quantityUpdateInProgress.has(variantId)) {
            return;
          }

          const input = target.parentElement.querySelector('.cart-qty-input');
          if (!input) {
            return;
          }

          // Disable buttons during update
          const buttons = target.parentElement.querySelectorAll('.cart-qty-btn');
          buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
          });

          // Properly parse current quantity, handling 0 correctly (fix for quantity 0 + button issue)
          const parsedValue = parseInt(input.value, 10);
          const currentQty = isNaN(parsedValue) ? 1 : parsedValue;
          let newQty;

          if (isPlus) {
            // If quantity is 0 or less, set to 1 (fix for quantity 0 + button issue)
            // This ensures that when user sets quantity to 0 and clicks +, it increments to 1
            newQty = currentQty <= 0 ? 1 : currentQty + 1;
            // Check max if set
            if (input.max && newQty > parseInt(input.max, 10)) {
              const maxValue = parseInt(input.max, 10);
              newQty = maxValue;
            }
          } else if (isMinus) {
            // Allow going to 0 to remove item
            newQty = Math.max(0, currentQty - 1);
          }

          input.value = newQty;
          
          // Mark as in progress
          this._quantityUpdateInProgress.add(variantId);
          
          // Debounced update
          this.debouncedQuantityUpdate(variantId, newQty, input);
          
          // Re-enable buttons after a short delay (will be properly re-enabled after update completes)
          setTimeout(() => {
            if (!this._quantityUpdateInProgress.has(variantId)) {
              buttons.forEach(btn => {
                btn.disabled = false;
                btn.style.pointerEvents = '';
                btn.style.opacity = '';
              });
            }
          }, 350);
        }
      });

      const discountBtn = this.querySelector('.cart-slide__btn');
      if (discountBtn) {
        discountBtn.addEventListener('click', () => {
          this.applyDiscount();
        });
      }

      const checkoutBtn = this.querySelector('.cart-slide__checkout-btn');

      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', (e) => {
          e.preventDefault();

          const noteWrapper = this.querySelector('.cart-slide__note');
          const noteTextarea = noteWrapper?.querySelector('.cart-slide__textarea');
          const note = noteTextarea?.value?.trim();

          const saveNote = () => {
            return new Promise((resolve) => {
              if (noteWrapper && typeof CartJS.setNote === 'function') {
                CartJS.setNote(note || '', {
                  success: () => {
                    resolve();
                  },
                  error: (error) => {
                    resolve();
                  }
                });
              } else {
                resolve();
              }
            });
          };

          const proceedToCheckout = () => {
            const discountBlock = this.querySelector('[data-unlockdiscount][data-unlockship]');
            const discountCode = discountBlock?.dataset.code?.toLowerCase();
            const isUnlocked = discountBlock?.classList.contains('unlocked');

            if (discountBlock && isUnlocked && discountCode) {
              this._discountUpdateInProgress = true;
              this.applyDiscountViaIframe(discountCode)
                .then(() => setTimeout(() => this.handleCheckout(), 500))
                .catch(err => {
                  this.handleCheckout();
                })
                .finally(() => {
                  this._discountUpdateInProgress = false;
                });
            } else {
              this.handleCheckout();
            }
          };

          const handleGiftThenCheckout = () => {
            const giftBlock = document.querySelector('gift-block-cart');
            const giftContainer = giftBlock?.querySelector('.cart-slide__gift-item');
            const isGiftUnlocked = giftContainer && !giftContainer.classList.contains('cart-slide__gift-item--locked');
            const giftVariantId = giftBlock?.dataset.giftid;
            if (giftBlock && isGiftUnlocked && giftVariantId) {
              if (typeof CartJS !== 'undefined' && CartJS.cart && CartJS.cart.items) {
                const giftQuntity = CartJS.cart.items.find(item => item.variant_id === parseInt(giftVariantId, 10));

                if (giftQuntity && giftQuntity.quantity > 1) {
                  CartJS.updateItemById(giftVariantId, 1, {}, {
                    success: () => proceedToCheckout(),
                    error: (err) => {
                      proceedToCheckout();
                    }
                  });
                } else {
                  CartJS.addItem(giftVariantId, 1, {}, {
                    success: () => {
                      proceedToCheckout();
                    },
                    error: (err) => {
                      proceedToCheckout();
                    }
                  });
                }
              } else {
                proceedToCheckout();
              }
            } else {
              proceedToCheckout();
            }
          };

          saveNote().then(() => {
            handleGiftThenCheckout();
          });
        });
      }

      jQuery(document).on('cart.requestComplete', (event, cart) => {
        this.updateGoals(cart);
        this.toogleCheckout();
        // Update cart icon count when cart updates (fix for issue #4)
        if (cart && cart.item_count !== undefined) {
          this.updateCartIconCount(cart.item_count);
        }
        // Sync quantity inputs with actual cart quantities (fix for issue #2 & #3)
        if (cart && cart.items) {
          this.syncQuantityInputs(cart);
        }
        // Restore images when cart updates via CartJS (fix for issue #1)
        this.restoreCartImages();
        // Ensure CartJS cart object is updated (fix for theme editor issue)
        // This helps Rivets.js bindings update correctly in theme editor
        if (typeof CartJS !== 'undefined' && CartJS.cart && cart) {
          // Update CartJS.cart with fresh data to ensure Rivets.js sees the changes
          CartJS.cart = cart;
        }
      });
    }

    toogleCheckout() {
      const checkbox = this.querySelector('.cart-slide__policy input[type="checkbox"]');
      const checkoutBtn = this.querySelector('.cart-slide__checkout-btn');
      const emptyMsg = this.querySelector('.cart-slide_empty_cart');

      if (!checkbox || !checkoutBtn) return;

      if (typeof CartJS === 'undefined' || !CartJS.cart) {
        checkoutBtn.disabled = true;
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
      }

      const cartNotEmpty = CartJS.cart.item_count > 0;
      const policyChecked = checkbox?.checked;

      checkoutBtn.disabled = !(cartNotEmpty && policyChecked);

      if (emptyMsg) {
        if (!cartNotEmpty) {
          emptyMsg.style.display = 'block';
        } else {
          emptyMsg.style.display = 'none';
        }
      }
    }

    toggleCart() {
      let overlay = document.getElementById('cart-overlay');
      
      // Create overlay if it doesn't exist
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cart-overlay';
        overlay.className = 'cart-overlay';
        document.body.appendChild(overlay);
        
        // Add click listener to close cart when overlay is clicked
        overlay.addEventListener('click', () => {
          this.toggleCart();
        });
      }

      const isOpening = !this.classList.contains('active');
      
      this.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');

      if (this.classList.contains('active')) {
        // Clear any stale images before refreshing (fix for issue #1)
        this.clearStaleCartImages();
        this.startReserveTimer(5 * 60);
        // Refresh cart immediately when opening (fix for theme editor issue)
        // Force refresh to ensure latest cart data is displayed
        this.refreshCart();
        // Also ensure CartJS is up to date
        if (typeof CartJS !== 'undefined' && typeof CartJS.getCart === 'function') {
          CartJS.getCart({
            success: (cart) => {
              // Trigger cart.requestComplete event for Rivets.js updates
              if (typeof jQuery !== 'undefined') {
                jQuery(document).trigger('cart.requestComplete', [cart]);
              }
            }
          });
        }
      } else {
        this.pauseTimer();
        // Clear all error messages when closing (fix for issue #4)
        this.clearAllErrors();
      }
    }

    clearStaleCartImages() {
      // Clear all cart item images to prevent showing wrong product image (fix for issue #1)
      const cartItemImages = this.querySelectorAll('.cart-item-image img');
      cartItemImages.forEach(img => {
        // Set a placeholder or clear the src temporarily
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';
      });
    }

    clearAllErrors() {
      // Clear all error messages when cart closes (fix for issue #4)
      const allErrorContainers = this.querySelectorAll('[data-render-error]');
      allErrorContainers.forEach(container => {
        container.textContent = '';
        container.classList.add('hidden');
      });
    }

    handleQuantityUpdateError(variantId, err, inputElement, fallbackQuantity) {
      // Extract error message from CartJS error response
      let errorMessage = '';
      
      // CartJS error can be in different formats
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && err.responseJSON) {
        // Handle jQuery-style error with responseJSON
        if (err.responseJSON.description) {
          errorMessage = err.responseJSON.description;
        } else if (err.responseJSON.message) {
          errorMessage = err.responseJSON.message;
        }
      } else if (err && err.description) {
        errorMessage = err.description;
      } else if (err && err.message) {
        errorMessage = err.message;
      }
      
      // Display error message if available (fix for issue #4 - ensure correct variant)
      if (errorMessage) {
        this.showErrorForVariant(variantId, errorMessage);
      }
      
      this._quantityUpdateInProgress.delete(variantId);
      // Reset to current quantity on error
      if (inputElement && fallbackQuantity !== undefined) {
        inputElement.value = fallbackQuantity;
      }
      // Re-enable buttons after error (fix for issue #5)
      this.reEnableButtonsForVariant(variantId);
    }

    reEnableButtonsForVariant(variantId) {
      // Find all buttons for this variant and re-enable them
      const input = this.querySelector(`.cart-qty-input[data-variant-id="${variantId}"]`);
      if (input) {
        const qtyWrapper = input.closest('.cart-quantity-input');
        if (qtyWrapper) {
          const buttons = qtyWrapper.querySelectorAll('.cart-qty-btn');
          buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = '';
            btn.style.opacity = '';
          });
        }
      }
    }

    showErrorForVariant(variantId, errorMessage) {
      // First, clear all error messages to prevent showing on wrong products (fix for issue #4)
      const allErrorContainers = this.querySelectorAll('[data-render-error]');
      allErrorContainers.forEach(container => {
        container.textContent = '';
        container.classList.add('hidden');
      });
      
      // Find error container for this variant
      // Rivets.js converts rv-data-variant-id to data-variant-id at runtime
      const errorContainers = this.querySelectorAll('[data-render-error]');
      let errorContainer = null;
      
      // Find the error container that matches this variant ID
      errorContainers.forEach(container => {
        // Try multiple ways to get the variant ID (Rivets.js may have converted it)
        const rvAttr = container.getAttribute('rv-data-variant-id');
        const dataAttr = container.dataset.variantId || container.getAttribute('data-variant-id');
        const containerVariantId = parseInt(rvAttr || dataAttr, 10);
        
        if (containerVariantId === variantId) {
          errorContainer = container;
        }
      });
      
      // If not found by variant ID, try to find by parent input element
      if (!errorContainer) {
        const input = this.querySelector(`.cart-qty-input[data-variant-id="${variantId}"]`);
        if (input) {
          const qtyWrapper = input.closest('.cart-item-qty-wrapper');
          if (qtyWrapper) {
            errorContainer = qtyWrapper.querySelector('[data-render-error]');
          }
        }
      }
      
      if (errorContainer) {
        errorContainer.textContent = errorMessage;
        errorContainer.classList.remove('hidden');
      }
    }

    hideErrorForVariant(variantId) {
      // Find error container for this variant
      const errorContainers = this.querySelectorAll('[data-render-error]');
      
      errorContainers.forEach(container => {
        const rvAttr = container.getAttribute('rv-data-variant-id');
        const dataAttr = container.dataset.variantId || container.getAttribute('data-variant-id');
        const containerVariantId = parseInt(rvAttr || dataAttr, 10);
        
        if (containerVariantId === variantId) {
          container.textContent = '';
          container.classList.add('hidden');
        }
      });
      
      // Also try to find by parent input element
      const input = this.querySelector(`.cart-qty-input[data-variant-id="${variantId}"]`);
      if (input) {
        const qtyWrapper = input.closest('.cart-item-qty-wrapper');
        if (qtyWrapper) {
          const errorContainer = qtyWrapper.querySelector('[data-render-error]');
          if (errorContainer) {
            errorContainer.textContent = '';
            errorContainer.classList.add('hidden');
          }
        }
      }
    }

    updateCartIconCount(itemCount) {
      // Update cart icon count in header (fix for issue #4)
      // Update or create cart-count-bubble
      let cartCountBubble = document.querySelector('.cart-count-bubble span[aria-hidden="true"]');
      let bubbleContainer = document.querySelector('.cart-count-bubble');
      
      // If bubble doesn't exist and count > 0, create it
      if (!bubbleContainer && itemCount > 0) {
        // Find cart buttons/links by class (matches yas-header.liquid structure)
        const cartElements = document.querySelectorAll('button.cart, a.cart');
        cartElements.forEach(element => {
          const svg = element.querySelector('svg');
          if (svg && !element.querySelector('.cart-count-bubble')) {
            bubbleContainer = document.createElement('div');
            bubbleContainer.className = 'cart-count-bubble';
            const span = document.createElement('span');
            span.setAttribute('aria-hidden', 'true');
            bubbleContainer.appendChild(span);
            element.appendChild(bubbleContainer);
            if (!cartCountBubble) {
              cartCountBubble = span;
            }
          }
        });
      }
      
      if (cartCountBubble) {
        if (itemCount > 0 && itemCount < 100) {
          cartCountBubble.textContent = itemCount;
        } else if (itemCount >= 100) {
          cartCountBubble.textContent = '99+';
        } else {
          cartCountBubble.textContent = '';
        }
      }
      
      // Hide/show all bubble containers if count is 0
      const allBubbleContainers = document.querySelectorAll('.cart-count-bubble');
      allBubbleContainers.forEach(bubble => {
        if (itemCount > 0) {
          bubble.style.display = '';
        } else {
          bubble.style.setProperty('display', 'none', 'important');
        }
      });
      
      const headerCartCount = document.querySelector('.header__cart-count');
      if (headerCartCount) {
        headerCartCount.textContent = itemCount || 0;
      }
      
      const cartLinkBubble = document.querySelector('.cart-link__bubble');
      if (cartLinkBubble) {
        if (itemCount > 0) {
          cartLinkBubble.classList.add('cart-link__bubble--visible');
        } else {
          cartLinkBubble.classList.remove('cart-link__bubble--visible');
        }
      }
    }

    async refreshCart() {
      if (typeof CartJS === 'undefined') {
        return;
      }
      try {
        CartJS.getCart({
          success: (cart) => {
            // Update CartJS.cart object immediately to ensure Rivets.js bindings see the changes (fix for theme editor issue)
            if (cart) {
              CartJS.cart = cart;
            }
            this.updateGoals(cart);
            this.updateShippingBar(cart);
            this.toogleCheckout();
            // Update cart icon count (fix for issue #4)
            this.updateCartIconCount(cart.item_count || 0);
            // Re-enable all quantity buttons after cart refresh
            this._quantityUpdateInProgress.clear();
            const allButtons = this.querySelectorAll('.cart-qty-btn');
            allButtons.forEach(btn => {
              btn.disabled = false;
              btn.style.pointerEvents = '';
              btn.style.opacity = '';
            });
            // Restore image visibility after cart refresh (fix for issue #1)
            this.restoreCartImages();
            // Sync all input values with actual cart quantities (fix for issue #2 & #3)
            this.syncQuantityInputs(cart);
            // Trigger cart.requestComplete event to ensure Rivets.js updates (fix for saving amount display and theme editor)
            if (typeof jQuery !== 'undefined') {
              jQuery(document).trigger('cart.requestComplete', [cart]);
            }
          },
          error: (error) => {
            // Re-enable buttons on error too
            this._quantityUpdateInProgress.clear();
            const allButtons = this.querySelectorAll('.cart-qty-btn');
            allButtons.forEach(btn => {
              btn.disabled = false;
              btn.style.pointerEvents = '';
              btn.style.opacity = '';
            });
            // Restore image visibility even on error
            this.restoreCartImages();
          }
        });
      } catch (error) {
        // Re-enable buttons on error too
        this._quantityUpdateInProgress.clear();
        const allButtons = this.querySelectorAll('.cart-qty-btn');
        allButtons.forEach(btn => {
          btn.disabled = false;
          btn.style.pointerEvents = '';
          btn.style.opacity = '';
        });
        // Restore image visibility even on error
        this.restoreCartImages();
      }
    }

    syncQuantityInputs(cart) {
      // Sync all quantity inputs with actual cart quantities (fix for issue #2 & #3)
      if (!cart || !cart.items) return;
      
      cart.items.forEach(cartItem => {
        const variantId = cartItem.variant_id;
        const input = this.querySelector(`.cart-qty-input[data-variant-id="${variantId}"]`);
        if (input && parseInt(input.value, 10) !== cartItem.quantity) {
          input.value = cartItem.quantity;
        }
      });
    }

    restoreCartImages() {
      // Restore image visibility after cart refresh (fix for issue #1)
      // Wait for Rivets.js to update the DOM before restoring images
      // Use a small delay to ensure DOM updates are complete
      setTimeout(() => {
        const cartItemImages = this.querySelectorAll('.cart-item-image img');
        cartItemImages.forEach(img => {
          // Only restore if image has a valid src (Rivets.js has updated it)
          if (img.src && img.src !== window.location.href) {
            img.style.opacity = '1';
          }
        });
      }, 100); // Small delay to allow Rivets.js to update DOM
    }

    updateShippingBar(cart) {
      const shippingBar = this.querySelector('shipping-bar');
      if (shippingBar && shippingBar.updateCartTotals) {
        shippingBar.updateCartTotals(cart.total_price);
      }
    }

    formatMoney(cents) {
      if (typeof cents !== 'number' || isNaN(cents)) return '$0.00';
      return `$${(cents / 100).toFixed(2)}`;
    }

    updateCartUI(cart) {
      const cartItemsList = this.querySelector('.cart-items-list');
      const cartCount = this.querySelector('[data-count]');
      const cartSubtotal = this.querySelector('[data-subtotal]');
      const cartSavings = this.querySelector('[data-savings]');

      if (!cart || !cart.items) {
        cartItemsList.innerHTML = '<li class="cart-item">Cart is empty</li>';
        cartCount.textContent = '0';
        cartSubtotal.textContent = this.formatMoney(0);
        cartSavings.textContent = this.formatMoney(0);
        return;
      }

      cartCount.textContent = cart.item_count || 0;

      cartSubtotal.textContent = this.formatMoney(cart.total_price);

      let totalSavings = 0;
      cart.items.forEach(item => {
        if (item.original_price > item.final_price) {
          totalSavings += (item.original_price - item.final_price) * item.quantity;
        }
      });
      cartSavings.textContent = this.formatMoney(totalSavings);
    }

    async toggleAddon(variantId, add) {
      if (typeof CartJS === 'undefined') {
        return;
      }
      try {
        if (add) {
          CartJS.addItem(variantId, 1, {}, {
            success: (cart) => {
              // Update cart icon count when addon is added (fix for cart icon update issue)
              if (cart && cart.item_count !== undefined) {
                this.updateCartIconCount(cart.item_count);
              }
            },
            error: (err) => {
            },
            complete: () => {
              this.refreshCart();
            }
          });
        } else {
          if (!CartJS.cart || !CartJS.cart.items) {
            return;
          }
          const item = CartJS.cart.items.find(i => i.variant_id == variantId);

          if (!item) {
            this.refreshCart();
            return;
          }

          const line = CartJS.cart.items.indexOf(item) + 1;

          CartJS.updateItem(line, 0, {}, {
            success: () => {
            },
            error: (err) => {
            },
            complete: () => {
              this.refreshCart();
            }
          });
        }
      } catch (error) {
      }
    }

    async applyDiscount() {
      const discountBlock = this.querySelector('.cart-slide__discount');
      const discountInput = this.querySelector('.cart-slide__input');
      const code = discountInput?.value?.trim();
      
      if (!code || !discountBlock) return;

      const validCode = discountBlock.dataset.discountCode;
      const discountPercent = parseFloat(discountBlock.dataset.discountPercent);

      // Check if code matches (case-insensitive)
      if (validCode && code.toLowerCase() === validCode.toLowerCase() && !isNaN(discountPercent) && discountPercent > 0) {
        // Store valid code for checkout
        this.appliedDiscountCode = validCode;

        // Calculate discount locally
        if (typeof CartJS !== 'undefined' && CartJS.cart) {
          const subtotal = CartJS.cart.total_price;
          const discountAmount = Math.round(subtotal * (discountPercent / 100));
          const newTotal = subtotal - discountAmount;

          // Update UI immediately
          const savingsEl = this.querySelector('[data-savings]');
          const subtotalEl = this.querySelector('.cart-slide__subtotal strong');
          
          if (savingsEl) {
            savingsEl.textContent = this.formatMoney(discountAmount);
          }
          
          if (subtotalEl) {
            subtotalEl.textContent = this.formatMoney(newTotal);
          }
        }
      } else {
        this.appliedDiscountCode = null;
      }

      try {
        await new Promise((resolve, reject) => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = `/discount/${encodeURIComponent(code)}`;
          document.body.appendChild(iframe);

          // Shopify applies code via cookies - give it time
          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve();
          }, 1500);
        });

        await this.refreshCart();
        discountInput.value = '';
      } catch (error) {
        console.error('Error applying discount:', error);
      }
    }

    updateGoals(cart) {
      const originalSubtotal = (cart.original_total_price || 0) / 100;
      const subtotal = (cart.total_price || 0) / 100;
      const shipBlock = this.querySelector('[data-unlockship]:not([data-unlockdiscount])');
      const discountBlock = this.querySelector('[data-unlockdiscount][data-unlockship]');

      // At least one block should exist (either shipping-only or shipping+discount)
      if (!shipBlock && !discountBlock) return;

      // Handle shipping-only block
      if (shipBlock) {
        const unlockShip = parseFloat(shipBlock.dataset.unlockship);
        const remainingShip = Math.max(0, unlockShip - originalSubtotal);
        const percentShip = Math.min(100, (originalSubtotal / unlockShip) * 100);

        const shipBar = shipBlock.querySelector('.cart-slide__progress-fill--shipping');
        if (shipBar) shipBar.style.width = `${percentShip}%`;

        const shipText = shipBlock.querySelector('.cart-slide__text-shipping');
        if (shipText) {
          if (originalSubtotal >= unlockShip) {
            shipText.innerHTML = `<strong>✓ FREE Shipping Unlocked!</strong>`;
            shipBlock.classList.add('unlocked');
          } else {
            shipText.innerHTML = `You're <strong>${Shopify.formatMoney(remainingShip * 100, CartJS.settings.moneyFormat)}</strong> away from <strong>FREE Shipping!</strong>`;
            shipBlock.classList.remove('unlocked');
          }
        }
      }

      // Handle shipping+discount block
      if (discountBlock) {
        const unlockShip = parseFloat(discountBlock.dataset.unlockship);
        const unlockDiscount = parseFloat(discountBlock.dataset.unlockdiscount);

        const remainingShip = Math.max(0, unlockShip - originalSubtotal);
        const percentShip = Math.min(100, (originalSubtotal / unlockShip) * 100);

        const remainingDiscount = Math.max(0, unlockDiscount - originalSubtotal);
        const percentDiscount = Math.min(100, (originalSubtotal / unlockDiscount) * 100);

        const discountBar = discountBlock.querySelector('.cart-slide__progress-fill--discount');
        if (discountBar) {
          discountBar.style.width = `${percentDiscount}%`;
        }

        const discountText = discountBlock.querySelector('.cart-slide__text-discount');
        const discountPercent = discountBlock.dataset.discountpercent || '0';
        if (discountText) {
          if (originalSubtotal >= unlockDiscount) {
            discountText.innerHTML = `<strong>${discountPercent}% OFF Unlocked!</strong>`;
            discountBlock.classList.add('unlocked');
          } else {
            discountText.innerHTML = `You're <strong>${Shopify.formatMoney(remainingDiscount * 100, CartJS.settings.moneyFormat)}</strong> away from <strong>Unlocking ${discountPercent}% OFF!</strong>`;
            discountBlock.classList.remove('unlocked');
          }
        }

        // Add unlocked-ship class when shipping threshold is met
        if (originalSubtotal >= unlockShip) {
          discountBlock.classList.add('unlocked-ship');
        } else {
          discountBlock.classList.remove('unlocked-ship');
        }

        // Position the free shipping label on the discount progress bar
        this.positionDiscountIcons();

        // Handle discount code application and savings calculation
        const discountCode = discountBlock.dataset.code?.toLowerCase();
        const appliedCodes = (cart.discount_codes || []).map(d => d.code.toLowerCase());
        const cartLevelApplied = appliedCodes.includes(discountCode);

        const productLevelDiscountApplied = cart.items.some(item => {
          return item.original_price > item.final_price;
        });

        const savingsEl = this.querySelector('[data-savings]');
        const subtotalEl = this.querySelector('.cart-slide__subtotal strong');

        if (typeof CartJS === 'undefined' || !CartJS.settings) {
          return;
        }

        if (originalSubtotal >= unlockDiscount && discountPercent > 0) {
          const discountedTotal = originalSubtotal * (1 - discountPercent / 100);
          const expectedSavings = originalSubtotal - discountedTotal;

          if (savingsEl) {
            savingsEl.textContent = Shopify.formatMoney(expectedSavings * 100, CartJS.settings.moneyFormat)
          }

          if (subtotalEl) {
            subtotalEl.textContent = Shopify.formatMoney(discountedTotal * 100, CartJS.settings.moneyFormat);
          }
        } else {
          const savings = (CartJS.cart && CartJS.cart.total_discount) ? CartJS.cart.total_discount : 0;
          const formattedSavings = Shopify.formatMoney(savings, CartJS.settings.moneyFormat);
          if (savingsEl) {
            savingsEl.textContent = formattedSavings;
          }
        }
      }
    }

    positionDiscountIcons() {
      const discountBlock = this.querySelector('[data-unlockdiscount][data-unlockship]');
      if (!discountBlock) return;

      const labels = discountBlock.querySelectorAll('.cart-slide__label');
      if (labels.length === 0) return;

      const rateFactor = Shopify.currency.rate || 1;

      // Find the maximum threshold value from all labels
      let maxThreshold = 0;
      labels.forEach(label => {
        const price = parseFloat(label.dataset.price) * rateFactor;
        if (price > maxThreshold) {
          maxThreshold = price;
        }
      });

      if (maxThreshold === 0) return;

      // Position each label based on percentage
      labels.forEach(label => {
        const price = parseFloat(label.dataset.price) * rateFactor;
        const percentPosition = (price / maxThreshold) * 100;

        label.style.position = 'absolute';
        label.style.left = `${percentPosition}%`;
        label.style.top = '0px';
        label.style.transform = 'translateX(-50%)';
      });
    }

    applyDiscountViaIframe(code, attempt = 1) {
      return new Promise((resolve, reject) => {
        if (attempt > 3) {
          return resolve();
        }

        let iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/discount/${code}`;
        document.body.appendChild(iframe);

        iframe.onerror = () => {
          document.body.removeChild(iframe);
          reject(new Error('Failed to apply discount'));
        };

        setTimeout(() => {
          document.body.removeChild(iframe);
          fetch('/cart.js')
            .then(response => response.json())
            .then(cart => {
              const alreadyApplied = cart.discount_codes?.some(
                d => d.code.toLowerCase() === code.toLowerCase()
              );
              if (!alreadyApplied) {
                return this.applyDiscountViaIframe(code, attempt + 1)
                  .then(resolve)
                  .catch(reject);
              }
              resolve();
            })
            .catch(err => reject(err));
        }, 1200);
      });
    }

    clearDiscountViaIframe() {
      return new Promise((resolve, reject) => {
        let iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/discount/none`;
        document.body.appendChild(iframe);

        setTimeout(() => {
          document.body.removeChild(iframe);

          fetch('/cart.js')
            .then(res => res.json())
            .then(cart => {
              const discountCodes = cart.discount_codes || [];
              if (discountCodes.length > 0) {
              }
              resolve();
            })
            .catch(err => reject(err));
        }, 1200);
      });
    }

    startReserveTimer(initialSeconds) {
      const timerElement = this.querySelector('.cart-slide__reserved strong');
      if (!timerElement) return;

      const reservedElement = this.querySelector('.cart-slide__reserved');
      if (!reservedElement) return;

      initialSeconds = reservedElement.getAttribute('data-time') * 60;

      if (this.reserveTimeRemaining) {
        this.reserveEndTime = Date.now() + this.reserveTimeRemaining;
        this.reserveTimeRemaining = null;
      }

      if (!this.reserveEndTime) {
        this.reserveEndTime = Date.now() + initialSeconds * 1000;
      }

      clearInterval(this.timerInterval);

      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((this.reserveEndTime - Date.now()) / 1000));
        const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
        const secs = String(remaining % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${secs}`;

        if (remaining <= 0) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.reserveEndTime = null;
        }
      };

      updateTimer();
      this.timerInterval = setInterval(updateTimer, 1000);
    }

    pauseTimer() {
      clearInterval(this.timerInterval);
      this.timerInterval = null;

      if (this.reserveEndTime) {
        this.reserveTimeRemaining = this.reserveEndTime - Date.now();
      }
    }

    async handleCheckout() {
      try {
        let url = '/checkout';
        // Append discount code if applied
        if (this.appliedDiscountCode) {
          url += `?discount=${encodeURIComponent(this.appliedDiscountCode)}`;
        }
        window.location.href = url;
      } catch (error) {
        window.location.href = '/checkout';
      }
    }

    setupPolicyAgreement() {
      const policyContainer = this.querySelector('.cart-slide__policy');
      const checkbox = policyContainer?.querySelector('input[type="checkbox"]');
      const checkoutBtn = this.querySelector('.cart-slide__checkout-btn');

      if (!policyContainer || !checkbox || !checkoutBtn) return;

      const updateButtonState = () => {
        const cartNotEmpty = CartJS.cart.item_count > 0;
        checkoutBtn.disabled = !(cartNotEmpty && checkbox.checked);
      };

      checkbox.addEventListener('change', updateButtonState);

      updateButtonState();
    }
  }
  customElements.define('cart-slide', CartSlide);
})();

(function () {
  if (customElements.get('gift-block-cart')) return;

  class GiftBlockCart extends HTMLElement {
    constructor() {
      super();
      this.priceUnlock = parseInt(this.dataset.priceunlock || '0', 10);
      this.lockedClass = 'cart-slide__gift-item--locked';
    }

    connectedCallback() {
      this.giftContainer = this.querySelector('.cart-slide__gift-item');
      this.giftNeedSpan = document.querySelector('[data-giftneed] span');
      this.giftImagePlaceholder = this.querySelector('[data-image]');
      this.imageHtml = this.giftImagePlaceholder?.dataset.image || '';


      jQuery(document).on('cart.requestComplete', () => {
        this.updateState();
      });
    }

    async updateState() {
      try {
        const cart = await this.fetchCartTotal();
        const isUnlocked = cart.total_price >= this.priceUnlock;


        if (this.giftNeedSpan) {
          const remaining = Math.max(0, this.priceUnlock - cart.total_price);
          this.giftNeedSpan.textContent = (remaining / 100).toFixed(2); // делим на 100, т.к. Shopify хранит в центах
        }

        if (isUnlocked) {
          this.unlockGift();
        } else {
          this.lockGift();
        }
      } catch (e) {
      }
    }

    async fetchCartTotal() {
      const res = await fetch('/cart.js');
      if (!res.ok) throw new Error('Failed to fetch cart');
      const data = await res.json();
      return {
        total_price: data.total_price
      };
    }

    unlockGift() {
      if (this.giftContainer) {
        this.giftContainer.classList.remove(this.lockedClass);
      }
      const wrapper = this.giftContainer ? this.giftContainer.querySelector('.cart-slide__img-placeholder') : null;
      if (wrapper && this.imageHtml) {
        wrapper.innerHTML = this.imageHtml;
      }
    }

    lockGift() {
      this.giftContainer?.classList.add(this.lockedClass);
    }
  }

  customElements.define('gift-block-cart', GiftBlockCart);
})();

// ============================================
// CART BUTTON CLICK HANDLING WITH DETAILED DEBUGGING
// ============================================

// Function to open cart with retry mechanism
function openCartDrawer() {
  try {
    const getCart = () => {
      const cartById = document.getElementById('side-cart');
      const cartBySelector = document.querySelector('cart-slide');
      const cart = cartById || cartBySelector;
      return cart;
    };
    
    const tryOpenCart = () => {
      // Check if custom element is defined
      const customElementDefined = customElements.get('cart-slide') !== undefined;
      
      // Try to find the cart element
      const cartById = document.getElementById('side-cart');
      const cartBySelector = document.querySelector('cart-slide');
      const cart = cartById || cartBySelector;
      
      if (cart) {
        // Check if it's a custom element instance
        if (cart.tagName === 'CART-SLIDE') {
        }
        
        if (typeof cart.toggleCart === 'function') {
          try {
            cart.toggleCart();
            return true;
          } catch (error) {
            return false;
          }
        } else {
        }
      } else {
        // Check if any cart-slide elements exist at all
        const allCartSlides = document.querySelectorAll('cart-slide');
        const allSideCarts = document.querySelectorAll('#side-cart');
        
        if (allCartSlides.length > 0) {
        }
      }
      return false;
    };
    
    // Try immediately
    if (tryOpenCart()) {
      return true;
    }
    
    // If not found, wait for it with retries
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds total
    const interval = setInterval(() => {
      attempts++;
      
      if (tryOpenCart() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          // Check if the section exists in the DOM
          const cartSlideSection = document.querySelector('cart-slide, #side-cart');
          if (!cartSlideSection) {
            // Check if overlay-group is being rendered
            const overlayGroup = document.querySelector('[data-section-type="custom.overlay"]');
          }
        }
      }
    }, 100);
    
    return false;
  } catch (error) {
    return false;
  }
}

// Debug function to check cart button status (can be called from console)
window.debugCartButton = function() {
  const selectors = [
    '.cart',
    '.js-cart-toggle',
    '.open-cart-btn',
    'button.cart',
    '.cart.js-cart-toggle'
  ];
  
  const allButtons = [];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, i) => {
      const hasAttr = el.getAttribute('data-cart-listener-attached') === 'true';
      const buttonInfo = {
        element: el,
        tagName: el.tagName,
        id: el.id,
        classes: el.className,
        hasDataAttr: hasAttr,
        dataAttrValue: el.getAttribute('data-cart-listener-attached'),
        hasClickListener: el.onclick !== null || el.getAttribute('onclick') !== null
      };
      if (!allButtons.includes(el)) {
        allButtons.push(el);
      }
    });
  });
  
  const cart = document.getElementById('side-cart') || document.querySelector('cart-slide');
  
  // Check attribute status
  const buttonsWithAttr = allButtons.filter(btn => btn.getAttribute('data-cart-listener-attached') === 'true');
  const buttonsWithoutAttr = allButtons.filter(btn => btn.getAttribute('data-cart-listener-attached') !== 'true');
  
  if (buttonsWithoutAttr.length > 0) {
    setupDirectListeners();
  }
  
  return {
    buttons: allButtons,
    buttonsWithAttr: buttonsWithAttr,
    buttonsWithoutAttr: buttonsWithoutAttr,
    cart: cart,
    cartHasToggleCart: cart && typeof cart.toggleCart === 'function'
  };
};

// Global click listener for cart icon clicks only
// IMPORTANT: Only handles cart icon clicks, NOT add to cart buttons
document.addEventListener('click', (e) => {
  const target = e.target;
  
  // First, check if this is definitely an add to cart button
  // Check if the clicked element itself or its immediate parent is an add to cart button
  const isAddToCartButton = (
    target.classList && (
      target.classList.contains('product_atc_button') ||
      target.classList.contains('add-to-cart') ||
      target.hasAttribute('data-add-to-cart')
    )
  ) || (
    target.tagName === 'BUTTON' && 
    target.type === 'submit' && 
    target.closest('form[action*="/cart/add"]') &&
    !target.classList.contains('js-cart-toggle') &&
    !target.classList.contains('open-cart-btn')
  ) || (
    target.closest('.product_atc_button, [data-add-to-cart], .add-to-cart') &&
    !target.closest('.js-cart-toggle, .open-cart-btn')
  );
  
  if (isAddToCartButton) {
    // This is an add to cart button, let it work normally - don't interfere
    return;
  }
  
  // Check if clicked element or parent is a cart icon button
  let cartButton = null;
  let detectionMethod = '';
  
  // Method 1: Check if target has js-cart-toggle or open-cart-btn classes
  if (target.classList) {
    const hasJsCartToggle = target.classList.contains('js-cart-toggle');
    const hasOpenCartBtn = target.classList.contains('open-cart-btn');
    
    if (hasJsCartToggle || hasOpenCartBtn) {
      cartButton = target;
      detectionMethod = 'target-has-cart-icon-class';
    }
  }
  
  // Method 2: Check if target is a button with js-cart-toggle or cart.js-cart-toggle
  if (!cartButton && target.tagName === 'BUTTON' && target.classList) {
    if (target.classList.contains('js-cart-toggle') || 
        target.classList.contains('open-cart-btn') ||
        (target.classList.contains('cart') && target.classList.contains('js-cart-toggle'))) {
      cartButton = target;
      detectionMethod = 'button-with-cart-icon-class';
    }
  }
  
  // Method 3: Check parent chain for cart icon (for SVG clicks inside button)
  if (!cartButton) {
    let parent = target.parentElement;
    let depth = 0;
    const maxDepth = 10;
    
    while (parent && parent !== document.body && depth < maxDepth) {
      depth++;
      if (parent.classList) {
        const isCartIconButton = (
          parent.classList.contains('js-cart-toggle') ||
          parent.classList.contains('open-cart-btn') ||
          (parent.classList.contains('cart') && parent.classList.contains('js-cart-toggle'))
        );
        const isButtonWithCartIcon = parent.tagName === 'BUTTON' && (
          parent.classList.contains('js-cart-toggle') || 
          parent.classList.contains('open-cart-btn') ||
          (parent.classList.contains('cart') && parent.classList.contains('js-cart-toggle'))
        );
        
        if (isCartIconButton || isButtonWithCartIcon) {
          cartButton = parent;
          detectionMethod = `parent-chain-depth-${depth}`;
          break;
        }
      }
      
      parent = parent.parentElement;
    }
  }
  
  // Method 4: Use closest() for js-cart-toggle or open-cart-btn
  if (!cartButton) {
    const closestCart = target.closest('.js-cart-toggle, .open-cart-btn, button.js-cart-toggle, button.open-cart-btn, .cart.js-cart-toggle');
    if (closestCart) {
      // Make sure it's not an add to cart button
      const isAddToCart = closestCart.classList && (
        closestCart.classList.contains('product_atc_button') ||
        closestCart.classList.contains('add-to-cart') ||
        closestCart.hasAttribute('data-add-to-cart')
      );
      
      if (!isAddToCart) {
        cartButton = closestCart;
        detectionMethod = 'closest-method';
      }
    }
  }
  
  // If we found a cart icon button (not add to cart), open the cart
  if (cartButton) {
    e.preventDefault();
    e.stopPropagation();
    openCartDrawer();
  }
}, true); // Use capture phase to catch events early

// Set up direct listeners when DOM is ready
// IMPORTANT: Only targets cart icon buttons, NOT add to cart buttons
function setupDirectListeners() {
  try {
    // Find cart icon buttons (not add to cart buttons)
    const selectors = ['.js-cart-toggle', '.open-cart-btn', 'button.js-cart-toggle', 'button.open-cart-btn', '.cart.js-cart-toggle'];
    const allButtons = new Set();
    
    selectors.forEach(selector => {
      try {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(btn => {
          // Double check it's not an add to cart button
          const isAddToCart = btn.classList && (
            btn.classList.contains('product_atc_button') ||
            btn.classList.contains('add-to-cart') ||
            btn.hasAttribute('data-add-to-cart')
          );
          
          if (!isAddToCart) {
            allButtons.add(btn);
          } else {
          }
        });
      } catch (err) {
      }
    });
    
    const uniqueButtons = Array.from(allButtons);
    
    let listenersAdded = 0;
    uniqueButtons.forEach((btn, index) => {
      try {
        // Check if listener already attached - but still add it to be safe
        const hasFlag = btn.dataset && btn.dataset.cartListenerAttached === 'true';
        if (hasFlag) {
        }
        
        // Remove any existing listeners by cloning the button (if needed)
        // But first, let's just add the listener - multiple listeners won't hurt
        
        // Add click listener
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openCartDrawer();
        };
        
        // Always add the listener, even if flag is set
        try {
          btn.addEventListener('click', clickHandler, true); // Use capture phase
          listenersAdded++; // Count listener as added immediately
        } catch (listenerError) {
        }
        
        // Set the attribute to mark listener as attached
        try {
          if (btn.dataset) {
            btn.dataset.cartListenerAttached = 'true';
          } else {
            btn.setAttribute('data-cart-listener-attached', 'true');
          }
          
          // Verify attribute was set
          const verifyAttr = btn.getAttribute('data-cart-listener-attached');
          if (verifyAttr === 'true') {
          } else {
            // Try alternative method
            btn.setAttribute('data-cart-listener-attached', 'true');
          }
        } catch (attrError) {
          // Try alternative method
          try {
            btn.setAttribute('data-cart-listener-attached', 'true');
          } catch (fallbackError) {
          }
        }
      } catch (btnError) {
      }
    });
    
    return listenersAdded;
  } catch (error) {
    return 0;
  }
}

// Set up listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const buttonCount = setupDirectListeners();
    
    // Handle URL parameter
    const cart_params = new URLSearchParams(window.location.search);
    if (cart_params.has('cart')) {
      openCartDrawer();
    }
  });
} else {
  const buttonCount = setupDirectListeners();
  
  // Handle URL parameter
  const cart_params = new URLSearchParams(window.location.search);
  if (cart_params.has('cart')) {
    openCartDrawer();
  }
}

// Retry setup multiple times in case buttons are added dynamically
const retryDelays = [500, 1000, 2000, 3000];
retryDelays.forEach((delay, index) => {
  setTimeout(() => {
    const buttonCount = setupDirectListeners();
  }, delay);
});

// Use MutationObserver to watch for buttons being added to DOM
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Check if the added node or its children might be cart buttons
            if (node.classList && (
              node.classList.contains('cart') ||
              node.classList.contains('js-cart-toggle') ||
              node.classList.contains('open-cart-btn')
            )) {
              shouldCheck = true;
            } else if (node.querySelectorAll) {
              const hasCartButton = node.querySelectorAll('.cart, .js-cart-toggle, .open-cart-btn, button.cart').length > 0;
              if (hasCartButton) {
                shouldCheck = true;
              }
            }
          }
        });
      }
    });
    
    if (shouldCheck) {
      const buttonCount = setupDirectListeners();
    }
  });
  
  // Start observing
  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch (observerError) {
  }
} else {
}

// Final verification function
function verifyButtonListeners() {
  const allButtons = document.querySelectorAll('.cart, .js-cart-toggle, .open-cart-btn, button.cart');
  let verifiedCount = 0;
  let missingCount = 0;
  
  allButtons.forEach((btn, index) => {
    const hasAttr = btn.getAttribute('data-cart-listener-attached') === 'true';
    if (hasAttr) {
      verifiedCount++;
    } else {
      missingCount++;
      // Try to add listener again
      setupDirectListeners();
    }
  });
  
  return { verified: verifiedCount, missing: missingCount };
}

// Run verification after all retries
setTimeout(() => {
  verifyButtonListeners();
}, 4000);

// Global cart icon update listener (fix for issue #4)
// This ensures cart icon updates even when cart drawer is not open
(function() {
  function updateCartIconGlobally() {
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        const cartSlide = document.querySelector('cart-slide');
        if (cartSlide && typeof cartSlide.updateCartIconCount === 'function') {
          cartSlide.updateCartIconCount(cart.item_count || 0);
        } else {
          // Fallback: update directly if cart-slide is not available
          const cartCountBubble = document.querySelector('.cart-count-bubble span[aria-hidden="true"]');
          const headerCartCount = document.querySelector('.header__cart-count');
          const cartLinkBubble = document.querySelector('.cart-link__bubble');
          const itemCount = cart.item_count || 0;
          
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
            headerCartCount.textContent = itemCount;
          }
          
          if (cartLinkBubble) {
            if (itemCount > 0) {
              cartLinkBubble.classList.add('cart-link__bubble--visible');
            } else {
              cartLinkBubble.classList.remove('cart-link__bubble--visible');
            }
          }
        }
      })
      .catch(() => {
        // Silently fail if cart fetch fails
      });
  }

  // Listen for cart.requestComplete event globally
  if (typeof jQuery !== 'undefined') {
    jQuery(document).on('cart.requestComplete', function(event, cart) {
      if (cart && cart.item_count !== undefined) {
        updateCartIconGlobally();
      }
    });
  }

  // Also listen for custom cart update events
  document.addEventListener('cart:updated', updateCartIconGlobally);
  
  // Update cart icon on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartIconGlobally);
  } else {
    updateCartIconGlobally();
  }
})();
