# QA Agent Test Report

**Target:** https://prod-turningwell.dreamstechnologies.com/

**Runner version:** startMode-dependency-credentials-v3

**Run at:** 2026-08-28T03:46:43.691Z

**Scenarios:** 5

**Summary:** 4 passed, 1 failed, 0 blocked

---

## ✅ Navigate to and open the client registration page

**Scenario ID:** CLIENT-REG-001-POSITIVE-01

**Requirement:** CLIENT-REG-001

**Test type:** navigation

**Priority:** high

**Sequence:** 1

**Start mode:** base_url

**Depends on:** None

**Expected start state:** Healing Sky homepage is loaded.

**Expected end state:** Client registration page is displayed.

**Criteria:** Clicking Join Healing Sky and selecting Join as a Client successfully loads the client registration page.

**Status:** PASS

**Severity:** high

**Summary:** Successfully navigated to the client registration page by following the required interaction path.

**Expected:** Client registration page is displayed upon following sequence: Click Join Healing Sky → Select Join as a Client.

**Actual:** Client registration page loaded with proper elements such as full name, email, phone input boxes.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/register

**Steps taken (8):**

- prepare_start({"startMode":"base_url","target":"https://prod-turningwell.dreamstechnologies.com/"})
- get_page_state({})
- click({"agent_id":"e3"})
- click({"agent_id":"e13"})
- get_page_state({})
- click({"agent_id":"e10"})
- get_page_state({})
- finish_test({"status":"pass","summary":"Successfully navigated to the client registration page by following the required interaction path.","expected":"Client registration page is displayed upon following sequence: Click Join Healing Sky → Select Join as a Client.","actual":"Client registration page loaded with proper elements such as full name, email, phone input boxes.","severity":"high"})

---

## ❌ Fill out and submit the client registration form

**Scenario ID:** CLIENT-REG-002-POSITIVE-01

**Requirement:** CLIENT-REG-002

**Test type:** positive

**Priority:** high

**Sequence:** 2

**Start mode:** continue

**Depends on:** CLIENT-REG-001-POSITIVE-01

**Expected start state:** Client registration page is displayed.

**Expected end state:** Registration confirmation is shown or user is redirected to a success page.

**Criteria:** Submitting the client registration form with valid details displays a success or confirmation message.

**Status:** FAIL

**Severity:** high

**Summary:** The registration submission returned validation errors instead of a success message or confirmation page.

**Expected:** Valid form submission should display a success or confirmation message.

**Actual:** Validation errors were highlighted for required or invalid inputs.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/register

**Console errors observed:**

- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`
- `Cannot read properties of undefined (reading 'hideOverlaysOnDocumentScrolling')`

**Screenshot:** screenshots\client_reg_002_positive_01.png

**Steps taken (12):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- type_text({"agent_id":"e4","text":"[REDACTED]"})
- type_text({"agent_id":"e5","credential_key":"clientEmail"})
- type_text({"agent_id":"e6","text":"[REDACTED]"})
- click({"agent_id":"e10"})
- click({"agent_id":"e12"})
- click({"agent_id":"e14"})
- type_text({"agent_id":"e18","text":"[REDACTED]"})
- click({"agent_id":"e20"})
- get_page_state({})
- finish_test({"status":"fail","summary":"The registration submission returned validation errors instead of a success message or confirmation page.","expected":"Valid form submission should display a success or confirmation message.","actual":"Validation errors were highlighted for required or invalid inputs.","severity":"high"})

---

## ✅ Navigate to client sign-in page and initiate login with Email OTP

**Scenario ID:** CLIENT-AUTH-001-POSITIVE-01

**Requirement:** CLIENT-AUTH-001

**Test type:** positive

**Priority:** high

**Sequence:** 3

**Start mode:** base_url

**Depends on:** None

**Expected start state:** Healing Sky homepage is loaded.

**Expected end state:** Client OTP verification screen is displayed.

**Criteria:** Using the configured client email and selecting Email as OTP delivery method displays the OTP verification screen.

**Status:** PASS

**Severity:** high

**Summary:** Client OTP verification screen is displayed after initiating login with Email OTP.

**Expected:** Client OTP verification screen is displayed.

**Actual:** Client OTP verification screen is displayed with 4 OTP fields visible.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/verify-account

**Console errors observed:**

- `Failed to load resource: the server responded with a status of 404 ()`
- `Failed to load resource: the server responded with a status of 404 ()`

**Steps taken (11):**

- prepare_start({"startMode":"base_url","target":"https://prod-turningwell.dreamstechnologies.com/"})
- get_page_state({})
- click({"agent_id":"e8"})
- get_page_state({})
- click({"agent_id":"e9"})
- get_page_state({})
- type_text({"agent_id":"e4","credential_key":"clientEmail"})
- click({"agent_id":"e5"})
- click({"agent_id":"e9"})
- get_page_state({})
- finish_test({"status":"pass","summary":"Client OTP verification screen is displayed after initiating login with Email OTP.","expected":"Client OTP verification screen is displayed.","actual":"Client OTP verification screen is displayed with 4 OTP fields visible.","severity":"high"})

---

## ✅ Enter OTP and access the authenticated client dashboard

**Scenario ID:** CLIENT-AUTH-002-POSITIVE-01

**Requirement:** CLIENT-AUTH-002

**Test type:** positive

**Priority:** critical

**Sequence:** 4

**Start mode:** continue

**Depends on:** CLIENT-AUTH-001-POSITIVE-01

**Expected start state:** Client OTP verification screen is displayed.

**Expected end state:** Authenticated client dashboard is displayed (/client/dashboard).

**Criteria:** Entering the configured OTP and clicking Verify successfully navigates to the authenticated client dashboard.

**Status:** PASS

**Severity:** critical

**Summary:** The OTP was successfully entered, and the user was navigated to the authenticated client dashboard at /client/dashboard.

**Expected:** Authenticated client dashboard is displayed (/client/dashboard) after entering OTP and clicking Verify.

**Actual:** Authenticated client dashboard was displayed at /client/dashboard after successful OTP verification.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/dashboard

**Steps taken (6):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- type_otp({"agent_ids":["e2","e3","e4","e5"],"credential_key":"clientOtp"})
- click({"agent_id":"e7"})
- get_page_state({})
- finish_test({"status":"pass","summary":"The OTP was successfully entered, and the user was navigated to the authenticated client dashboard at /client/dashboard.","expected":"Authenticated client dashboard is displayed (/client/dashboard) after entering OTP and clicking Verify.","actual":"Authenticated client dashboard was displayed at /client/dashboard after successful OTP verification.","severity":"critical"})

---

## ✅ Log out from the authenticated client dashboard

**Scenario ID:** CLIENT-AUTH-003-POSITIVE-01

**Requirement:** CLIENT-AUTH-003

**Test type:** positive

**Priority:** medium

**Sequence:** 5

**Start mode:** continue

**Depends on:** CLIENT-AUTH-002-POSITIVE-01

**Expected start state:** Authenticated client dashboard is displayed (/client/dashboard).

**Expected end state:** Healing Sky homepage is displayed.

**Criteria:** Clicking Log Out from the authenticated client dashboard successfully logs out the user and navigates to the Healing Sky homepage.

**Status:** PASS

**Severity:** medium

**Summary:** Log out action successfully logged out the user and displayed the Healing Sky homepage.

**Expected:** Healing Sky homepage is displayed after log out action.

**Actual:** Healing Sky homepage was displayed after clicking Log Out option on the authenticated client dashboard.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/

**Steps taken (5):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- click({"agent_id":"e2"})
- get_page_state({})
- finish_test({"status":"pass","summary":"Log out action successfully logged out the user and displayed the Healing Sky homepage.","expected":"Healing Sky homepage is displayed after log out action.","actual":"Healing Sky homepage was displayed after clicking Log Out option on the authenticated client dashboard.","severity":"medium"})

---

