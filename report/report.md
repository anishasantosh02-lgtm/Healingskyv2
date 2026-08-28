# QA Agent Test Report

**Target:** https://prod-turningwell.dreamstechnologies.com/

**Runner version:** startMode-dependency-credentials-v3

**Run at:** 2026-08-28T09:34:24.144Z

**Scenarios:** 6

**Summary:** 4 passed, 1 failed, 1 blocked

### Dynamic test data

| Field | Value |
| --- | --- |
| fullName | Peyton Norwood |
| email | peyton.norwood.mtcr3gsz381@yopmail.com |
| phoneCountryCode | +1 |
| phoneCountryLabel | United States (+1) |
| phoneNumber | 9846206598 |
| phoneE164 | +19846206598 |
| dobMonth | June |
| dobDate | 4 |
| dobYear | 1999 |
| addressLookup | 700 Exposition Park Dr, Los Angeles, CA |
| referralCode | NAN5EM09 |

---

## ✅ Navigate to Join as a Client

**Scenario ID:** CLIENT-REG-001-POSITIVE-01

**Requirement:** CLIENT-REG-001

**Test type:** positive

**Priority:** high

**Sequence:** 1

**Start mode:** base_url

**Depends on:** None

**Expected start state:** Healing Sky homepage is open.

**Expected end state:** Client registration page is displayed.

**Criteria:** Clicking Join Healing Sky and selecting Join as a Client displays the client registration page.

**Status:** PASS

**Severity:** high

**Summary:** Successfully navigated from the homepage to the client registration page. All acceptance criteria were verified.

**Expected:** Clicking Join Healing Sky and selecting Join as a Client displays the client registration page.

**Actual:** Client registration page is displayed with fields like full name, email, and phone number.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/register

**Final state (full page):**

![CLIENT-REG-001-POSITIVE-01](screenshots/client_reg_001_positive_01.png)

**Steps taken (7):**

- prepare_start({"startMode":"base_url","target":"https://prod-turningwell.dreamstechnologies.com/"})
- get_page_state({})
- click({"agent_id":"e9"})
- get_page_state({})
- click({"agent_id":"e10"})
- get_page_state({})
- finish_test({"status":"pass","summary":"Successfully navigated from the homepage to the client registration page. All acceptance criteria were verified.","expected":"Clicking Join Healing Sky and selecting Join as a Client displays the client registration page.","actual":"Client registration page is displayed with fields like full name, email, and phone number.","severity":"high"})

**Step screenshots (2):**

![client_reg_001_positive_01_step01_click](screenshots/client_reg_001_positive_01_step01_click.png)

![client_reg_001_positive_01_step02_click](screenshots/client_reg_001_positive_01_step02_click.png)


---

## ✅ Fill in client registration form

**Scenario ID:** CLIENT-REG-002-POSITIVE-01

**Requirement:** CLIENT-REG-002

**Test type:** positive

**Priority:** critical

**Sequence:** 2

**Start mode:** continue

**Depends on:** CLIENT-REG-001-POSITIVE-01

**Expected start state:** Client registration page is displayed.

**Expected end state:** All fields in the registration form are populated with the expected values.

**Criteria:** All six fields in the client registration form are filled in sequence as described, with every field holding its value rather than placeholder text.

**Status:** PASS

**Severity:** critical

**Summary:** All fields in the form were successfully populated with the expected test data, meeting the acceptance criteria.

**Expected:** All six fields in the client registration form are filled in sequence as described, with values <Peyton Norwood>, <peyton.norwood.mtcr3gsz381@yopmail.com>, <+19846206598>, <June>, <4>, <1999>, <700 Exposition Park Dr, Los Angeles, CA>, <NAN5EM09>.

**Actual:** All fields now display the values: <Peyton Norwood>, <peyton.norwood.mtcr3gsz381@yopmail.com>, <+19846206598>, <June>, <4>, <1999>, <700 Exposition Park Dr, Los Angeles, CA>, <NAN5EM09>. Values aligned exactly as expected.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/register

**Final state (full page):**

![CLIENT-REG-002-POSITIVE-01](screenshots/client_reg_002_positive_01.png)

