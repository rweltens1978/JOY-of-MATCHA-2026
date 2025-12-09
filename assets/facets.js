var current = "";
var mainCurrent = "";
class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    mainCurrent = this;
    this.debouncedOnSubmit = debounce((event) => {
      current = this;
      this.onSubmitHandler(event);
    }, 500);
    var allCheckbox = document.querySelectorAll('form input[type=checkbox]');
    if(allCheckbox)
    {
      allCheckbox.forEach((element) => {
        element.addEventListener('change', this.debouncedOnSubmit.bind(this));
      });  
    }
    var allNumber = document.querySelectorAll('form input[type=number]');
    if(allNumber)
    {
      allNumber.forEach((element) => {
        element.addEventListener('change', this.debouncedOnSubmit.bind(this));
      });  
    }
    if(document.querySelector("#SortBy"))
    {
      document.querySelector("#SortBy").addEventListener('change', this.debouncedOnSubmit.bind(this));
    }
    if(document.querySelector("#SortBy-mobile"))
    {
      document.querySelector("#SortBy-mobile").addEventListener('change',(event) => {
        var getCurrentValue = event.target.value;
        
        document.querySelector("#SortBy").value = getCurrentValue;
        var FacetFiltersFormNew = new FacetFiltersForm();
        FacetFiltersFormNew.onSubmitHandler(event);
      });
    }
    var rangeInput = document.querySelectorAll(".range-input input");
    var priceInput = document.querySelectorAll(".price-input input");
    if(rangeInput && priceInput)
    {
        var range = document.querySelector(".slider .progress");
        let priceGap = 10;
        priceInput.forEach((input) => {
            input.addEventListener("change", (e) => {
                let minPrice = parseInt(priceInput[0].value),
                maxPrice = parseInt(priceInput[1].value);

                if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
                    if (e.target.className === "input-min") {
                        rangeInput[0].value = minPrice;
                        range.style.left = (minPrice / rangeInput[0].max) * 10 + "%";
                    } else {
                        rangeInput[1].value = maxPrice;
                        range.style.right = 100 - (maxPrice / rangeInput[1].max) * 10 + "%";
                    }
                }
            });
        });
        rangeInput.forEach((input) => {
            input.addEventListener("change", (e) => {
                let minVal = parseInt(rangeInput[0].value),
                maxVal = parseInt(rangeInput[1].value);

                if (maxVal - minVal < priceGap) {
                    if (e.target.className === "range-min") {
                        rangeInput[0].value = maxVal - priceGap;
                    } else {
                        rangeInput[1].value = minVal + priceGap;
                    }
                } else {
                    priceInput[0].value = minVal;
                    priceInput[1].value = maxVal;
                    range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
                    range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
                }
                this.onSubmitHandler(e);
            });
        });
    }

    const facetWrapper = this.querySelector('#FacetsWrapperDesktop');
    if (facetWrapper) facetWrapper.addEventListener('keyup', onKeyUpEscape);
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    }
    window.addEventListener('popstate', onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll('.js-facet-remove').forEach((element) => {
      element.classList.toggle('disabled', disable);
    });
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    const countContainer = document.getElementById('ProductCount');
    const countContainerDesktop = document.getElementById('ProductCountDesktop');
    document.getElementById('ProductGridContainer').querySelector('.collection').classList.add('loading');
    if (countContainer){
      countContainer.classList.add('loading');
    }
    if (countContainerDesktop){
      countContainerDesktop.classList.add('loading');
    }

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = element => element.url === url;

      FacetFiltersForm.filterData.some(filterDataUrl) ?
        FacetFiltersForm.renderSectionFromCache(filterDataUrl, event) :
        FacetFiltersForm.renderSectionFromFetch(url, event);
    });

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
        FacetFiltersForm.renderFilters(html, event);
        FacetFiltersForm.renderProductGridContainer(html);
        FacetFiltersForm.renderProductCount(html);
          var accordionItemHeadersNew = document.querySelectorAll(".accordion-head");
          if(accordionItemHeadersNew)
          {
            accordionItemHeadersNew.forEach(accordionItemHeaderNew => {
               accordionItemHeaderNew.addEventListener("click", event => {

                 accordionItemHeaderNew.classList.toggle("active");
                 const accordionItemBody = accordionItemHeaderNew.nextElementSibling;
                 if(accordionItemHeaderNew.classList.contains("active")) {
                  accordionItemBody.style.maxHeight = accordionItemBody.scrollHeight + "px";
                 }
                 else {
                   accordionItemBody.style.maxHeight = 0;
                 }
                
               });
            });  
          }
          this.debouncedOnSubmit = debounce((event) => {
              var FacetFiltersFormNew = new FacetFiltersForm();
                FacetFiltersFormNew.onSubmitHandler(event);
            }, 500);
          var allCheckbox = document.querySelectorAll('form input[type=checkbox]');
          if(allCheckbox)
          {
            allCheckbox.forEach((element) => {
              element.addEventListener('change', this.debouncedOnSubmit.bind(this));
            });  
          }
          var allNumber = document.querySelectorAll('form input[type=number]');
          if(allNumber)
          {
            allNumber.forEach((element) => {
              element.addEventListener('change', this.debouncedOnSubmit.bind(this));
            });  
          }
          if(document.querySelector("#SortBy"))
          {
            document.querySelector("#SortBy").addEventListener('change', this.debouncedOnSubmit.bind(this));
          }
          if(document.querySelector("#SortBy-mobile"))
          {
            document.querySelector("#SortBy-mobile").addEventListener('change',(e) => {
              var getCurrentValue = this.value;
              document.querySelector("#SortBy").value = getCurrentValue;
              this.debouncedOnSubmit.bind(this);
            });
          }
          var rangeInput = document.querySelectorAll(".range-input input");
          var priceInput = document.querySelectorAll(".price-input input");
          if(rangeInput && priceInput)
          {
              var range = document.querySelector(".slider .progress");
              let priceGap = 10;
              priceInput.forEach((input) => {
                  input.addEventListener("change", (e) => {
                      let minPrice = parseInt(priceInput[0].value),
                      maxPrice = parseInt(priceInput[1].value);

                      if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
                          if (e.target.className === "input-min") {
                              rangeInput[0].value = minPrice;
                              range.style.left = (minPrice / rangeInput[0].max) * 10 + "%";
                          } else {
                              rangeInput[1].value = maxPrice;
                              range.style.right = 100 - (maxPrice / rangeInput[1].max) * 10 + "%";
                          }
                      }
                  });
              });
              rangeInput.forEach((input) => {
                  input.addEventListener("change", (e) => {
                      let minVal = parseInt(rangeInput[0].value),
                      maxVal = parseInt(rangeInput[1].value);

                      if (maxVal - minVal < priceGap) {
                          if (e.target.className === "range-min") {
                              rangeInput[0].value = maxVal - priceGap;
                          } else {
                              rangeInput[1].value = minVal + priceGap;
                          }
                      } else {
                          priceInput[0].value = minVal;
                          priceInput[1].value = maxVal;
                          range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
                          range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
                      }
                      var FacetFiltersFormNew = new FacetFiltersForm();
                      FacetFiltersFormNew.onSubmitHandler(e);
                  });
              });
          }
          if(rangeInput && priceInput)
          {
              var range = document.querySelector(".slider .progress");
              let priceGap = 10;
              priceInput.forEach((input) => {
                  let minPrice = parseInt(priceInput[0].value),
                  maxPrice = parseInt(priceInput[1].value);

                  if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
                      if (input.className === "input-min") {
                          rangeInput[0].value = minPrice;
                          range.style.left = (minPrice / rangeInput[0].max) * 10 + "%";
                      } else {
                          rangeInput[1].value = maxPrice;
                          range.style.right = 100 - (maxPrice / rangeInput[1].max) * 10 + "%";
                      }
                  }
              });
              rangeInput.forEach((input) => {
                  let minVal = parseInt(rangeInput[0].value),
                  maxVal = parseInt(rangeInput[1].value);

                  if (maxVal - minVal < priceGap) {
                      if (input.className === "range-min") {
                          rangeInput[0].value = maxVal - priceGap;
                      } else {
                          rangeInput[1].value = minVal + priceGap;
                      }
                  } else {
                      // priceInput[0].value = minVal;
                      // priceInput[1].value = maxVal;
                      range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
                      range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
                  }
              });
          }
          var filterLoadMore = document.querySelectorAll(".btn-load-more");
          if(filterLoadMore)
          {
              filterLoadMore.forEach(function (el, key) {
                  el.addEventListener('click', function (event) {
                      event.preventDefault();
                      this.parentElement.querySelectorAll(".item").forEach(function (newEl, newKey) {
                          newEl.classList.remove("hiddenStyle");
                      });
                      el.style.display = "none";
                  });
              });
          }
          var productVariantSelect = document.querySelectorAll('.product-form .product-form__variants');
          if(productVariantSelect)
          {
              productVariantSelect.forEach(function (topel, topkey) {
                  topel.addEventListener('change', function(event) {
                      var current = this;
                      if(current.parentElement.parentElement.parentElement.classList.contains('product__detail')) // collection and home page product lists
                      {
                           var variantAvailable = this.options[this.selectedIndex].getAttribute('data-available');
                          var variantIsSalePrice = this.options[this.selectedIndex].getAttribute('data-is-sale-price');
                          var variantSalePrice = this.options[this.selectedIndex].getAttribute('data-old-price');
                          var variantOriginalPrice = this.options[this.selectedIndex].getAttribute('data-sale-price');
                          var variantId = this.options[this.selectedIndex].getAttribute("value");
                          var variantOriginalImage = this.options[this.selectedIndex].getAttribute('data-original-image');
                          var productFullBoxWrapper = this.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
                          var productBoxWrapper = this.parentElement.parentElement.parentElement.parentElement;
                          var productFormWrapper = this.parentElement.parentElement;
                          var priceHtml = '';
                          if(productFormWrapper.classList.contains('gift-card__form'))
                          {
                              var fromText = productBoxWrapper.querySelector(".product__meta").getAttribute("data-from-text");
                              priceHtml += '<div class="gift-card__price">';
                              if(fromText != "undefined" && fromText != null && fromText != "")
                              {
                                  priceHtml += fromText+' ';
                              }
                              priceHtml += '<span class="product__price-original"><b>'+ Shopify.formatMoney(variantOriginalPrice, theme.settings.moneyFormat) +'</b></span>';
                              if(variantIsSalePrice == "true")
                              {
                                  priceHtml += '<span class="product__price-sale">'+ Shopify.formatMoney(variantSalePrice, theme.settings.moneyFormat) +'</span>';
                              }
                              priceHtml += '</div>';
                          }
                          else
                          {
                              priceHtml += '<div class="product__price">';
                              if(variantIsSalePrice == "true")
                              {
                                  priceHtml += '<span class="product__price-sale">'+ Shopify.formatMoney(variantSalePrice, theme.settings.moneyFormat) +'</span>';
                              }
                              priceHtml += '<span class="product__price-original">'+ Shopify.formatMoney(variantOriginalPrice, theme.settings.moneyFormat) +'</span>';
                              priceHtml += '</div>';
                              if(variantIsSalePrice == "true")
                              {
                                  var totalPer = parseInt(variantSalePrice) - parseInt(variantOriginalPrice);
                                      totalPer = parseInt(totalPer) * 100;
                                      totalPer = parseInt(totalPer) / parseInt(variantSalePrice);
                                      totalPer = parseInt(totalPer) * 100;
                                      totalPer = totalPer.toFixed(2);
                                      totalPer = totalPer.replace(".00", "");
                                      totalPer = parseInt(totalPer) / 100;
                                  priceHtml += '<span class="badge">Save '+totalPer+'%</span>';
                              }
                          }
                          productBoxWrapper.querySelector(".product__meta").innerHTML = priceHtml;
                          var productUrl = productBoxWrapper.querySelector(".product__image-container a").getAttribute('data-replace-url');
                          var newProducturl = productUrl + '?variant=' + variantId;
                          productBoxWrapper.querySelector(".product__image-container a").setAttribute("href", newProducturl);
                          productBoxWrapper.querySelector(".product__detail a.product__title").setAttribute("href", newProducturl);
                          if(typeof variantOriginalImage != "undefined" && variantOriginalImage != null && variantOriginalImage != "")
                          {
                              productBoxWrapper.querySelector(".product__image-container a img.original-image").setAttribute("src", variantOriginalImage);
                          }
                      }
                  });    
              });
          }
          var productOptionWrapper = document.querySelectorAll('.product-form .product__options .custom-radio');
          if(productOptionWrapper)
          {   
              if(document.querySelector('.product-form .product__options .custom-radio input'))
              {
                  var productOptionRadioWrapper = document.querySelectorAll('.product-form .product__options .custom-radio');
                  productOptionRadioWrapper.forEach(function (topel, topkey) {
                      var radioSelection = topel.querySelector('input');
                      radioSelection.addEventListener('change', function(event) {
                          var current = this;
                          setTimeout(function(){
                              var parentRow = current.parentElement.parentElement.parentElement.parentElement;
                              if(current.parentElement.parentElement.parentElement.parentElement.parentElement.classList.contains('product__detail')) // collection and home page product lists
                              {
                                  var productForm = current.parentElement.parentElement.parentElement.parentElement;
                              }
                              else
                              {
                                var productForm = current.parentElement.parentElement.parentElement.parentElement.parentElement;  
                              }
                              var productOptionsLists = parentRow.querySelectorAll('.product__options');
                              
                              var selectedValue = "";
                              if (productOptionsLists) {
                                  productOptionsLists.forEach(function (el, key) {
                                      var currentValue = "";
                                      var radioWrapper = el.querySelectorAll('.custom-radio');
                                      radioWrapper.forEach(function (newel, newkey) {
                                          var hasRadio = newel.querySelector('input');
                                          if(hasRadio && hasRadio.checked)
                                          {
                                              currentValue = hasRadio.value;
                                          }
                                      });
                                      if(currentValue)
                                      {
                                          if(el.nextElementSibling.classList.contains('product__options'))
                                          {
                                              selectedValue += currentValue+" / ";
                                          }
                                          else
                                          {
                                              selectedValue += currentValue;
                                          }
                                      }
                                  });
                                  if(selectedValue)
                                  {
                                      var productvariantsLists = productForm.querySelector('.product-form__variants');
                                      if(productvariantsLists)
                                      {
                                          var isvariantMatched = false;
                                          for (var option of productvariantsLists.options) {
                                              option.removeAttribute("selected");
                                          }
                                          for (var option of productvariantsLists.options) {
                                              var matchAttribute = option.getAttribute("data-match");
                                              if(matchAttribute == selectedValue)
                                              {
                                                  var matchAttributeValue = option.getAttribute("value");
                                                  productvariantsLists.value = matchAttributeValue;
                                                  if(document.querySelector('.shopify-payment-terms'))
                                                  {
                                                    document.querySelector('.shopify-payment-terms').setAttribute("variant-id", matchAttributeValue);
                                                  }
                                                  option.setAttribute("selected", "selected");
                                                  isvariantMatched = true;
                                                  productvariantsLists.dispatchEvent(new Event('change'));
                                              }
                                          }
                                          if(!isvariantMatched)
                                          {
                                              productForm.querySelector(".product_atc_button").setAttribute("disabled", "disabled");
                                              var buttonText = productForm.querySelector(".product_atc_button").getAttribute("data-oos-text");
                                              productForm.querySelector(".product_atc_button").innerHTML = buttonText;
                                          }
                                      }
                                  }
                              }
                          }, 500);
                      });
                  });
              }
          }
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderProductGridContainer(html);
    FacetFiltersForm.renderProductCount(html);
    this.debouncedOnSubmit = debounce((event) => {
        var FacetFiltersFormNew = new FacetFiltersForm();
          FacetFiltersFormNew.onSubmitHandler(event);
      }, 500);
    var allCheckbox = document.querySelectorAll('form input[type=checkbox]');
    if(allCheckbox)
    {
      allCheckbox.forEach((element) => {
        element.addEventListener('change', this.debouncedOnSubmit.bind(this));
      });  
    }
    var allNumber = document.querySelectorAll('form input[type=number]');
    if(allNumber)
    {
      allNumber.forEach((element) => {
        element.addEventListener('change', this.debouncedOnSubmit.bind(this));
      });  
    }
    if(document.querySelector("#SortBy"))
    {
      document.querySelector("#SortBy").addEventListener('change', this.debouncedOnSubmit.bind(this));
    }
    if(document.querySelector("#SortBy-mobile"))
    {
      document.querySelector("#SortBy-mobile").addEventListener('change',(e) => {
        var getCurrentValue = this.value;
        document.querySelector("#SortBy").value = getCurrentValue;
        this.debouncedOnSubmit.bind(this);
      });
    }
    var rangeInput = document.querySelectorAll(".range-input input");
    var priceInput = document.querySelectorAll(".price-input input");
    if(rangeInput && priceInput)
    {
        var range = document.querySelector(".slider .progress");
        let priceGap = 10;
        priceInput.forEach((input) => {
            input.addEventListener("change", (e) => {
                let minPrice = parseInt(priceInput[0].value),
                maxPrice = parseInt(priceInput[1].value);

                if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
                    if (e.target.className === "input-min") {
                        rangeInput[0].value = minPrice;
                        range.style.left = (minPrice / rangeInput[0].max) * 10 + "%";
                    } else {
                        rangeInput[1].value = maxPrice;
                        range.style.right = 100 - (maxPrice / rangeInput[1].max) * 10 + "%";
                    }
                }
            });
        });
        rangeInput.forEach((input) => {
            input.addEventListener("change", (e) => {
                let minVal = parseInt(rangeInput[0].value),
                maxVal = parseInt(rangeInput[1].value);

                if (maxVal - minVal < priceGap) {
                    if (e.target.className === "range-min") {
                        rangeInput[0].value = maxVal - priceGap;
                    } else {
                        rangeInput[1].value = minVal + priceGap;
                    }
                } else {
                    priceInput[0].value = minVal;
                    priceInput[1].value = maxVal;
                    range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
                    range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
                }
                var FacetFiltersFormNew = new FacetFiltersForm();
                FacetFiltersFormNew.onSubmitHandler(e);
            });
        });
    }
    if(rangeInput && priceInput)
    {
        var range = document.querySelector(".slider .progress");
        let priceGap = 10;
        priceInput.forEach((input) => {
            let minPrice = parseInt(priceInput[0].value),
            maxPrice = parseInt(priceInput[1].value);

            if (maxPrice - minPrice >= priceGap && maxPrice <= rangeInput[1].max) {
                if (input.className === "input-min") {
                    rangeInput[0].value = minPrice;
                    range.style.left = (minPrice / rangeInput[0].max) * 10 + "%";
                } else {
                    rangeInput[1].value = maxPrice;
                    range.style.right = 100 - (maxPrice / rangeInput[1].max) * 10 + "%";
                }
            }
        });
        rangeInput.forEach((input) => {
            let minVal = parseInt(rangeInput[0].value),
            maxVal = parseInt(rangeInput[1].value);

            if (maxVal - minVal < priceGap) {
                if (input.className === "range-min") {
                    rangeInput[0].value = maxVal - priceGap;
                } else {
                    rangeInput[1].value = minVal + priceGap;
                }
            } else {
                // priceInput[0].value = minVal;
                // priceInput[1].value = maxVal;
                range.style.left = (minVal / rangeInput[0].max) * 100 + "%";
                range.style.right = 100 - (maxVal / rangeInput[1].max) * 100 + "%";
            }
        });
    }
    var filterLoadMore = document.querySelectorAll(".btn-load-more");
    if(filterLoadMore)
    {
        filterLoadMore.forEach(function (el, key) {
            el.addEventListener('click', function (event) {
                event.preventDefault();
                this.parentElement.querySelectorAll(".item").forEach(function (newEl, newKey) {
                    newEl.classList.remove("hiddenStyle");
                });
                el.style.display = "none";
            });
        });
    }
    var productVariantSelect = document.querySelectorAll('.product-form .product-form__variants');
    if(productVariantSelect)
    {
        productVariantSelect.forEach(function (topel, topkey) {
            topel.addEventListener('change', function(event) {
                var current = this;
                if(current.parentElement.parentElement.parentElement.classList.contains('product__detail')) // collection and home page product lists
                {
                     var variantAvailable = this.options[this.selectedIndex].getAttribute('data-available');
                    var variantIsSalePrice = this.options[this.selectedIndex].getAttribute('data-is-sale-price');
                    var variantSalePrice = this.options[this.selectedIndex].getAttribute('data-old-price');
                    var variantOriginalPrice = this.options[this.selectedIndex].getAttribute('data-sale-price');
                    var variantId = this.options[this.selectedIndex].getAttribute("value");
                    var variantOriginalImage = this.options[this.selectedIndex].getAttribute('data-original-image');
                    var productFullBoxWrapper = this.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
                    var productBoxWrapper = this.parentElement.parentElement.parentElement.parentElement;
                    var productFormWrapper = this.parentElement.parentElement;
                    var priceHtml = '';
                    if(productFormWrapper.classList.contains('gift-card__form'))
                    {
                        var fromText = productBoxWrapper.querySelector(".product__meta").getAttribute("data-from-text");
                        priceHtml += '<div class="gift-card__price">';
                        if(fromText != "undefined" && fromText != null && fromText != "")
                        {
                            priceHtml += fromText+' ';
                        }
                        priceHtml += '<span class="product__price-original"><b>'+ Shopify.formatMoney(variantOriginalPrice, theme.settings.moneyFormat) +'</b></span>';
                        if(variantIsSalePrice == "true")
                        {
                            priceHtml += '<span class="product__price-sale">'+ Shopify.formatMoney(variantSalePrice, theme.settings.moneyFormat) +'</span>';
                        }
                        priceHtml += '</div>';
                    }
                    else
                    {
                        priceHtml += '<div class="product__price">';
                        if(variantIsSalePrice == "true")
                        {
                            priceHtml += '<span class="product__price-sale">'+ Shopify.formatMoney(variantSalePrice, theme.settings.moneyFormat) +'</span>';
                        }
                        priceHtml += '<span class="product__price-original">'+ Shopify.formatMoney(variantOriginalPrice, theme.settings.moneyFormat) +'</span>';
                        priceHtml += '</div>';
                        if(variantIsSalePrice == "true")
                        {
                            var totalPer = parseInt(variantSalePrice) - parseInt(variantOriginalPrice);
                                totalPer = parseInt(totalPer) * 100;
                                totalPer = parseInt(totalPer) / parseInt(variantSalePrice);
                                totalPer = parseInt(totalPer) * 100;
                                totalPer = totalPer.toFixed(2);
                                totalPer = totalPer.replace(".00", "");
                                totalPer = parseInt(totalPer) / 100;
                            priceHtml += '<span class="badge">Save '+totalPer+'%</span>';
                        }
                    }
                    productBoxWrapper.querySelector(".product__meta").innerHTML = priceHtml;
                    var productUrl = productBoxWrapper.querySelector(".product__image-container a").getAttribute('data-replace-url');
                    var newProducturl = productUrl + '?variant=' + variantId;
                    productBoxWrapper.querySelector(".product__image-container a").setAttribute("href", newProducturl);
                    productBoxWrapper.querySelector(".product__detail a.product__title").setAttribute("href", newProducturl);
                    if(typeof variantOriginalImage != "undefined" && variantOriginalImage != null && variantOriginalImage != "")
                    {
                        productBoxWrapper.querySelector(".product__image-container a img.original-image").setAttribute("src", variantOriginalImage);
                    }
                }
            });    
        });
    }
    var productOptionWrapper = document.querySelectorAll('.product-form .product__options .custom-radio');
    if(productOptionWrapper)
    {   
        if(document.querySelector('.product-form .product__options .custom-radio input'))
        {
            var productOptionRadioWrapper = document.querySelectorAll('.product-form .product__options .custom-radio');
            productOptionRadioWrapper.forEach(function (topel, topkey) {
                var radioSelection = topel.querySelector('input');
                radioSelection.addEventListener('change', function(event) {
                    var current = this;
                    setTimeout(function(){
                        var parentRow = current.parentElement.parentElement.parentElement.parentElement;
                        if(current.parentElement.parentElement.parentElement.parentElement.parentElement.classList.contains('product__detail')) // collection and home page product lists
                        {
                            var productForm = current.parentElement.parentElement.parentElement.parentElement;
                        }
                        else
                        {
                          var productForm = current.parentElement.parentElement.parentElement.parentElement.parentElement;  
                        }
                        var productOptionsLists = parentRow.querySelectorAll('.product__options');
                        
                        var selectedValue = "";
                        if (productOptionsLists) {
                            productOptionsLists.forEach(function (el, key) {
                                var currentValue = "";
                                var radioWrapper = el.querySelectorAll('.custom-radio');
                                radioWrapper.forEach(function (newel, newkey) {
                                    var hasRadio = newel.querySelector('input');
                                    if(hasRadio && hasRadio.checked)
                                    {
                                        currentValue = hasRadio.value;
                                    }
                                });
                                if(currentValue)
                                {
                                    if(el.nextElementSibling.classList.contains('product__options'))
                                    {
                                        selectedValue += currentValue+" / ";
                                    }
                                    else
                                    {
                                        selectedValue += currentValue;
                                    }
                                }
                            });
                            if(selectedValue)
                            {
                                var productvariantsLists = productForm.querySelector('.product-form__variants');
                                if(productvariantsLists)
                                {
                                    var isvariantMatched = false;
                                    for (var option of productvariantsLists.options) {
                                        option.removeAttribute("selected");
                                    }
                                    for (var option of productvariantsLists.options) {
                                        var matchAttribute = option.getAttribute("data-match");
                                        if(matchAttribute == selectedValue)
                                        {
                                            var matchAttributeValue = option.getAttribute("value");
                                            productvariantsLists.value = matchAttributeValue;
                                            if(document.querySelector('.shopify-payment-terms'))
                                            {
                                              document.querySelector('.shopify-payment-terms').setAttribute("variant-id", matchAttributeValue);
                                            }
                                            option.setAttribute("selected", "selected");
                                            isvariantMatched = true;
                                            productvariantsLists.dispatchEvent(new Event('change'));
                                        }
                                    }
                                    if(!isvariantMatched)
                                    {
                                        productForm.querySelector(".product_atc_button").setAttribute("disabled", "disabled");
                                        var buttonText = productForm.querySelector(".product_atc_button").getAttribute("data-oos-text");
                                        productForm.querySelector(".product_atc_button").innerHTML = buttonText;
                                    }
                                }
                            }
                        }
                    }, 500);
                });
            });
        }
    }
  }

  static renderProductGridContainer(html) {
    document.getElementById('ProductGridContainer').innerHTML = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductGridContainer').innerHTML;
  }

  static renderProductCount(html) {
    const count = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductCount').innerHTML
    const container = document.getElementById('ProductCount');
    const containerDesktop = document.getElementById('ProductCountDesktop');
    container.innerHTML = count;
    container.classList.remove('loading');
    if (containerDesktop) {
      containerDesktop.innerHTML = count;
      containerDesktop.classList.remove('loading');
    }
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');

    const facetDetailsElements =
      parsedHTML.querySelectorAll('#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter');
    const matchesIndex = (element) => {
      const jsFilter = event ? event.target.closest('.js-filter') : undefined;
      return jsFilter ? element.dataset.index === jsFilter.dataset.index : false;
    }
    const facetsToRender = Array.from(facetDetailsElements).filter(element => !matchesIndex(element));
    const countsToRender = Array.from(facetDetailsElements).find(matchesIndex);

    facetsToRender.forEach((element) => {
      document.querySelector(`.js-filter[data-index="${element.dataset.index}"]`).innerHTML = element.innerHTML;
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);

    if (countsToRender) FacetFiltersForm.renderCounts(countsToRender, event.target.closest('.js-filter'));
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = ['.active-facets-mobile', '.active-facets-desktop'];

    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
    })

    FacetFiltersForm.toggleActiveFacets(false);
  }

  static renderAdditionalElements(html) {
    const mobileElementSelectors = ['.mobile-facets__open', '.mobile-facets__count', '.sorting'];

    mobileElementSelectors.forEach((selector) => {
      if (!html.querySelector(selector)) return;
      document.querySelector(selector).innerHTML = html.querySelector(selector).innerHTML;
    });

    // document.getElementById('FacetFiltersFormMobile').closest('menu-drawer').bindEvents();
  }

  static renderCounts(source, target) {
    const targetElement = target.querySelector('.facets__selected');
    const sourceElement = source.querySelector('.facets__selected');

    if (sourceElement && targetElement) {
      target.querySelector('.facets__selected').outerHTML = source.querySelector('.facets__selected').outerHTML;
    }
  }

  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  static getSections() {
    return [
      {
        section: document.getElementById('product-grid').dataset.id,
      }
    ]
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const formData = new FormData(event.target.closest('form'));
    const searchParams = new URLSearchParams(formData).toString();
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.toggleActiveFacets();
    const url = event.currentTarget.href.indexOf('?') == -1 ? '' : event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
    FacetFiltersForm.renderPage(url);
  }
}

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();

class PriceRange extends HTMLElement {
  constructor() {
    super();
    this.querySelectorAll('input[type=number]')
      .forEach(element => element.addEventListener('change', this.onRangeChange.bind(this)));

    this.setMinAndMaxValues();
  }

  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll('input[type=number]');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (maxInput.value) minInput.setAttribute('max', maxInput.value);
    if (minInput.value) maxInput.setAttribute('min', minInput.value);
    if (minInput.value === '') maxInput.setAttribute('min', 0);
    if (maxInput.value === '') minInput.setAttribute('max', maxInput.getAttribute('max'));
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute('min'));
    const max = Number(input.getAttribute('max'));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }
}

customElements.define('price-range', PriceRange);

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    this.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
      form.onActiveFilterClick(event);
    });
  }
}

customElements.define('facet-remove', FacetRemove);

