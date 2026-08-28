// testdata.js
//
// Reusable dynamic test-data generator.
//
// Produces fresh, non-colliding registration data on every run so the
// same requirements file can be replayed without "email already exists"
// style failures.
//
// Values are NOT secrets. Unlike testCredentials (clientEmail /
// clientOtp, resolved inside agent.js and redacted from logs), generated
// test data is substituted into requirement descriptions before planning
// and is safe to log and to send to the LLM.
//
// Usage:
//
//   import { generateTestData, resolveTemplates } from "./testdata.js";
//
//   const data = generateTestData();
//   const resolved = resolveTemplates(requirements, data);
//
// Placeholders use {{key}} syntax, e.g. {{fullName}}, {{email}}.
//
// ============================================================

import dotenv from "dotenv";

dotenv.config();


// ============================================================
// Random helpers
// ============================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function pick(list) {
  return list[randomInt(0, list.length - 1)];
}


function pad(value, length) {
  return String(value).padStart(length, "0");
}


// ============================================================
// Name pools
// ============================================================

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery",
  "Quinn", "Peyton", "Skyler", "Cameron", "Reese", "Harper", "Emerson",
  "Rowan", "Sawyer", "Finley", "Marley", "Blake", "Devon",
];


const LAST_NAMES = [
  "Carter", "Bennett", "Sullivan", "Hayes", "Brooks", "Reynolds",
  "Foster", "Coleman", "Griffin", "Mercer", "Palmer", "Sutton",
  "Warren", "Hoffman", "Delgado", "Whitfield", "Ashford", "Langley",
  "Norwood", "Prescott",
];


// ============================================================
// US phone data
// ============================================================
//
// Numbers must satisfy libphonenumber, which most phone inputs
// (react-intl-tel-input, react-phone-input-2, PrimeReact) use to
// validate. That rules out the 555-01XX fictional block: it is
// reserved for drama, and libphonenumber reports it as INVALID,
// so a form using such a number fails with "Enter a valid phone
// number".
//
// Instead we build a structurally valid NANP number:
//
//   NPA (area code)  - a real, assigned area code
//   NXX (exchange)   - first digit 2-9, not N11, not 555
//   XXXX (line)      - any four digits
//
// ============================================================

const US_AREA_CODES = [
  "202", "212", "213", "312", "415", "617", "646", "702",
  "718", "737", "805", "858", "917", "984",
];


// ============================================================
// US address pool
// ============================================================
//
// Real, well-known street addresses so third-party address-lookup
// autocomplete (Google Places / Smarty style) returns a suggestion.
//
// ============================================================

const US_ADDRESSES = [
  "1 Wall St, New York, NY",
  "350 5th Ave, New York, NY",
  "1600 Pennsylvania Ave NW, Washington, DC",
  "233 S Wacker Dr, Chicago, IL",
  "1 Infinite Loop, Cupertino, CA",
  "700 Exposition Park Dr, Los Angeles, CA",
  "400 Broad St, Seattle, WA",
  "1 Lincoln St, Boston, MA",
  "2800 E Observatory Rd, Los Angeles, CA",
  "500 S Buena Vista St, Burbank, CA",
];


// ============================================================
// Provider credentialing pools
// ============================================================
//
// The provider onboarding wizard asks for an NPI number, a state
// licence and a card. None of these are secrets: the NPI and licence
// numbers are structurally shaped throwaways, and the card is the
// published Stripe test card, which is what the sandbox accepts.
//
// ============================================================

const US_STATES = [
  "Alabama", "Arizona", "California", "Colorado", "Connecticut",
  "Florida", "Georgia", "Illinois", "Indiana", "Kansas", "Kentucky",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Missouri",
  "Nevada", "New Jersey", "New York", "North Carolina", "Ohio",
  "Oregon", "Pennsylvania", "Tennessee", "Texas", "Utah", "Virginia",
  "Washington", "Wisconsin",
];


const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];


// ============================================================
// Generators
// ============================================================

export function generateFullName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}


/**
 * Unique disposable email derived from the generated name.
 *
 * A timestamp plus a random suffix keeps the address unique across
 * concurrent runs on the same machine.
 */