**Steps taken (15):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e4","text":"[REDACTED]"},{"agent_id":"e5","text":"[REDACTED]"},{"agent_id":"e6","text":"[REDACTED]"},{"agent_id":"e19","text":"[REDACTED]"}]})
- select_options({"selections":[{"trigger_agent_id":"e9","option_text":"June"},{"trigger_agent_id":"e12","option_text":"4"},{"trigger_agent_id":"e15","option_text":"1999"}]})
- get_page_state({})
- click({"agent_id":"e10"})
- click({"agent_id":"e13"})
- click({"agent_id":"e16"})
- get_page_state({})
- select_options({"selections":[{"trigger_agent_id":"e10","option_text":"June"},{"trigger_agent_id":"e13","option_text":"4"},{"trigger_agent_id":"e16","option_text":"1999"}]})
- fill_form({"fields":[{"agent_id":"e18","text":"[REDACTED]"}]})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e18","text":"[REDACTED]"}]})
- get_page_state({})
- finish_test({"status":"pass","summary":"All fields in the form were successfully populated with the expected test data, meeting the acceptance criteria.","expected":"All six fields in the client registration form are filled in sequence as described, with values <Peyton Norwood>, <peyton.norwood.mtcr3gsz381@yopmail.com>, <+19846206598>, <June>, <4>, <1999>, <700 Exposition Park Dr, Los Angeles, CA>, <NAN5EM09>.","actual":"All fields now display the values: <Peyton Norwood>, <peyton.norwood.mtcr3gsz381@yopmail.com>, <+19846206598>, <June>, <4>, <1999>, <700 Exposition Park Dr, Los Angeles, CA>, <NAN5EM09>. Values aligned exactly as expected.","severity":"critical"})

**Step screenshots (8):**

![client_reg_002_positive_01_step01_fill_form](screenshots/client_reg_002_positive_01_step01_fill_form.png)

![client_reg_002_positive_01_step02_select_options](screenshots/client_reg_002_positive_01_step02_select_options.png)

![client_reg_002_positive_01_step03_click](screenshots/client_reg_002_positive_01_step03_click.png)

![client_reg_002_positive_01_step04_click](screenshots/client_reg_002_positive_01_step04_click.png)

![client_reg_002_positive_01_step05_click](screenshots/client_reg_002_positive_01_step05_click.png)

![client_reg_002_positive_01_step06_select_options](screenshots/client_reg_002_positive_01_step06_select_options.png)

![client_reg_002_positive_01_step07_fill_form](screenshots/client_reg_002_positive_01_step07_fill_form.png)

![client_reg_002_positive_01_step08_fill_form](screenshots/client_reg_002_positive_01_step08_fill_form.png)


---

## ✅ Validate and submit the registration form

**Scenario ID:** CLIENT-REG-003-POSITIVE-01

**Requirement:** CLIENT-REG-003

**Test type:** positive

**Priority:** critical

**Sequence:** 3

**Start mode:** continue

**Depends on:** CLIENT-REG-002-POSITIVE-01

**Expected start state:** All fields in the registration form are populated with the expected values.

**Expected end state:** Registration succeeds with confirmation message or navigation to the client login page.

**Criteria:** Submitting the client registration form succeeds if 'Registration completed successfully' is displayed or the application navigates to the client login page (/client/login).

**Status:** PASS

**Severity:** critical

**Summary:** Registration form was successfully submitted, and the page navigated to the login page.

**Expected:** Registration succeeds with confirmation message or navigation to the client login page (/client/login).

**Actual:** The page navigated to the client login page (/client/login) after submission.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/login

**Console errors observed:**

- `Failed to load resource: the server responded with a status of 404 ()`

**Final state (full page):**

![CLIENT-REG-003-POSITIVE-01](screenshots/client_reg_003_positive_01.png)

**Steps taken (6):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- click({"agent_id":"e20"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"pass","summary":"Registration form was successfully submitted, and the page navigated to the login page.","expected":"Registration succeeds with confirmation message or navigation to the client login page (/client/login).","actual":"The page navigated to the client login page (/client/login) after submission.","severity":"critical"})

**Step screenshots (2):**

![client_reg_003_positive_01_step01_click](screenshots/client_reg_003_positive_01_step01_click.png)

![client_reg_003_positive_01_step02_wait](screenshots/client_reg_003_positive_01_step02_wait.png)


---

## ✅ Navigate to client sign-in and login with email

**Scenario ID:** CLIENT-AUTH-001-POSITIVE-01

**Requirement:** CLIENT-AUTH-001

**Test type:** positive

**Priority:** critical

**Sequence:** 4

**Start mode:** base_url

**Depends on:** None

**Expected start state:** Healing Sky homepage is open.

**Expected end state:** Client OTP verification screen is displayed.

**Criteria:** From the Healing Sky homepage, the client sign-in page is displayed, Email is selected as the OTP delivery method, and the configured clientEmail is entered successfully with a Log in action leading to the OTP verification screen.

**Status:** PASS

**Severity:** critical

**Summary:** The client successfully navigated to the OTP verification screen after selecting email as OTP delivery and entering the email.

**Expected:** Client OTP verification screen is displayed after navigation from Healing Sky homepage to sign-in, selecting email for OTP delivery, and logging in.

**Actual:** OTP verification screen was reached, displaying OTP input fields and confirming email delivery method.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/verify-account

**Console errors observed:**

- `Failed to load resource: the server responded with a status of 404 ()`
- `Failed to load resource: the server responded with a status of 404 ()`

**Final state (full page):**

![CLIENT-AUTH-001-POSITIVE-01](screenshots/client_auth_001_positive_01.png)

**Steps taken (10):**

