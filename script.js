(function () {
  // Default language code for localization, fallback to Spanish if undefined
  const defaultLanguage = php_var.Language || "tr";

  // Current language key used for fetching messages
  const langKey = defaultLanguage;

  // Container for localized messages loaded from JSON
  let errorMessages = {};

  // CSS class name for full-page loader
  const pageLoaderClass = "pageloader";

  /**
   * Create and insert the page loader element and its styles into the DOM.
   */
  function createPageLoader() {
    const loader = document.createElement("div");
    loader.className = pageLoaderClass;

    const style = document.createElement("style");
    style.type = "text/css";
    style.textContent = `.${pageLoaderClass} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      background: url("https://cdnjs.cloudflare.com/ajax/libs/galleriffic/2.0.1/css/loader.gif") center no-repeat #f9f9f9;
      opacity: 0.8;
    }`;

    document.head.appendChild(style);
    document.body.insertBefore(loader, document.body.firstChild);

    // Hide loader when page fully loads
    window.addEventListener("load", () => {
      document.querySelector(`.${pageLoaderClass}`).style.display = "none";
    });
  }

  /**
   * Show the full-page loader.
   */
  function showLoader() {
    document.querySelector(`.${pageLoaderClass}`).style.display = "block";
  }

  /**
   * Hide the full-page loader.
   */
  function hideLoader() {
    document.querySelector(`.${pageLoaderClass}`).style.display = "none";
  }

  /**
   * Load localized error and status messages from JSON.
   */
  async function loadErrorMessages() {
    try {
      const response = await fetch("../api/int/errorMessages.json");
      if (!response.ok)
        throw new Error(`Failed to fetch messages: ${response.status}`);
      errorMessages = await response.json();
    } catch (e) {
      console.error("Error loading error messages:", e);
    }
  }

  /**
   * Configure Toastr notification settings.
   */
  function configureToastr() {
    toastr.options = {
      positionClass: "toast-top-right",
      timeOut: "7000",
      extendedTimeOut: "1000",
      zIndex: 9999,
      closeButton: false,
      preventDuplicates: true,
      tapToDismiss: true,
    };
  }

  /**
   * Retrieve localized message by key, falling back to English.
   */
  function getErrorMessage(key) {
    return (
      (errorMessages[langKey] && errorMessages[langKey][key]) ||
      (errorMessages["tr"] && errorMessages["tr"][key]) ||
      ""
    );
  }

  /**
   * Main form initialization: validation listeners, scripts loading, and submission handler.
   */
  function initializeForm(form) {
    initializeFormSubmission(form);
    disableSubmitButton(form);
    setupFieldListeners(form);
    $(form).find("#firstName, #lastName").on("blur", validateNameField);

    Promise.all([
      loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/19.2.16/js/utils.js"
      ),
      loadScript("../api/int/mailcheck.min.js"),
    ])
      .then(() => {
        initializePhoneValidation(form);
        initializeEmailValidation(form);
      })
      .catch((err) => console.error("Script load error:", err));
  }

  /**
   * Setup input listeners to toggle submit button.
   */
  function setupFieldListeners(form) {
    ["#firstName", "#lastName", "#phone", "#email"].forEach((sel) => {
      const el = form.querySelector(sel);
      if (el) el.addEventListener("input", () => toggleSubmitButton(form));
    });
  }

  /**
   * Handle form submission with validation and AJAX.
   */
  function initializeFormSubmission(form) {
    $(form).on("submit", function (e) {
      e.preventDefault();
      if (!isFormValid(form) || $(this).prop("disabled")) {
        console.log("Form invalid or disabled.");
        hideLoader();
        enableSubmitButton(form);
        return;
      }

      const payload = collectFormData();
      const formData = new FormData();
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

      $.ajax({
        url: "../api/action.php",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        dataType: "json",
        beforeSend() {
          showLoader();
          disableSubmitButton(form);
        },
        success(response) {
          localStorage.setItem("thanks", true);
          toastr.success(getErrorMessage("thanks"));
          window.location.href = "thankyou.php";
        },
        error() {
          toastr.error(getErrorMessage("ajaxError"));
          hideLoader();
          enableSubmitButton(form);
        },
      });
    });
  }

  /**
   * Collect form data and merge server-side vars.
   */
  function collectFormData() {
    const data = {
      firstName: $("#firstName").val(),
      lastName: $("#lastName").val(),
      email: $("#email").val(),
      phoneNumber: php_var.phone,
    };
    Object.keys(php_var).forEach((key) => {
      if (!data.hasOwnProperty(key)) data[key] = php_var[key];
    });
    return data;
  }

  /**
   * Check overall form validity based on CSS classes.
   */
  function isFormValid(form) {
    const nameValid =
      fieldValid(form, "#firstName") && fieldValid(form, "#lastName");
    const phoneValid = fieldValid(form, "#phone");
    const emailOk = !form.querySelector("#email") || fieldValid(form, "#email");
    return nameValid && phoneValid && emailOk;
  }

  /**
   * Helper to check if a field has .valid class.
   */
  function fieldValid(form, sel) {
    const el = form.querySelector(sel);
    return el && el.classList.contains("valid");
  }

  /**
   * Disable submit button for a given form.
   */
  function disableSubmitButton(form) {
    $(form)
      .find("input[type=submit]")
      .prop("disabled", true)
      .css("opacity", "0.3");
  }

  /**
   * Enable submit button for a given form.
   */
  function enableSubmitButton(form) {
    $(form)
      .find("input[type=submit]")
      .prop("disabled", false)
      .css("opacity", "1");
  }

  /**
   * Toggle submit button state based on form validity.
   */
  function toggleSubmitButton(form) {
    const enabled = isFormValid(form);
    $(form)
      .find("input[type=submit]")
      .prop("disabled", !enabled)
      .css("opacity", enabled ? "1" : "0.3");
  }

  /**
   * Dynamically load a script and return promise.
   */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /**
   * Validate name fields, allowing Unicode letters (including language-specific characters) and spaces.
   *
   * @param {Event} event - The blur event triggered on the input field.
   * @param {string} lang - Language code for localized messages, defaults to defaultLanguage.
   */
  function validateNameField(event, lang = defaultLanguage) {
    const input = event.target;
    const value = input.value;
    let valid = true;
    // Determine message key prefixes based on which field is being validated
    const errorKeyPrefix =
      input.id === "firstName" ? "invalidFirstName" : "invalidLastName";
    const validKeyPrefix =
      input.id === "firstName" ? "validFirstName" : "validLastName";

    // Check minimum length
    if (value.length < 2) {
      valid = false;
      toastr.error(getErrorMessage(`${errorKeyPrefix}Length`, lang));
    }
    // Check allowed characters: Unicode letters (including marks), spaces, apostrophes (both ' and ’), and hyphens
    else if (!/^[\p{L}\p{M}\s'’-]+$/u.test(value)) {
      valid = false;
      toastr.error(getErrorMessage(`${errorKeyPrefix}Characters`, lang));
    }
    // If both checks pass, mark as valid
    else {
      toastr.success(getErrorMessage(validKeyPrefix, lang));
    }

    // Toggle CSS classes based on validity
    input.classList.toggle("invalid", !valid);
    input.classList.toggle("valid", valid);
  }

  /**
   * Initialize phone validation for all phone inputs in the form.
   * @param {HTMLFormElement} form
   */
  function initializePhoneValidation(form) {
    // Select all phone inputs (by type or id) within this form
    const inputs = form.querySelectorAll('input[type="tel"], #phone');
    inputs.forEach((input) => {
      // Initialize intl-tel-input on each input
      const iti = window.intlTelInput(input, {
       // initialCountry: "auto",
        separateDialCode: true,
        onlyCountries: ["TR"], 
        allowDropdown: false,
        formatOnDisplay: true,
        autoPlaceholder: "polite",
        placeholderNumberType: "MOBILE",
        showSelectedDialCode: true,
        geoIpLookup: function (callback) {
          $.get("https://ipinfo.io", function () {}, "jsonp").always(function (
            resp
          ) {
            callback(resp && resp.country ? resp.country : "TR");
          });
        },
        utilsScript:
          "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/19.2.16/js/utils.js",
      });
      // Set up events for validation and toggle
      input.addEventListener("blur", () => validatePhoneNumber(iti, input));
      input.addEventListener("countrychange", () =>
        updatePlaceholder(iti, input)
      );
      // Immediately update placeholder
      updatePlaceholder(iti, input);
      // Watch for valid/invalid class changes to toggle submit
      new MutationObserver(() => toggleSubmitButton(form)).observe(input, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });
  }

  /**
   * Initialize email validation.
   */
  /**
   * Initialize email validation for a specific form.
   *
   * @param {HTMLFormElement} form - The form element that contains the email input.
   */
  function initializeEmailValidation(form) {
    // Attempt to find an input with id="email" inside this form
    const emailInput = form.querySelector("#email");
    if (!emailInput) {
      // If there's no email field, do nothing
      return;
    }

    // When the input loses focus, run the validation routine
    emailInput.addEventListener("blur", () => {
      validateEmail(emailInput);
    });

    // Observe changes to the input's class attribute to toggle the submit button
    const observer = new MutationObserver(() => {
      toggleSubmitButton(form);
    });
    observer.observe(emailInput, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  /**
   * Validate phone number via API.
   */
  function validatePhoneNumber(
    iti,
    input,
    lang = defaultLanguage,
    hideLoader = true
  ) {
    const num = iti.getNumber();
    const country = iti.getSelectedCountryData().iso2.toUpperCase();
    const loader = document.querySelector(`.${pageLoaderClass}`);
    if (!loader.offsetParent) loader.style.display = "block";
    fetch(
      `../api/getNumberType.php?phoneNumber=${encodeURIComponent(
        num
      )}&numberRegion=${country}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (hideLoader) loader.style.display = "none";
        if (data.success) {
          try {
            const parsed = libphonenumber.parsePhoneNumberFromString(num);
            php_var.phone = parsed.format("E.164");
            if (
              iti.isValidNumber() &&
              parsed.isValid() &&
              parsed.isPossible() &&
              data.numberType !== 10
            )
              setValidPhoneInput(input, lang);
            else setInvalidPhoneInput(input, "invalidPhoneNumber", lang);
          } catch {
            setInvalidPhoneInput(input, "invalidPhoneNumber", lang);
          }
        } else setInvalidPhoneInput(input, "invalidPhoneNumber", lang);
      })
      .catch((err) => {
        if (hideLoader) loader.style.display = "none";
        console.error(err);
        setInvalidPhoneInput(input, "serverError", lang);
      });
  }

  function setValidPhoneInput(input, lang) {
    input.classList.add("valid");
    input.classList.remove("invalid");
    toastr.success(getErrorMessage("validPhoneNumber", lang));
  }
  function setInvalidPhoneInput(input, key, lang) {
    input.classList.remove("valid");
    input.classList.add("invalid");
    toastr.error(getErrorMessage(key, lang));
  }

  /**
   * Validate email with Mailcheck suggestions.
   */
  function validateEmail(input, lang = defaultLanguage) {
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toastr.error(getErrorMessage("invalidEmail", lang));
      input.classList.add("invalid");
      input.classList.remove("valid");
      return;
    }
    Mailcheck.run({
      email,
      suggested(s) {
        const t = toastr.error(`Did you mean ${s.full}?`);
        input.classList.add("invalid");
        input.classList.remove("valid");
        t.on("click", () => {
          input.value = s.full;
          validateEmail(input, lang);
        });
      },
      empty() {
        toastr.success(getErrorMessage("validEmail", lang));
        input.classList.add("valid");
        input.classList.remove("invalid");
      },
    });
  }

  /**
   * Update phone placeholder.
   */
  function updatePlaceholder(iti, input) {
    const country = iti.getSelectedCountryData().iso2;
    input.placeholder = intlTelInputUtils.getExampleNumber(
      country,
      true,
      intlTelInputUtils.numberFormat.INTERNATIONAL
    );
  }

  // Initial loader setup on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    createPageLoader();
    loadErrorMessages();
    configureToastr();
    document.querySelector(`.${pageLoaderClass}`).style.display = "block";
  });

  // Observe form insertion and initialize all registration forms
  const observer = new MutationObserver((mutations) => {
    const forms = document.querySelectorAll("#registrationForm");
    if (forms.length > 0) {
      forms.forEach((form) => initializeForm(form));
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
