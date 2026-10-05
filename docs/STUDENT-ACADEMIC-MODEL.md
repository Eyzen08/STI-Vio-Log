# College and Senior High School student records

STI Vio-Log serves College and Senior High School students at **STI College Global City**. Both use the same Student role, secure account setup, guardian information, disciplinary workflow, QR attendance, and clearance rules.

## Academic information

| Academic level | Program or strand | Year or grade | Section |
| --- | --- | --- | --- |
| College | Existing approved College program | Years 1-4 for new submissions | Required |
| Senior High School | ABM or STEM | Grade 11 or 12 | Required |

- **ABM**: Accountancy, Business, and Management.
- **STEM**: Science, Technology, Engineering, and Mathematics.

College uses the existing program selector. SHS uses a Strand selector; a College program is not required. Selecting a different academic level clears incompatible form selections. All phone and guardian requirements continue to apply.

## Account creation and onboarding

The active account creation route is Discipline Office provisioning with Student Number and legal name. Students change their temporary password, verify their Google email, link the same Google account, then complete academic/contact/guardian information. Public password self-registration and new-record Google self-registration are retired; their retained services and historical review records do not imply public access. Google linking remains available for eligible existing records.

Onboarding examples:

| Academic level | Program | Strand | Year/grade | Section |
| --- | --- | --- | --- | --- |
| COLLEGE | BSIT | null | 2 | A103 |
| SENIOR_HIGH_SCHOOL | null | ABM | 11 | ABM11-A |
| SENIOR_HIGH_SCHOOL | null | STEM | 12 | STEM12-A |

The authenticated profile endpoint accepts `academic_level`, `strand`, `program`, `year_level`, and `section` together with the existing contact and guardian fields. Omitted academic level in legacy registration/onboarding requests defaults to College. New SHS submissions require a supported strand. Retained pending registration services carry the same fields through verification or staff approval.

## Staff corrections and reporting

Authorized staff edit a student's merged school record with a required reason. For example, correct an SHS record to STEM, Grade 12, section STEM12-A; do not submit a College program. Changing to College requires a supported program and year 1-4 and clears strand. Existing identity, access boundaries, and disciplinary history remain attached.

Profiles, directory search, staff review, department QR details, and applicable reports display academic level and Program/Strand with Year/Grade labels. Search includes ABM/STEM. Authorized certificate preparation can use the student's strand in its existing academic snapshot field. Previously issued PDFs and public certificate verification disclosures are unchanged. Existing fixed-format violation CSV/Excel exports retain their published column contract; academic report exports include the academic fields when their source report provides them.

## Historical records and migration

Migration `042_student_academic_level.sql` remains unchanged. Migration `043_student_academic_strands.sql` adds nullable strand and extends pending registration records. It also expands pending registration year constraints to accept historical College years 1-8 and SHS Grades 11-12. It infers only missing academic levels: Grade 11-12 becomes SHS, years 1-8 become College, and unknown years stay unspecified. It preserves explicit levels, historical programs, identities, onboarding state, and access. It never guesses a strand.

Historical SHS students may retain an unrecorded strand. Historical College years 5-8 remain readable and survive unrelated edits. An explicit academic correction must satisfy the current requirements. Retained pending registrations can be processed with their historical academic values. No student is forced through onboarding again by this migration.

## Release and acceptance

Apply migration 043 before deploying the backend. Deploy the frontend afterward. Verify with test accounts: College BSIT Year 2, ABM Grade 11, and STEM Grade 12. Test invalid strands, wrong grade/year, mode changes, required section and guardian data, staff audit reasons, legacy records, profile/QR/report labels, and certificate privacy. Run PostgreSQL tests against a dedicated test database, never production.