- prepare_start({"startMode":"base_url","target":"https://prod-turningwell.dreamstechnologies.com/"})
- get_page_state({})
- click({"agent_id":"e12"})
- get_page_state({})
- click({"agent_id":"e13"})
- get_page_state({})
- fill_form({"fields":[{"agent_id":"e8","credential_key":"clientEmail"}]})
- click({"agent_id":"e13"})
- get_page_state({})
- finish_test({"status":"pass","summary":"The client successfully navigated to the OTP verification screen after selecting email as OTP delivery and entering the email.","expected":"Client OTP verification screen is displayed after navigation from Healing Sky homepage to sign-in, selecting email for OTP delivery, and logging in.","actual":"OTP verification screen was reached, displaying OTP input fields and confirming email delivery method.","severity":"critical"})

**Step screenshots (4):**

![client_auth_001_positive_01_step01_click](screenshots/client_auth_001_positive_01_step01_click.png)

![client_auth_001_positive_01_step02_click](screenshots/client_auth_001_positive_01_step02_click.png)

![client_auth_001_positive_01_step03_fill_form](screenshots/client_auth_001_positive_01_step03_fill_form.png)

![client_auth_001_positive_01_step04_click](screenshots/client_auth_001_positive_01_step04_click.png)


---

## ❌ Verify OTP and authenticate client

**Scenario ID:** CLIENT-AUTH-002-POSITIVE-01

**Requirement:** CLIENT-AUTH-002

**Test type:** positive

**Priority:** critical

**Sequence:** 5

**Start mode:** continue

**Depends on:** CLIENT-AUTH-001-POSITIVE-01

**Expected start state:** Client OTP verification screen is displayed.

**Expected end state:** Authenticated client dashboard is displayed.

**Criteria:** After entering the configured clientOtp, the application verifies the OTP and navigates to the authenticated client dashboard (/client/dashboard).

**Status:** FAIL

**Severity:** critical

**Summary:** The OTP was entered and verified successfully, but the application navigated to the '/client/favoritevideo' page instead of the expected '/client/dashboard' page for the authenticated client dashboard.

**Expected:** After entering the configured clientOtp, the application verifies the OTP and navigates to the authenticated client dashboard (/client/dashboard).

**Actual:** The application navigated to the '/client/favoritevideo' page instead of '/client/dashboard'.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/favoritevideo

**Final state (full page):**

![CLIENT-AUTH-002-POSITIVE-01](screenshots/client_auth_002_positive_01.png)

**Steps taken (7):**

- prepare_start({"startMode":"continue","target":"current_page"})
- get_page_state({})
- type_otp({"agent_ids":["e6","e7","e8","e9"],"credential_key":"clientOtp"})
- click({"agent_id":"e11"})
- wait({"milliseconds":5000})
- get_page_state({})
- finish_test({"status":"fail","summary":"The OTP was entered and verified successfully, but the application navigated to the '/client/favoritevideo' page instead of the expected '/client/dashboard' page for the authenticated client dashboard.","expected":"After entering the configured clientOtp, the application verifies the OTP and navigates to the authenticated client dashboard (/client/dashboard).","actual":"The application navigated to the '/client/favoritevideo' page instead of '/client/dashboard'.","severity":"critical"})

**Step screenshots (3):**

![client_auth_002_positive_01_step01_type_otp](screenshots/client_auth_002_positive_01_step01_type_otp.png)

![client_auth_002_positive_01_step02_click](screenshots/client_auth_002_positive_01_step02_click.png)

![client_auth_002_positive_01_step03_wait](screenshots/client_auth_002_positive_01_step03_wait.png)


---

## ⚠️ Log out from client dashboard

**Scenario ID:** CLIENT-AUTH-003-POSITIVE-01

**Requirement:** CLIENT-AUTH-003

**Test type:** positive

**Priority:** medium

**Sequence:** 6

**Start mode:** continue

**Depends on:** CLIENT-AUTH-002-POSITIVE-01

**Expected start state:** Authenticated client dashboard is displayed.

**Expected end state:** Healing Sky homepage is displayed with the Log in or Sign In option visible.

**Criteria:** The user successfully logs out from the authenticated client dashboard and is returned to the Healing Sky homepage.

**Status:** BLOCKED

**Severity:** high

**Summary:** A required workflow dependency did not pass, so this continuation scenario was not executed.

**Expected:** The user successfully logs out from the authenticated client dashboard and is returned to the Healing Sky homepage.

**Actual:** Required dependencies were not satisfied: CLIENT-AUTH-002-POSITIVE-01=fail.

**Final URL:** https://prod-turningwell.dreamstechnologies.com/client/favoritevideo

**Final state (full page):**

![CLIENT-AUTH-003-POSITIVE-01](screenshots/client_auth_003_positive_01_dependency_blocked.png)

**Steps taken (1):**

- dependency_check({"failedDependencies":[{"id":"CLIENT-AUTH-002-POSITIVE-01","status":"fail"}]})

---

