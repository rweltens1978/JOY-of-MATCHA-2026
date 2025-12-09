/*Before After Slider 2*/

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeforeAfterV2);
} else {
  initBeforeAfterV2();
}

function initBeforeAfterV2() {
  const sections = document.querySelectorAll('.before-after-v2-section');

  sections.forEach(section => {
    const sectionId = section.getAttribute('data-section-id');
    const sliderSelector = `.before-after-v2-section[data-section-id="${sectionId}"] .v2-before-after-slider`;
    const prevBtn = section.querySelector('.swiper-button-prev');
    const nextBtn = section.querySelector('.swiper-button-next');
    const pagination = section.querySelector('.swiper-pagination');
    const containers = section.querySelectorAll('.v2-before-after-container');

    const swiper = new Swiper(sliderSelector, {
      slidesPerView: 1,
      slidesPerGroup: 1,
      spaceBetween: 20,
      loop: false,
      simulateTouch: false,
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn,
      },
      pagination: {
        el: pagination,
        clickable: true,
      },
      breakpoints: {
        769: {
          slidesPerView: 1,
          slidesPerGroup: 1
        }
      },
      on: {
        init: function () {
          containers.forEach(resetClipping);
        },
        slideChange: function () {
          containers.forEach(resetClipping);
        },
        resize: function () {
          this.update();
        }
      }
    });

    containers.forEach(container => {
      const divider = container.querySelector('.v2-divider');
      const beforeImage = container.querySelector('.v2-before-image');
      const afterImage = container.querySelector('.v2-after-image');
      let isDragging = false;

      const moveHandler = (x) => {
        const rect = container.getBoundingClientRect();
        let percentage = ((x - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        divider.style.left = `${percentage}%`;
        beforeImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
        afterImage.style.clipPath = `inset(0 0 0 ${percentage}%)`;
      };

      const mouseMove = (e) => isDragging && moveHandler(e.clientX);
      const touchMove = (e) => isDragging && moveHandler(e.touches[0].clientX);

      divider.addEventListener('mousedown', e => {
        e.preventDefault();
        isDragging = true;
      });
      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', () => isDragging = false);

      divider.addEventListener('touchstart', e => {
        e.preventDefault();
        isDragging = true;
      });
      document.addEventListener('touchmove', touchMove);
      document.addEventListener('touchend', () => isDragging = false);
    });
  });

  function resetClipping(container) {
    const divider = container.querySelector('.v2-divider');
    const beforeImage = container.querySelector('.v2-before-image');
    const afterImage = container.querySelector('.v2-after-image');
    divider.style.left = '50%';
    beforeImage.style.clipPath = 'inset(0 50% 0 0)';
    afterImage.style.clipPath = 'inset(0 0 0 50%)';
  }
}

/*Before After Slider */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeforeAfter);
} else {
  initBeforeAfter();
}