export function generateEmail(
  fullName = generateFullName(),
  domain = process.env.TEST_EMAIL_DOMAIN || "yopmail.com"
) {
  const slug = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  const unique = `${Date.now().toString(36)}${randomInt(100, 999)}`;

  return `${slug}.${unique}@${domain}`;
}


/**
 * Random, structurally valid 10-digit US phone number.
 *
 * Returns digits only (e.g. "2124560198"); phone widgets add their own
 * country code and formatting.
 */
export function generateUsPhoneNumber() {
  const areaCode = pick(US_AREA_CODES);

  let exchange;

  do {
    exchange = `${randomInt(2, 9)}${randomInt(0, 9)}${randomInt(0, 9)}`;
  } while (
    exchange === "555" ||
    // N11 codes (211, 311, 411, 911, ...) are service codes.
    exchange.endsWith("11")
  );

  const line = pad(randomInt(0, 9999), 4);

  return `${areaCode}${exchange}${line}`;
}


export function generateUsAddress() {
  return pick(US_ADDRESSES);
}


/**
 * Date of birth. Defaults to the configured fixed value; pass
 * { random: true } for an adult DOB between 18 and 60 years old.
 */
export function generateDateOfBirth({ random = false } = {}) {
  if (!random) {
    return {
      dobMonth: process.env.TEST_DOB_MONTH || "June",
      dobDate: process.env.TEST_DOB_DATE || "4",
      dobYear: process.env.TEST_DOB_YEAR || "1999",
    };
  }

  const currentYear = new Date().getFullYear();

  return {
    dobMonth: pick(MONTHS),
    dobDate: String(randomInt(1, 28)),
    dobYear: String(randomInt(currentYear - 60, currentYear - 18)),
  };
}


/**
 * Random numeric identifier with a non-zero leading digit.
 *
 * Used for the NPI number the provider wizard asks for.
 */
export function generateNpiNumber(digits = 6) {
  let value = String(randomInt(1, 9));

  for (let index = 1; index < digits; index += 1) {
    value += String(randomInt(0, 9));
  }

  return value;
}


/**
 * Random 7-digit state licence number.
 */
export function generateLicenseNumber(digits = 7) {
  return generateNpiNumber(digits);
}


export function generateUsState() {
  return pick(US_STATES);
}


// ============================================================
// Full dataset
// ============================================================

/**
 * Builds the complete dynamic test dataset.
 *
 * Every field can be pinned via `overrides` or via environment
 * variables, so a run can be made fully reproducible when needed.
 */
