if (!customElements.get('shipping-bar')) {
    customElements.define('shipping-bar', class ShippingBar extends HTMLElement {
        static get observedAttributes() {
            return ['data-cart-totals'];
        }

        constructor() {
            super();
        }

        connectedCallback() {
            this.update();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name === 'data-cart-totals' && oldValue !== newValue) {
                this.update();
            }
        }

        update() {
            const setString = () => {
                const dataRate = parseFloat(this.dataset.amount);
                const rateFactor = Shopify.currency.rate || 1;
                const amountCalc = dataRate * rateFactor;
                const cartTotals = parseFloat(this.dataset.cartTotals) / 100;
                const amount = (amountCalc - cartTotals) * 100;

                const textContainer = document.querySelector('[data-shipping-bar-text]');
                if (textContainer) {
                    if (amount > 0) {
                        const base = textContainer.dataset.originalText || textContainer.innerHTML;
                        if (!textContainer.dataset.originalText) {
                            textContainer.dataset.originalText = base;
                        }
                        // We need a way to get the original template with ||amount||. 
                        // Since we might have replaced it already, we should probably rely on a data attribute or similar.
                        // For now, let's assume the textContainer has the template or we can reconstruct it.
                        // Actually, main-cart-items logic replaced innerHTML. If we update, we need the template.
                        // Let's check how main-cart-items handled it. It just did replace. 
                        // If we run this multiple times, 'base' will be the already replaced text.
                        // We should store the template.

                        // Let's try to find the template from settings if possible, but here we only have DOM.
                        // A robust way is to store the initial template in a data attribute on mount.
                    } else {
                        // ...
                    }
                }

                // Wait, the logic in main-cart-items.liquid line 1017: const base = textContainer.innerHTML;
                // This is flawed if run multiple times because it replaces ||amount||. 
                // If we run it again, ||amount|| is gone.
                // We need to fix this in the extracted class.
            }

            // Let's copy the logic exactly first, then fix the re-render issue.
            // Actually, for the cart drawer, the text might be inside the component or outside.
            // In main-cart-items, textContainer is document.querySelector('[data-shipping-bar-text]').
            // This is outside the component.

            this.calculateAndRender();
        }

        calculateAndRender() {
            const dataRate = parseFloat(this.dataset.amount);
            const rateFactor = Shopify.currency.rate || 1;
            const amountCalc = dataRate * rateFactor;
            const cartTotals = parseFloat(this.dataset.cartTotals) / 100;
            const amount = (amountCalc - cartTotals) * 100;

            const textContainer = document.querySelector('[data-shipping-bar-text]');
            if (textContainer) {
                // Store original template if not stored
                if (!textContainer.dataset.template) {
                    textContainer.dataset.template = textContainer.innerHTML;
                }

                if (amount > 0) {
                    const base = textContainer.dataset.template;
                    textContainer.innerHTML = base.replace(/\|\|amount\|\|/g, Shopify.formatMoney(amount, window.money_format));
                    textContainer.style.fontWeight = '400';
                } else {
                    textContainer.innerHTML = this.dataset.shippingMessage || '✓ FREE Shipping Unlocked!';
                    textContainer.style.fontWeight = '700';
                }
            }

            this.threshold = amountCalc;
            this.cartTotals = cartTotals;

            this.setBar();
        }

        setBar() {
            const element = this.querySelector('[data-progress-span]');
            if (!element) return;

            // Avoid division by zero
            if (!this.threshold) return;

            let value = (this.cartTotals / this.threshold) * 100;
            if (value > 100) value = 100;
            if (value < 0) value = 0;

            element.setAttribute('data-value', value.toFixed(2));
            element.style.setProperty('--bar-width', `${value.toFixed(2)}%`);
            element.innerText = value.toFixed(2);

            // Position icons
            this.positionIcons();
        }

        // Position icons using percentage-based positioning
        positionIcons() {
            const marks = this.querySelectorAll('.cart-slide__label');
            if (marks.length === 0) return;

            const rateFactor = Shopify.currency.rate || 1;

            // Find the maximum threshold value from all marks
            let maxThreshold = this.threshold;
            marks.forEach(mark => {
                const price = parseFloat(mark.dataset.price) * rateFactor;
                if (price > maxThreshold) {
                    maxThreshold = price;
                }
            });

            // Position each mark based on percentage
            marks.forEach(mark => {
                const price = parseFloat(mark.dataset.price) * rateFactor;
                const percentPosition = (price / maxThreshold) * 100;

                mark.style.position = 'absolute';
                mark.style.left = `${percentPosition}%`;
                mark.style.top = '0px';
                mark.style.transform = 'translateX(-50%)';
            });
        }
    });
}