function initBeforeAfter() {
  const sections = document.querySelectorAll('.before-after-section');

  sections.forEach(section => {
    const sectionId = section.getAttribute('data-section-id');
    const swiperContainer = section.querySelector('.before-after-slider');
    const prevBtn = section.querySelector('.swiper-button-prev');
    const nextBtn = section.querySelector('.swiper-button-next');
    const pagination = section.querySelector('.swiper-pagination');
    const containers = section.querySelectorAll('.before-after-container');

    const swiper = new Swiper(swiperContainer, {
      slidesPerView: 1,
      slidesPerGroup: 1,
      spaceBetween: 20,
      loop: false,
      simulateTouch: false,
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn,
      },
      pagination: {
        el: pagination,
        clickable: true,
      },
      breakpoints: {
        769: {
          slidesPerView: 2,
          slidesPerGroup: 2
        }
      },
      on: {
        init: () => containers.forEach(resetClipping),
        slideChange: () => containers.forEach(resetClipping),
        resize: function () {
          this.update();
        }
      }
    });

    containers.forEach(container => {
      const divider = container.querySelector('.divider');
      const beforeImage = container.querySelector('.before-image');
      const afterImage = container.querySelector('.after-image');
      let isDragging = false;

      const moveHandler = (x) => {
        const rect = container.getBoundingClientRect();
        let percentage = ((x - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        divider.style.left = `${percentage}%`;
        beforeImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
        afterImage.style.clipPath = `inset(0 0 0 ${percentage}%)`;
      };

      divider.addEventListener('mousedown', e => {
        e.preventDefault();
        isDragging = true;
      });
      document.addEventListener('mousemove', e => isDragging && moveHandler(e.clientX));
      document.addEventListener('mouseup', () => isDragging = false);

      divider.addEventListener('touchstart', e => {
        e.preventDefault();
        isDragging = true;
      });
      document.addEventListener('touchmove', e => isDragging && moveHandler(e.touches[0].clientX));
      document.addEventListener('touchend', () => isDragging = false);
    });
  });
}

function resetClipping(container) {
  const divider = container.querySelector('.divider');
  const beforeImage = container.querySelector('.before-image');
  const afterImage = container.querySelector('.after-image');
  divider.style.left = '50%';
  beforeImage.style.clipPath = 'inset(0 50% 0 0)';
  afterImage.style.clipPath = 'inset(0 0 0 50%)';
}

/*Blogposts */
(function () {
  function initSwiperSections() {
    const sectionSelectors = document.querySelectorAll('[data-section-id]');
    sectionSelectors.forEach(section => {
      const sectionId = section.getAttribute('data-section-id');
      const container = section.querySelector('.swiper-container');
      if (!container) return;

      const slideCount = container.querySelectorAll('.swiper-slide').length;
      new Swiper(container, {
        loop: slideCount > 3,
        navigation: {
          nextEl: `#shopify-section-${sectionId} .swiper-b-next`,
          prevEl: `#shopify-section-${sectionId} .swiper-b-prev`,
        },
        pagination: {
          el: `#shopify-section-${sectionId} .swiper-pagination`,
          clickable: true,
          dynamicBullets: false,
        },
        slidesPerView: 1,
        spaceBetween: 30,
        breakpoints: {
          480: { slidesPerView: 1 },
          768: { slidesPerView: 2 },
          1024: { slidesPerView: 3 }
        },
        grabCursor: true,
        autoplay: false
      });
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initSwiperSections();
  } else {
    document.addEventListener('DOMContentLoaded', initSwiperSections);
  }
})();

/* tabs content*/


document.addEventListener('DOMContentLoaded', function () {
  const section = document.querySelector('.tabs');
  const tabButtons = section.querySelectorAll('.tab-button');
  const tabPanes = section.querySelectorAll('.tab-pane');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');

      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      section.querySelector(`.tab-pane[data-tab="${tabId}"]`).classList.add('active');
    });
  });
});




