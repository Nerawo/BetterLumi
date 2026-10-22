# Synthetic regression fixtures

All examples here are fictional and must remain separate from production data.

- Adult calculator profile: height 166 cm, age 43, female formula coefficient, current mass 56 kg and target mass 54 kg. The formula intentionally yields BMR 1221.5 and light-activity baseline TDEE 1679.5625, preserving exact energy regression assertions with a different fictional profile.
- BMI boundary cases derive mass from the chosen BMI and the fictional height, rather than reproducing a real profile. Values around classification and eligibility boundaries remain independently tested.
- Weight synchronization timeline: October 2037, measurements 68.4, 68.35 and 68.3 kg, with the latest at 17:42 local time. Unit tests freeze their own clock; browser tests use isolated clocks and contexts. Timezone and DST reference dates remain calendar test cases.
- Independent-measurement example: 64.0 kg at 08:45 and 64.4 kg at 15:20; edit only the first to 63.9 kg. IDs, measurement timestamps, persistence and deletion remain independently tested.

Tests may use female and male formula coefficients, medical/exclusion flags, low intake examples, missing values and extreme boundaries to exercise safety behavior. These are fictional test inputs, not claims about any person or recommended intake.

Production calculation modules and database schemas are unchanged. All database operations in tests use fake IndexedDB or a fresh browser test context. Never run a test against a personal browser profile. Screenshots, reports and temporary test storage stay ignored.