export function generateTestData(overrides = {}) {
  const fullName =
    overrides.fullName ||
    process.env.TEST_FULL_NAME ||
    generateFullName();

  const email =
    overrides.email ||
    process.env.TEST_EMAIL ||
    generateEmail(fullName);

  const phoneNumber =
    overrides.phoneNumber ||
    process.env.TEST_PHONE_NUMBER ||
    generateUsPhoneNumber();

  const addressLookup =
    overrides.addressLookup ||
    process.env.TEST_ADDRESS ||
    generateUsAddress();

  const dob = generateDateOfBirth({
    random: overrides.randomDob === true,
  });


  const providerPhoneNumber =
    overrides.providerPhoneNumber ||
    process.env.TEST_PROVIDER_PHONE_NUMBER ||
    generateUsPhoneNumber();


  const licenseExpiryMonth =
    overrides.licenseExpiryMonth ||
    process.env.TEST_LICENSE_EXPIRY_MONTH ||
    "11";

  const licenseExpiryYear =
    overrides.licenseExpiryYear ||
    process.env.TEST_LICENSE_EXPIRY_YEAR ||
    "2030";

  return {
    fullName,
    email,

    phoneCountryCode:
      overrides.phoneCountryCode ||
      process.env.TEST_PHONE_COUNTRY_CODE ||
      "+1",

    phoneCountryLabel:
      overrides.phoneCountryLabel ||
      process.env.TEST_PHONE_COUNTRY_LABEL ||
      "United States (+1)",

    phoneNumber,

    // International (E.164) form of the same number.
    //
    // Phone widgets built on intl-tel-input parse whatever is typed as
    // an international number. Bare national digits are therefore read
    // as a country code -- "9847096967" becomes +98 (Iran) and the
    // field reports "Enter a valid phone number". Typing the E.164
    // form is unambiguous and always resolves to the US.

    phoneE164:
      overrides.phoneE164 ||
      `+1${phoneNumber}`,

    ...dob,
    ...(overrides.dobMonth ? { dobMonth: overrides.dobMonth } : {}),
    ...(overrides.dobDate ? { dobDate: overrides.dobDate } : {}),
    ...(overrides.dobYear ? { dobYear: overrides.dobYear } : {}),

    addressLookup,

    referralCode:
      overrides.referralCode ||
      process.env.TEST_REFERRAL_CODE ||
      "NAN5EM09",

    // ------------------------------------------------------
    // Provider onboarding
    // ------------------------------------------------------

    // A run that exercises the client AND provider journeys
    // registers twice, and an account is unique by email. Reusing
    // one address would make whichever flow ran second fail as a
    // duplicate, so the provider signs up under its own identity.
    // The phone is separated too, in case that is unique as well.

    providerEmail:
      overrides.providerEmail ||
      process.env.TEST_PROVIDER_EMAIL ||
      generateEmail(
        `provider ${fullName}`
      ),

    providerPhoneNumber:
      providerPhoneNumber,

    providerPhoneE164:
      overrides.providerPhoneE164 ||
      `+1${providerPhoneNumber}`,

    npiNumber:
      overrides.npiNumber ||
      process.env.TEST_NPI_NUMBER ||
      generateNpiNumber(10),

    licenseNumber:
      overrides.licenseNumber ||
      process.env.TEST_LICENSE_NUMBER ||
      generateLicenseNumber(7),

    licenseState:
      overrides.licenseState ||
      process.env.TEST_LICENSE_STATE ||
      generateUsState(),

    licenseExpiryMonth,
    licenseExpiryYear,

    licenseExpiry:
      overrides.licenseExpiry ||
      process.env.TEST_LICENSE_EXPIRY ||
      licenseExpiryMonth + "/" + licenseExpiryYear,

    providerCategory:
      overrides.providerCategory ||
      process.env.TEST_PROVIDER_CATEGORY ||
      "Psychiatry",

    providerClassification:
      overrides.providerClassification ||
      process.env.TEST_PROVIDER_CLASSIFICATION ||
      "Individual Provider",

    providerSubCategory:
      overrides.providerSubCategory ||
      process.env.TEST_PROVIDER_SUBCATEGORY ||
      "Psychiatrists",

    // ------------------------------------------------------
    // Payment
    // ------------------------------------------------------
    //
    // Fixed on purpose: the sandbox settles only the Stripe test card,
    // so randomising it would fail every run.

    cardNumber:
      overrides.cardNumber ||
      process.env.TEST_CARD_NUMBER ||
      "4242 4242 4242 4242",

    cardExpiry:
      overrides.cardExpiry ||
      process.env.TEST_CARD_EXPIRY ||
      "11/29",

    cardCvv:
      overrides.cardCvv ||
      process.env.TEST_CARD_CVV ||
      "442",
  };
}


// ============================================================
// Template resolution
// ============================================================

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;


/**
 * Recursively replaces {{key}} placeholders in strings, arrays and
 * plain objects. Unknown keys are left untouched so a typo is visible
 * in the report rather than silently blanked.
 */
export function resolveTemplates(value, data = {}) {
  if (typeof value === "string") {
    return value.replace(
      PLACEHOLDER_PATTERN,
      (match, key) =>
        Object.prototype.hasOwnProperty.call(data, key)
          ? String(data[key])
          : match
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplates(item, data));
  }

  if (value && typeof value === "object") {
    const output = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = resolveTemplates(item, data);
    }

    return output;
  }

  return value;
}


/**
 * Returns every placeholder key referenced by a value.
 * Useful for validating a requirements file before a run.
 */
export function findPlaceholders(value, found = new Set()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
      found.add(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) findPlaceholders(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) findPlaceholders(item, found);
  }

  return found;
}