/*
//FB Reviews 
document.addEventListener('DOMContentLoaded', function() {
    const sectionId = '{{ section.id }}';
    const carousel = document.querySelector(`#shopify-section-${sectionId} .carousel`);
    const dots = document.querySelectorAll(`#shopify-section-${sectionId} .dot`);
    const arrows = document.querySelectorAll(`#shopify-section-${sectionId} .arrow`);
    const autoScrollEnabled = {{ section.settings.auto_scroll | json }}; // Ensure boolean value
    const scrollSpeed = {{ section.settings.scroll_speed | times: 1000 }}; // Convert seconds to ms
    let currentIndex = 0;
    let autoScrollInterval = null;
    const totalItems = carousel.children.length; // Number of original items
    const itemWidth = carousel.children[0].offsetWidth + 24; // Width + updated gap of 24px
    const visibleItems = Math.ceil(carousel.parentElement.offsetWidth / itemWidth); // Round up for full coverage

    // Clone items for infinite scrolling (2 sets of clones)
    const originalItems = Array.from(carousel.children);
    for (let i = 0; i < 2; i++) {
      originalItems.forEach(item => {
        const clone = item.cloneNode(true);
        carousel.appendChild(clone);
      });
    }
    const realTotalItems = carousel.children.length; // Total items after cloning

    // Set initial position in the middle
    currentIndex = totalItems;
    carousel.style.transition = 'none';
    carousel.style.transform = `translateX(${-currentIndex * itemWidth}px)`;
    setTimeout(() => {
      carousel.style.transition = 'transform 0.5s ease';
    }, 50);

    function updateCarousel(transition = true) {
      const offset = -currentIndex * itemWidth;
      
      if (transition) {
        carousel.style.transition = 'transform 0.5s ease';
      } else {
        carousel.style.transition = 'none';
      }
      
      carousel.style.transform = `translateX(${offset}px)`;

      // Infinite loop handling
      if (currentIndex >= totalItems * 2) {
        setTimeout(() => {
          currentIndex = totalItems;
          carousel.style.transition = 'none';
          carousel.style.transform = `translateX(${-currentIndex * itemWidth}px)`;
          setTimeout(() => {
            carousel.style.transition = 'transform 0.5s ease';
          }, 50);
        }, 500);
      } else if (currentIndex < totalItems) {
        setTimeout(() => {
          currentIndex = totalItems * 2 - visibleItems;
          carousel.style.transition = 'none';
          carousel.style.transform = `translateX(${-currentIndex * itemWidth}px)`;
          setTimeout(() => {
            carousel.style.transition = 'transform 0.5s ease';
          }, 50);
        }, 500);
      }

      // Update active dot
      let dotIndex = (currentIndex % totalItems);
      dots.forEach((dot, index) => {

        
        if(dotIndex >= {{section.blocks.size}}){
          dotIndex = dotIndex - {{section.blocks.size}} % totalItems;
        }
        
        dot.classList.toggle('active', index === dotIndex);
      });
    }

    function startAutoScroll() {

      stopAutoScroll(); // Clear before starting
      if (autoScrollEnabled === true) { // Explicit comparison with true
        autoScrollInterval = setInterval(() => {
          currentIndex++;
          updateCarousel(true);
        }, scrollSpeed / totalItems); // Divide scrollSpeed by totalItems for per-slide timing
      } else {
      }
    }

    function stopAutoScroll() {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    }

    // Arrow navigation
    arrows.forEach(arrow => {
      arrow.addEventListener('click', () => {
        stopAutoScroll();
        const direction = arrow.getAttribute('data-direction');
        if (direction === 'prev') {
          currentIndex--;
        } else if (direction === 'next') {
          currentIndex++;
        }
        updateCarousel(true);
        if (autoScrollEnabled) startAutoScroll();
      });
    });

    // Dot navigation
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        stopAutoScroll();
        const index = parseInt(dot.getAttribute('data-index'));
        currentIndex = totalItems + index;
        updateCarousel(true);
        if (autoScrollEnabled) startAutoScroll();
      });
    });

    // Pause on hover
    carousel.addEventListener('mouseenter', stopAutoScroll);
    carousel.addEventListener('mouseleave', () => {
      if (autoScrollEnabled) startAutoScroll();
    });

    // Add touch controls for mobile devices
    let touchStartX = 0;
    let touchCurrentX = 0;
    let isDragging = false;

    carousel.addEventListener('touchstart', (e) => {
      stopAutoScroll();
      touchStartX = e.touches[0].clientX;
      touchCurrentX = touchStartX;
      isDragging = true;
      carousel.style.transition = 'none'; // Disable animation during swipe
    });

    carousel.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      touchCurrentX = e.touches[0].clientX;
      const diff = touchCurrentX - touchStartX;
      const newOffset = -currentIndex * itemWidth + diff;
      carousel.style.transform = `translateX(${newOffset}px)`;
    });

    carousel.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diff = touchCurrentX - touchStartX;
      const threshold = itemWidth / 3; // Threshold for switching slides

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          currentIndex--; // Swipe right
        } else {
          currentIndex++; // Swipe left
        }
      }

      carousel.style.transition = 'transform 0.5s ease';
      updateCarousel(true);
      if (autoScrollEnabled) startAutoScroll();
    });

    // Initialization
    updateCarousel(false);
    startAutoScroll(); // Attempt to start auto-scroll
  });

*/
