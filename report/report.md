# QA Agent Test Report

**Target:** https://prod-turningwell.dreamstechnologies.com/

**Runner version:** startMode-dependency-credentials-v3

**Run at:** 2026-08-28T12:23:44.734Z

**Scenarios:** 8

**Summary:** 8 passed, 0 failed, 0 blocked

### Dynamic test data

| Field | Value |
| --- | --- |
| fullName | Sawyer Griffin |
| email | sawyer.griffin.mtcx2ugx228@yopmail.com |
| phoneCountryCode | +1 |
| phoneCountryLabel | United States (+1) |
| phoneNumber | 9846788676 |
| phoneE164 | +19846788676 |
| dobMonth | June |
| dobDate | 4 |
| dobYear | 1976 |
| addressLookup | 233 S Wacker Dr, Chicago, IL |
| referralCode | NAN5EM09 |
| npiNumber | 5503036196 |
| licenseNumber | 8934893 |
| licenseState | California |
| licenseExpiryMonth | 11 |
| licenseExpiryYear | 2030 |
| licenseExpiry | 11/2030 |
| providerCategory | Psychiatry |
| providerClassification | Individual Provider |
| providerSubCategory | Psychiatrists |
| cardNumber | 4242 4242 4242 4242 |
| cardExpiry | 11/29 |
| cardCvv | 442 |

---

## ✅ Open Provider Registration Wizard

**Scenario ID:** PROVIDER-REG-001-POSITIVE-01

**Requirement:** PROVIDER-REG-001

**Test type:** navigation

**Priority:** high

**Sequence:** 1

**Start mode:** base_url

**Depends on:** None

**Expected start state:** Healing Sky homepage is loaded.

**Expected end state:** Provider registration wizard opens at /provider/register.

**Criteria:** The Join Healing Sky option opens the provider registration wizard at /provider/register displaying fields for Full Name, Email, Phone, Date of Birth, and Referral Code.

**Status:** PASS

**Severity:** high

**Summary:** Successfully verified the navigation to the provider registration wizard.

**Expected:** Provider registration wizard opens at /provider/register displaying fields for Full Name, Email, Phone, Date of Birth, and Referral Code.

**Actual:** The provider registration wizard successfully opened at /provider/register, displaying the required fields.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/register

**Final state (full page):**

![PROVIDER-REG-001-POSITIVE-01](screenshots/provider_reg_001_positive_01.png)

**Steps taken (9):**

- prepare_start({"startMode":"base_url","target":"https://prod-turningwell.dreamstechnologies.com/"})
- get_page_state({})
- click({"agent_id":"e9"})
- wait({"milliseconds":2000})
- get_page_state({})
- click({"agent_id":"e11"})
- wait({"milliseconds":3000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Successfully verified the navigation to the provider registration wizard.","expected":"Provider registration wizard opens at /provider/register displaying fields for Full Name, Email, Phone, Date of Birth, and Referral Code.","actual":"The provider registration wizard successfully opened at /provider/register, displaying the required fields.","severity":"high"})

**Step screenshots (4):**

![provider_reg_001_positive_01_step01_click](screenshots/provider_reg_001_positive_01_step01_click.png)

![provider_reg_001_positive_01_step02_wait](screenshots/provider_reg_001_positive_01_step02_wait.png)

![provider_reg_001_positive_01_step03_click](screenshots/provider_reg_001_positive_01_step03_click.png)

![provider_reg_001_positive_01_step04_wait](screenshots/provider_reg_001_positive_01_step04_wait.png)


---

## ✅ Fill provider personal details form (step 1)

**Scenario ID:** PROVIDER-REG-002-POSITIVE-01

**Requirement:** PROVIDER-REG-002

**Test type:** positive

**Priority:** high

**Sequence:** 2

**Start mode:** continue

**Depends on:** PROVIDER-REG-001-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/register.

**Expected end state:** Provider registration wizard advances to /provider/address.

**Criteria:** Filling all fields in provider registration step 1 correctly and clicking 'Proceed' advances the user to the address step at /provider/address.

**Status:** PASS

**Severity:** high

**Summary:** All fields were correctly filled, and the 'Proceed' button successfully advanced to /provider/address.

**Expected:** Filling all fields correctly and clicking 'Proceed' advances to /provider/address.

**Actual:** Form was filled with test data, and clicking 'Proceed' redirected to /provider/address.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/address

**Final state (full page):**

![PROVIDER-REG-002-POSITIVE-01](screenshots/provider_reg_002_positive_01.png)

**Steps taken (9):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e4","text":"[REDACTED]"},{"agent_id":"e5","text":"[REDACTED]"},{"agent_id":"e6","text":"[REDACTED]"},{"agent_id":"e17","text":"[REDACTED]"}]})
- select_options({"selections":[{"trigger_agent_id":"e10","option_text":"June"},{"trigger_agent_id":"e13","option_text":"4"},{"trigger_agent_id":"e16","option_text":"1976"}]})
- get_page_state({})
- click({"agent_id":"e18"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"All fields were correctly filled, and the 'Proceed' button successfully advanced to /provider/address.","expected":"Filling all fields correctly and clicking 'Proceed' advances to /provider/address.","actual":"Form was filled with test data, and clicking 'Proceed' redirected to /provider/address.","severity":"high"})

**Step screenshots (4):**

![provider_reg_002_positive_01_step01_fill_form](screenshots/provider_reg_002_positive_01_step01_fill_form.png)

![provider_reg_002_positive_01_step02_select_options](screenshots/provider_reg_002_positive_01_step02_select_options.png)

![provider_reg_002_positive_01_step03_click](screenshots/provider_reg_002_positive_01_step03_click.png)

![provider_reg_002_positive_01_step04_wait](screenshots/provider_reg_002_positive_01_step04_wait.png)


---

## ✅ Fill provider address details form (step 2)

**Scenario ID:** PROVIDER-REG-003-POSITIVE-01

**Requirement:** PROVIDER-REG-003

**Test type:** positive

**Priority:** high

**Sequence:** 3

**Start mode:** continue

**Depends on:** PROVIDER-REG-002-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/address.

**Expected end state:** Provider registration wizard advances to /provider/location.

**Criteria:** Filling the address field, confirming it resolves correctly with Google Places API, and clicking 'Proceed' advances the user to the location step at /provider/location.

**Status:** PASS

**Severity:** high

**Summary:** Address details were successfully filled, resolved with Google Places API, and the wizard advanced to the location step.

**Expected:** Provider registration wizard advances to /provider/location after filling and confirming the address field and clicking 'Proceed'.

**Actual:** User advanced to /provider/location after confirming the address suggestion and clicking 'Proceed'.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/location

**Final state (full page):**

![PROVIDER-REG-003-POSITIVE-01](screenshots/provider_reg_003_positive_01.png)

**Steps taken (13):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- type_text({"agent_id":"e5","text":"[REDACTED]"})
- wait({"milliseconds":2000})
- get_page_state({})
- click({"agent_id":"e5"})
- get_page_state({})
- click({"agent_id":"e17"})
- get_page_state({})
- click({"agent_id":"e8"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Address details were successfully filled, resolved with Google Places API, and the wizard advanced to the location step.","expected":"Provider registration wizard advances to /provider/location after filling and confirming the address field and clicking 'Proceed'.","actual":"User advanced to /provider/location after confirming the address suggestion and clicking 'Proceed'.","severity":"high"})

**Step screenshots (6):**

![provider_reg_003_positive_01_step01_type_text](screenshots/provider_reg_003_positive_01_step01_type_text.png)

![provider_reg_003_positive_01_step02_wait](screenshots/provider_reg_003_positive_01_step02_wait.png)

![provider_reg_003_positive_01_step03_click](screenshots/provider_reg_003_positive_01_step03_click.png)

![provider_reg_003_positive_01_step04_click](screenshots/provider_reg_003_positive_01_step04_click.png)

![provider_reg_003_positive_01_step05_click](screenshots/provider_reg_003_positive_01_step05_click.png)

![provider_reg_003_positive_01_step06_wait](screenshots/provider_reg_003_positive_01_step06_wait.png)


---

## ✅ Fill provider and listing details form (step 3)

**Scenario ID:** PROVIDER-REG-004-POSITIVE-01

**Requirement:** PROVIDER-REG-004

**Test type:** positive

**Priority:** high

**Sequence:** 4

**Start mode:** continue

**Depends on:** PROVIDER-REG-003-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/location.

**Expected end state:** Provider registration wizard advances to /provider/credential.

**Criteria:** Filling all fields in provider registration step 3 correctly and clicking 'Proceed' advances the user to the licence status step at /provider/credential.

**Status:** PASS

**Severity:** high

**Summary:** Provider registration wizard correctly advanced from the /provider/location step to the /provider/credential step.

**Expected:** Filling all fields in provider registration step 3 correctly and clicking 'Proceed' advances the user to the licence status step at /provider/credential.

**Actual:** Provider registration wizard advanced to /provider/credential after providing required details.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/credential

**Final state (full page):**

![PROVIDER-REG-004-POSITIVE-01](screenshots/provider_reg_004_positive_01.png)

**Steps taken (13):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- select_options({"selections":[{"trigger_agent_id":"e4","option_text":"Psychiatry"}]})
- get_page_state({})
- select_options({"selections":[{"trigger_agent_id":"e7","option_text":"Individual Provider"}]})
- get_page_state({})
- select_options({"selections":[{"trigger_agent_id":"e10","option_text":"Psychiatrists"}]})
- fill_form({"fields":[{"agent_id":"e13","text":"[REDACTED]"}]})
- get_page_state({})
- click({"agent_id":"e17"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Provider registration wizard correctly advanced from the /provider/location step to the /provider/credential step.","expected":"Filling all fields in provider registration step 3 correctly and clicking 'Proceed' advances the user to the licence status step at /provider/credential.","actual":"Provider registration wizard advanced to /provider/credential after providing required details.","severity":"high"})

**Step screenshots (6):**

![provider_reg_004_positive_01_step01_select_options](screenshots/provider_reg_004_positive_01_step01_select_options.png)

![provider_reg_004_positive_01_step02_select_options](screenshots/provider_reg_004_positive_01_step02_select_options.png)

![provider_reg_004_positive_01_step03_select_options](screenshots/provider_reg_004_positive_01_step03_select_options.png)

![provider_reg_004_positive_01_step04_fill_form](screenshots/provider_reg_004_positive_01_step04_fill_form.png)

![provider_reg_004_positive_01_step05_click](screenshots/provider_reg_004_positive_01_step05_click.png)

![provider_reg_004_positive_01_step06_wait](screenshots/provider_reg_004_positive_01_step06_wait.png)


---

## ✅ Fill provider licence status form (step 4)

**Scenario ID:** PROVIDER-REG-005-POSITIVE-01

**Requirement:** PROVIDER-REG-005

**Test type:** positive

**Priority:** high

**Sequence:** 5

**Start mode:** continue

**Depends on:** PROVIDER-REG-004-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/credential.

**Expected end state:** Provider registration wizard advances to /provider/credentials.

**Criteria:** Selecting 'I am licensed', verifying selection, and clicking 'Proceed' advances the user to the licence details step at /provider/credentials.

**Status:** PASS

**Severity:** high

**Summary:** The scenario successfully advanced from selecting 'I am licensed' to the 'license details' step at /provider/credentials.

**Expected:** Provider registration wizard advances to /provider/credentials after selecting 'I am licensed' and clicking 'Proceed'.

**Actual:** Provider registration wizard showed the 'license details' step at /provider/credentials after selecting 'I am licensed' and clicking 'Proceed'.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/credentials

**Final state (full page):**

![PROVIDER-REG-005-POSITIVE-01](screenshots/provider_reg_005_positive_01.png)

**Steps taken (9):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- click({"agent_id":"e4"})
- wait({"milliseconds":2000})
- get_page_state({})
- click({"agent_id":"e12"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"The scenario successfully advanced from selecting 'I am licensed' to the 'license details' step at /provider/credentials.","expected":"Provider registration wizard advances to /provider/credentials after selecting 'I am licensed' and clicking 'Proceed'.","actual":"Provider registration wizard showed the 'license details' step at /provider/credentials after selecting 'I am licensed' and clicking 'Proceed'.","severity":"high"})

**Step screenshots (4):**

![provider_reg_005_positive_01_step01_click](screenshots/provider_reg_005_positive_01_step01_click.png)

![provider_reg_005_positive_01_step02_wait](screenshots/provider_reg_005_positive_01_step02_wait.png)

![provider_reg_005_positive_01_step03_click](screenshots/provider_reg_005_positive_01_step03_click.png)

![provider_reg_005_positive_01_step04_wait](screenshots/provider_reg_005_positive_01_step04_wait.png)


---

## ✅ Fill provider licence details form (step 5)

**Scenario ID:** PROVIDER-REG-006-POSITIVE-01

**Requirement:** PROVIDER-REG-006

**Test type:** positive

**Priority:** high

**Sequence:** 6

**Start mode:** continue

**Depends on:** PROVIDER-REG-005-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/credentials.

**Expected end state:** Provider registration wizard advances to /provider/billing.

**Criteria:** Filling all fields in provider registration step 5 correctly, accepting terms and conditions, and clicking 'Proceed' advances the user to the plan page at /provider/billing.

**Status:** PASS

**Severity:** high

**Summary:** Provider registration step 5 was completed successfully. The form fields were filled accurately, terms and conditions were accepted, the 'Proceed' button was clicked, and the wizard advanced to the plan page as expected.

**Expected:** Provider registration wizard advances to /provider/billing after filling all fields properly, accepting terms, and clicking Proceed.

**Actual:** Provider registration wizard advanced to /provider/billing with all fields filled correctly and terms accepted.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/billing

**Final state (full page):**

![PROVIDER-REG-006-POSITIVE-01](screenshots/provider_reg_006_positive_01.png)

**Steps taken (10):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e7","text":"[REDACTED]"},{"agent_id":"e11","text":"[REDACTED]"}]})
- select_options({"selections":[{"trigger_agent_id":"e10","option_text":"California"}]})
- click({"agent_id":"e13"})
- get_page_state({})
- click({"agent_id":"e15"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Provider registration step 5 was completed successfully. The form fields were filled accurately, terms and conditions were accepted, the 'Proceed' button was clicked, and the wizard advanced to the plan page as expected.","expected":"Provider registration wizard advances to /provider/billing after filling all fields properly, accepting terms, and clicking Proceed.","actual":"Provider registration wizard advanced to /provider/billing with all fields filled correctly and terms accepted.","severity":"high"})

**Step screenshots (5):**

![provider_reg_006_positive_01_step01_fill_form](screenshots/provider_reg_006_positive_01_step01_fill_form.png)

![provider_reg_006_positive_01_step02_select_options](screenshots/provider_reg_006_positive_01_step02_select_options.png)

![provider_reg_006_positive_01_step03_click](screenshots/provider_reg_006_positive_01_step03_click.png)

![provider_reg_006_positive_01_step04_click](screenshots/provider_reg_006_positive_01_step04_click.png)

![provider_reg_006_positive_01_step05_wait](screenshots/provider_reg_006_positive_01_step05_wait.png)


---

## ✅ Select provider plan (step 6)

**Scenario ID:** PROVIDER-REG-007-POSITIVE-01

**Requirement:** PROVIDER-REG-007

**Test type:** positive

**Priority:** high

**Sequence:** 7

**Start mode:** continue

**Depends on:** PROVIDER-REG-006-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/billing.

**Expected end state:** Provider registration wizard advances to /provider/card.

**Criteria:** Selecting the 'Standard Account' plan and clicking 'Get Started' advances the user to the payment interface at /provider/card.

**Status:** PASS

**Severity:** high

**Summary:** Selecting the 'Standard Account' plan and clicking 'Get Started' successfully navigated to the payment interface at '/provider/card'.

**Expected:** Provider registration wizard advances to /provider/card.

**Actual:** Provider registration wizard advanced to /provider/card after selecting 'Standard Account' and clicking 'Get Started'.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/card

**Final state (full page):**

![PROVIDER-REG-007-POSITIVE-01](screenshots/provider_reg_007_positive_01.png)

**Steps taken (7):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- click({"agent_id":"e6"})
- click({"agent_id":"e9"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Selecting the 'Standard Account' plan and clicking 'Get Started' successfully navigated to the payment interface at '/provider/card'.","expected":"Provider registration wizard advances to /provider/card.","actual":"Provider registration wizard advanced to /provider/card after selecting 'Standard Account' and clicking 'Get Started'.","severity":"high"})

**Step screenshots (3):**

![provider_reg_007_positive_01_step01_click](screenshots/provider_reg_007_positive_01_step01_click.png)

![provider_reg_007_positive_01_step02_click](screenshots/provider_reg_007_positive_01_step02_click.png)

![provider_reg_007_positive_01_step03_wait](screenshots/provider_reg_007_positive_01_step03_wait.png)


---

## ✅ Submit provider payment (step 7)

**Scenario ID:** PROVIDER-REG-008-POSITIVE-01

**Requirement:** PROVIDER-REG-008

**Test type:** positive

**Priority:** critical

**Sequence:** 8

**Start mode:** continue

**Depends on:** PROVIDER-REG-007-POSITIVE-01

**Expected start state:** Provider registration wizard is open at /provider/card.

**Expected end state:** Payment is completed, and the application navigates to a confirmation or success page.

**Criteria:** Entering all payment details correctly and clicking 'Make a Payment' successfully completes the payment process and navigates the user to a confirmation or success page.

**Status:** PASS

**Severity:** critical

**Summary:** Payment completed successfully, and navigation redirected to the confirmation/success page.

**Expected:** Payment is completed, and the application navigates to a confirmation or success page.

**Actual:** Application redirected to the confirmation page 'https://prod-turningwell.dreamstechnologies.com/provider/thank-you' indicating successful payment.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/provider/thank-you

**Final state (full page):**

![PROVIDER-REG-008-POSITIVE-01](screenshots/provider_reg_008_positive_01.png)

**Steps taken (8):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e7","text":"[REDACTED]"},{"agent_id":"f5e0","text":"[REDACTED]"},{"agent_id":"f6e0","text":"[REDACTED]"},{"agent_id":"f7e0","text":"[REDACTED]"}]})
- get_page_state({})
- click({"agent_id":"e12"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Payment completed successfully, and navigation redirected to the confirmation/success page.","expected":"Payment is completed, and the application navigates to a confirmation or success page.","actual":"Application redirected to the confirmation page 'https://prod-turningwell.dreamstechnologies.com/provider/thank-you' indicating successful payment.","severity":"critical"})

**Step screenshots (3):**

![provider_reg_008_positive_01_step01_fill_form](screenshots/provider_reg_008_positive_01_step01_fill_form.png)

![provider_reg_008_positive_01_step02_click](screenshots/provider_reg_008_positive_01_step02_click.png)

![provider_reg_008_positive_01_step03_wait](screenshots/provider_reg_008_positive_01_step03_wait.png)


---

