# Plan

พัฒนา Flow Wealth Studio จาก Dashboard จำลองผลตอบแทนให้เป็นระบบวางแผนความมั่งคั่งแบบครบวงจรสำหรับผู้ใช้ไทย โดยเริ่มจาก calculation engine ที่ตรวจสอบได้และ local-first ก่อน แล้วจึงเพิ่ม Wealth Map, Life Canvas, Portfolio X-Ray, Scenario Studio, Retirement, Tax, Protection, Family/Legacy, AI Copilot และการเชื่อมข้อมูลจริงตามลำดับ ทุกคำแนะนำต้องอธิบายสมมติฐาน แหล่งข้อมูล ความไม่แน่นอน และรอการอนุมัติจากผู้ใช้ โดยไม่มีการส่งคำสั่งซื้อขายเงินจริงในขอบเขตนี้

## Scope

- In: เว็บแอป responsive ภาษาไทย, บัญชีทรัพย์สิน–หนี้สิน–กระแสเงินสด, หลายเป้าหมาย, การคำนวณ DCA/เงินก้อน/ปันผล/ค่าธรรมเนียม/ภาษี/เงินเฟ้อ, Monte Carlo, Portfolio X-Ray, retirement cash-flow, debt/protection/tax/legacy planning, AI Copilot แบบ explainable, แผนทบทวนรายเดือน–ไตรมาส–ปี, import/export, แหล่งข้อมูลพร้อม timestamp และ local-first persistence; cloud sync และการแชร์ข้อมูลร่วมกันคงไว้ใน P9 หลัง core planning gates ผ่านแล้ว
- Out: การส่งคำสั่งซื้อขายจริง, การรับฝากเงิน, robo-advisor อัตโนมัติ, การรับรองผลตอบแทน, คำแนะนำภาษี/กฎหมายเฉพาะบุคคลที่ไม่มีผู้เชี่ยวชาญตรวจสอบ, การเชื่อมบัญชีธนาคารหรือโบรกเกอร์ที่ไม่มี API/สิทธิ์ใช้งานอย่างเป็นทางการ
- Assumptions: ใช้ React + TypeScript + Vite, IndexedDB สำหรับ local-first, calculation engine แยกจาก UI, Web Worker สำหรับ simulation และออกแบบ adapter ให้เปลี่ยน data provider/backend ได้; หากเลือก stack อื่นให้บันทึก ADR ก่อนเริ่ม P0

## Action items

[x] **P0 — วางรากฐานผลิตภัณฑ์และข้อกำกับ (Release 0.1)**

- `P0-T01` นำ Dashboard ต้นแบบเข้ามาเป็น visual baseline และตั้งโครง `src/app`, `src/domain`, `src/features`, `src/data`, `src/components`, `tests` โดยไม่ผูก calculation logic กับ DOM
- `P0-T02` กำหนด domain model สำหรับ Household, Person, Account, Asset, Liability, Transaction, CashFlow, Goal, Portfolio, Holding, Assumption, Scenario และ Recommendation พร้อม versioned schema
- `P0-T03` สร้าง design tokens, Noto Sans/Noto Sans Thai, SVG icon system, responsive shell, navigation, loading/empty/error states และ accessibility baseline
- `P0-T04` จัดทำ `docs/ASSUMPTIONS.md`, `docs/DATA_SOURCES.md`, `docs/PRIVACY.md`, `docs/SECURITY.md` และ decision log โดยแยก fact, user input, model estimate และ recommendation
- **Acceptance:** แอปเปิดได้ทั้ง desktop/mobile, state บันทึกและ migrate ได้, calculation modules ไม่มี dependency ต่อ UI, Lighthouse accessibility เป้าหมายอย่างน้อย 90 และไม่มีข้อมูลการเงินจริงออกจากเครื่องโดยไม่ได้รับความยินยอม
- **Gate G0:** unit test/domain schema ผ่าน, lint/typecheck/build ผ่าน และ baseline screenshot tests ผ่านก่อนเริ่มฟีเจอร์การเงิน

[x] **P1 — สร้าง Financial Calculation Engine ที่ตรวจสอบได้ (Release 0.2)**

- `P1-T01` รองรับ DCA/เงินก้อน, เงินฝากประจำ, เงินปันผลรับเงินสด/ทบกลับ, compounding convention, เงินเฟ้อ, FX, ค่าธรรมเนียม, ภาษี และ cash-flow timing
- `P1-T02` เพิ่ม goal reverse calculator เพื่อคำนวณเงินเริ่มต้น, DCA ที่ต้องใช้, วันที่คาดว่าจะถึงเป้าหมาย และ funding gap
- `P1-T03` เพิ่มผลลัพธ์ nominal/real, before/after fee, before/after tax และแสดงสูตร/สมมติฐานที่ใช้ได้จาก UI
- `P1-T04` สร้าง golden test cases เทียบ spreadsheet สำหรับ zero return, negative return, missing contributions, irregular dates, dividend cash/reinvest และ long horizon
- **Acceptance:** ผลคำนวณ deterministic ทำซ้ำได้, rounding policy ชัดเจน, ผู้ใช้แก้ทุก assumption ได้ และทุกตัวเลขสำคัญเปิดดูที่มา/สูตรได้
- **Gate G1:** golden tests ตรง tolerance ที่กำหนด, property tests ไม่พบ NaN/Infinity และ calculation coverage อย่างน้อย 90%

[x] **P2 — ทำ Wealth Map, Cash Flow และ Debt Studio (Release 0.3)**

- `P2-T01` สร้าง household balance sheet สำหรับทรัพย์สิน หนี้สิน บัญชี เงินสด ประกัน และสินทรัพย์ที่ไม่มีราคาตลาด พร้อม Net Worth history
- `P2-T02` สร้าง monthly cash-flow planner, recurring income/expense, savings rate, emergency-fund runway และ category trends
- `P2-T03` เพิ่ม Debt Studio สำหรับ amortization, debt-free date, snowball/avalanche, refinance และเปรียบเทียบโปะหนี้กับลงทุนภายใต้ความเสี่ยงต่างกัน
- `P2-T04` สร้าง Wealth Health Score แบบ explainable พร้อม driver, threshold, สิ่งที่ควรทำต่อ และห้ามใช้คะแนนที่ไม่มีสูตรเปิดเผย
- **Acceptance:** Dashboard ตอบได้ว่า net worth เท่าไร, เงินสดพอใช้กี่เดือน, หนี้ใดควรจัดการก่อน และแต่ละคำตอบเปลี่ยนตามข้อมูลผู้ใช้ทันที
- **Gate G2:** รองรับ CRUD/persistence จริง, import/export สำรองข้อมูลได้ และ reconciliation ยอดรวมผ่านทุก account type

[x] **P3 — ทำ Life Canvas และ Multi-goal Funding Engine (Release 0.4)**

- `P3-T01` สร้าง timeline แบบลากได้สำหรับซื้อบ้าน การศึกษา แต่งงาน ดูแลครอบครัว เริ่มธุรกิจ พักงาน เกษียณ และเป้าหมายกำหนดเอง
- `P3-T02` รองรับหลายเป้าหมายพร้อม priority, target date, target amount, inflation profile, funding account และข้อจำกัดขั้นต่ำ
- `P3-T03` สร้าง funding allocator เพื่อแบ่งเงินออมระหว่าง emergency fund, debt, retirement และ goals พร้อมเปรียบเทียบ trade-off
- `P3-T04` เพิ่ม Goal Success Probability, funding gap, required action และ what-if controls บน Studio View เดียวกัน
- **Acceptance:** การแก้รายได้ ค่าใช้จ่าย วันที่ หรือ priority ต้องอัปเดตทุกเป้าหมายโดยไม่ double-count เงิน และแสดงเหตุผลเมื่อเป้าหมายชนกัน
- **Gate G3:** ผ่าน test สำหรับ overlapping goals, insufficient cash flow, paused contribution, completed/cancelled goals และ household member changes

[x] **P4 — ทำ Portfolio X-Ray และ Investment Policy Studio (Release 0.5)**

- `P4-T01` เพิ่ม holdings/accounts/transactions, cost basis, realized/unrealized return, dividend income และ benchmark comparison
- `P4-T02` วิเคราะห์ asset class, geography, sector, currency, factor/theme, duration, credit quality, hedged/unhedged FX และ fund look-through เมื่อมีข้อมูล
- `P4-T03` ตรวจ holding overlap, concentration, correlation, volatility, drawdown, fee drag, income yield และ risk contribution
- `P4-T04` สร้าง Investment Policy Statement (IPS), target allocation, rebalance bands และคำแนะนำ rebalance แบบ preview-only พร้อม user approval
- `P4-T05` รองรับ CSV import mapping, duplicate detection, validation report และ manual correction โดยไม่แก้ข้อมูลต้นฉบับเงียบ ๆ
- **Acceptance:** ผู้ใช้เห็นว่าเสี่ยงกับอะไรจริงแม้ถือหลายกองทุน, เห็นค่าธรรมเนียมรวม และตรวจทุก recommendation ย้อนกลับถึง holding/source ได้
- **Gate G4:** portfolio totals reconcile กับไฟล์ตัวอย่าง, duplicate/FX/corporate-action edge cases ผ่าน และไม่มี trade execution endpoint

[x] **P5 — ทำ Scenario Studio, Monte Carlo และ Stress Testing (Release 0.6)**

- `P5-T01` เพิ่ม base/bear/bull assumptions และ historical-style shocks สำหรับ equity, rates, inflation, FX, income loss และ healthcare cost โดยไม่อ้างว่าเป็น forecast
- `P5-T02` ทำ Monte Carlo ใน Web Worker ด้วย seeded RNG, configurable return/volatility/correlation และแสดง P10/P50/P90 กับ probability of success
- `P5-T03` จำลอง sequence-of-returns risk, contribution pause, retirement delay, home-price overrun และ market drawdown/recovery
- `P5-T04` เพิ่ม scenario comparison, sensitivity/tornado view และบอกตัวแปร 3 อันดับที่กระทบเป้าหมายมากที่สุด
- **Acceptance:** UI ไม่ค้างระหว่าง simulation, rerun ด้วย seed เดิมได้ผลเดิม, assumptions ไม่ซ่อน และสื่อสารความไม่แน่นอนแทนการแสดงเส้นผลตอบแทนเดียว
- **Gate G5:** statistical sanity tests ผ่าน, performance budget ผ่านบนเครื่องระดับกลาง และผลลัพธ์มีคำเตือนเมื่อ sample/data ไม่พอ

[ ] **P6 — ทำ Retirement, Protection, Tax และ Family/Legacy Studios (Release 0.7)**

- [x] `P6-T01` ขยาย Retirement Studio ให้จำลองก่อนและหลังเกษียณถึงอายุ 100, longevity, healthcare inflation, pension/ประกันสังคม/กองทุนสำรองเลี้ยงชีพ/ค่าเช่า/ปันผล และรายได้เป็นช่วง
- [x] `P6-T02` เพิ่ม withdrawal strategies, bucket strategy, guardrails, glide path, legacy target และอายุที่เงินอาจหมด
- [x] `P6-T03` สร้าง Protection Gap สำหรับ emergency reserve, life/health/disability coverage, dependants, debt payoff และ income replacement โดยไม่ขายผลิตภัณฑ์
- [x] `P6-T04` สร้าง Thailand Tax Studio แบบ tax-year versioned พร้อม deduction inventory, investment limits/holding-condition reminders และ official-source effective dates; ข้อมูลที่ยังไม่ยืนยันต้องถูกปิดหรือระบุว่า estimate
- [x] `P6-T05` เพิ่ม Family & Legacy checklist สำหรับ household ownership, beneficiary, will, policy/account inventory, emergency contact และ encrypted document references
- [x] **Acceptance:** แยกเงินก้อนวันเกษียณออกจาก cash-flow หลังเกษียณ, ไม่มีการนับรายได้ซ้ำ, tax result ระบุปี/แหล่งข้อมูล และข้อมูลอ่อนไหวเข้ารหัสหรือเก็บเฉพาะ local reference
- [ ] **Gate G6:** รอผู้เชี่ยวชาญการเงิน/ภาษีตรวจ fixtures, disclaimer และขอบเขตคำแนะนำ; ระหว่างนี้ Tax/Protection มี `expertReviewStatus=pending`, ปิดเป็นค่าเริ่มต้น และเปิดได้เฉพาะ estimate โดยผู้ใช้

[ ] **P7 — ทำ Data Platform และข้อมูลผลิตภัณฑ์ที่ตรวจสอบย้อนกลับได้ (Release 0.8 RC)**

- [x] `P7-T01` สร้าง provider adapters สำหรับ NAV/price, FX, dividend, benchmark, fund factsheet, fees, deposit rates และ official Thai tax/rule sources พร้อม IndexedDB cache/manual snapshot fallback; SEC/BOT keys เป็น session-only
- [x] `P7-T02` เพิ่ม security master และ identity mapping แบบ ISIN → Thai fund code/share class → ticker/exchange/share class พร้อม conflict/ambiguity rejection สำหรับ currency, distribution และ hedging
- [x] `P7-T03` เพิ่ม Data Studio และ plan schema v8 ให้แสดง source URL/provider, as-of, fetched-at, stale, licensing, confidence, validation และ checksum; การใช้ snapshot กับ holding ต้องเลือกและยืนยันโดยผู้ใช้
- [x] `P7-T04` จำกัด scheduled ingestion ไว้ที่ authorized backend, เพิ่ม retry/local rate-limit/origin allowlist/data contract checks และ freeze last-known-good เมื่อข้อมูลใหม่ invalid/quarantined
- [x] **Acceptance:** UI ไม่เรียกค่าที่ไม่มีวันที่ว่า latest, stale/missing data ไม่ถูกแทนด้วย estimate, provider failure ไม่ทำให้แผน local/offline ใช้งานไม่ได้ และการแก้ market input เอง reset provenance เป็น user input
- [ ] **Gate G7:** contract/security-master/stale/fallback tests และ browser drills ผ่านแล้ว; ยังรอ response reconciliation กับบัญชี provider จริงและ legal/licensing review ก่อนเปิด live retrieval หรือใช้คำว่า “ล่าสุด”

[x] **P8 — ทำ AI Wealth Copilot และ Wealth Review Ritual (Release 0.9 RC)**

- [x] `P8-T01` สร้าง read-only planning context ที่ส่งเฉพาะข้อมูลที่ผู้ใช้ยินยอม พร้อม redaction, prompt-injection boundary และ audit log
- [x] `P8-T02` ให้ Copilot สรุปสถานะ, อธิบาย score/projection, เปรียบเทียบทางเลือก และสร้าง next-best-actions โดยอ้างอิง calculation output ไม่คำนวณตัวเลขสำคัญเอง
- [x] `P8-T03` บังคับ recommendation contract: rationale, trade-offs, assumptions, confidence, source/as-of, impact, reversibility และปุ่ม approve/dismiss; approval เป็นเพียงการเพิ่ม local action ไม่ใช่ซื้อขายหรือแก้พอร์ตอัตโนมัติ
- [x] `P8-T04` เพิ่ม Monthly Money Review, Quarterly Portfolio Review, Annual Life Review, decision journal, milestone celebration และ action checklist
- [x] `P8-T05` สร้าง evaluation set สำหรับ hallucination, stale data, unsuitable recommendation, conflicting goals, prompt injection, secret/PII และ attempts to trigger transactions
- [x] `P8-T06` เพิ่ม optional LM Studio/OpenRouter adapters แบบ OpenAI-compatible โดย local rules ยังเป็นค่าเริ่มต้น, credential อยู่เฉพาะ memory ของ tab, ผู้ใช้ต้องตรวจ context และยืนยันก่อนส่ง, OpenRouter บังคับ ZDR, response ถูก validate แบบทน optional metadata, LM Studio แยกคำเตือน localhost/ngrok/mixed-content, ไม่มี tools/automatic retry และ audit ไม่เก็บ prompt/response/credential
- [x] **Acceptance:** Copilot ใช้ deterministic local engine เป็นค่าเริ่มต้นและตอบจาก calculation output กับ consented aggregate เท่านั้น; optional LLM connector ต้องปฏิเสธเมื่อหลักฐานไม่พอ, แสดง context ก่อนส่ง, ไม่ persist secret, ไม่มี execution tool และปิด Copilot แล้วทุก calculation/plan ยังใช้งานได้ครบ
- [x] **Gate G8:** 128 automated tests รวม red-team/evaluation ผ่าน, context ไม่มีชื่อ/โน้ต/ข้อมูลบัญชีหรือเอกสาร, audit log ไม่เก็บข้อความคำถาม และ recommendation ทุกชิ้นต้อง approve/dismiss โดยผู้ใช้

[ ] **P9 — ทำ Accounts, Sync, Collaboration และ Production Release (Release 1.0)**

- [x] `P9-T00` วาง local-first production foundation: Plan Vault, version history สูงสุด 50 จุด, safety snapshot ก่อน restore/import, staged restore, backup เข้ารหัส AES-GCM, CSV/PDF local reports, local delete flow, privacy-safe diagnostics, remote feature flags และ route-level code splitting; ยังไม่เปิด account/sync/sharing
- [x] `P9-T01a` กำหนด executable security contract สำหรับ optional account/recovery, owner/household/advisor authorization แบบ deny-by-default, client-owned key rotation/recovery และ offline sync reconciliation ที่ห้าม silent last-write-wins พร้อม adversarial tests; ทุก remote flag ยังปิดและ sharing ยังเลื่อนไว้ใน P9
- [x] `P9-T01b` เพิ่ม executable privacy-lifecycle contract สำหรับ versioned consent, revoke, owner-authorized encrypted export/delete และ manifest ที่ต้องมี purge evidence ครบ primary/history/queue/backup/key/share/cache/metrics ก่อน verified; เพิ่ม compile-time `externalAnalytics=false` โดยยังไม่มี remote persistence
- [x] `P9-T01c` เพิ่ม client-side encrypted sync envelope แบบ non-extractable AES-GCM ที่ผูก plan/household/device/key/revision/section/expiry ด้วย authenticated metadata และ offline queue reducer ที่บังคับ authorization+consent, idempotency, device revoke, replay protection, bounded retry และ explicit merge; เป็น implementation preflight ที่ไม่มี transport/key persistence และ `cloudSync=false` ยังบล็อกทุก request จริง
- [x] `P9-T02a` เพิ่ม local conflict resolution สำหรับ restore/import โดยเปรียบเทียบ 11 หมวด, ให้ผู้ใช้เลือก source ทุกหมวด และบล็อก orphan account/member/holding/transaction references; ส่วน expiring remote share snapshot ยังไม่เปิด
- [x] `P9-T03a` เพิ่ม local-only observability, privacy-safe render diagnostics, compile-time remote capability flags, migration/rollback notes และ incident runbook โดยไม่มี remote collector
- [x] `P9-T04a` เพิ่ม disposable IndexedDB integration drill, 26-route desktop/mobile browser matrix, Lighthouse production audit, dependency/secret/static-endpoint scans และ full regression gate
- [x] `P9-T04b` เพิ่ม critical-journey E2E ที่ทำซ้ำได้จาก repository ใน disposable browser profile ทั้ง 1440×1000 และ 390×844: เปลี่ยนแผน/scenario → ปิด review → snapshot → encrypted export → local delete/reset → staged conflict restore → ยืนยันผล/รีวิวที่กู้คืน พร้อม localhost-only network, zero console/runtime issue และ accessibility tree/keyboard-focus audit ครบ 13 routes; Chrome, Edge และ WebKit engine ผ่านแล้ว ส่วน Safari browser และ manual screen-reader review ยังรอ cross-browser gate โดย Firefox เป็น best-effort และไม่ขวาง release ตาม product priority
- [x] `P9-T04c` เพิ่ม adversarial import hardening: จำกัดไฟล์ JSON/market snapshot 10 MB ก่อนอ่าน, CSV 2 MB/20,000 rows/64 columns/10,000 ตัวอักษรต่อ cell, จำกัด ID/snapshot/transaction, ปฏิเสธ NaN/Infinity/วันที่ไม่มีจริง/quote ไม่ครบ และทดสอบ fail-closed ใน Chrome/Edge desktop/mobile
- [x] `P9-T04d` เพิ่ม Playwright 1.62.1 cross-browser journey สำหรับ Firefox/WebKit แบบ isolated context และผูกกับ GitHub CI; WebKit 26.5 desktop/mobile ผ่านในเครื่องพร้อม animation/reduced-motion assertions ส่วน Firefox คงอยู่ใน CI เป็น best-effort และไม่ใช่ release blocker
- [x] `P9-T04e` เพิ่ม `axe-core` 4.12.1 WCAG 2.0/2.1/2.2 A/AA audit แบบ privacy-safe ครบ 13 routes พร้อม state เพิ่มเติมของ Protection/Tax × desktop/mobile × Chrome/WebKit รวม 60 scans, แก้ ARIA/label/contrast/scroll-region defects, แยก texture ออกจากพื้นหลังเชิงความหมาย และย้าย SVG axis labels เป็น HTML ที่ตรวจได้; ผลล่าสุดเป็นศูนย์ทั้ง violations และ `incomplete` พร้อมผูก CI โดยยังไม่แทน manual keyboard/screen-reader review
- [x] `P9-T04f` เพิ่ม semantic state ให้ navigation และ segmented controls พร้อมจัดทำ manual accessibility protocol ครบ keyboard, screen reader, zoom/reflow, contrast และ privacy-safe evidence; การรันทดสอบกับผู้ตรวจ/อุปกรณ์จริงยังคงเป็น Gate G9 ที่เปิดอยู่
- [x] `P9-T04g` เพิ่ม micro-interactions สำหรับปุ่มและการเปลี่ยนหน้า: press feedback, progress/loading pill 420 ms, route fade/slide และ lazy-route spinner โดยไม่หน่วงการทำงานจริง พร้อมปิด animation เมื่อผู้ใช้ตั้ง `prefers-reduced-motion`; Chrome/Edge/WebKit desktop/mobile ผ่าน critical journey
- [x] `P9-T04h` เพิ่ม responsive accessibility preflight ใน Chrome/WebKit ครบ 13 routes × 4 profiles × 2 engines รวม 104 checks: 320px reflow (เทียบเท่า 400% จาก 1280px), 640px reflow (เทียบเท่า 200%), mobile landscape และ forced-colors + reduced-motion; แก้ touch targets ต่ำกว่า 24px, Portfolio landscape overflow และ high-contrast focus indicator แล้ว พร้อมผูก CI โดยยังไม่แทน Safari/assistive-technology จริง
- [x] `P9-T04i` เพิ่ม external-review evidence generator แบบ fail-closed: สร้าง G6 synthetic fixtures, G7 reconciliation template, G9 aggregate browser evidence, source hashes และ sign-off form โดยไม่รวมข้อมูลแผน/credential และไม่เปลี่ยนสถานะ external gate; ป้องกัน Copilot context ไม่ให้เปิดเผยตัวเลข Tax/Protection จนผู้ใช้เปิด estimate เอง
- [x] `P9-T05a` เพิ่ม usability metrics แบบ opt-in/local-only, allowlist เฉพาะ route/action/time/random ID, retention 30 วัน และ revoke แล้วลบทันที; ยังไม่มี external analytics หรือ beta rollout
- [x] `P9-T05b` เพิ่ม evidence-gated rollout policy `off → internal → closedBeta → canary → production`, บังคับ G6/G7/security/privacy/browser/manual-a11y/incident/beta/product approval ตาม stage, ห้ามข้ามขั้นหรือเปิด transaction flags และสร้าง immutable SEV-1/2 kill-switch plan ที่ปิด remote 10 ตัวแต่คง local planner; ยังไม่มี hosted rollout
- `P9-T01` คง guest/local-only mode แล้วเพิ่ม optional account, encrypted cloud sync, household roles, advisor read-only sharing, consent/revoke/export/delete flows
- `P9-T02` เพิ่ม version history, conflict resolution, backup/restore, PDF/CSV/JSON reports และ share snapshot ที่หมดอายุได้โดยไม่ฝังข้อมูลลับใน URL
- `P9-T03` ทำ observability แบบไม่เก็บค่าการเงินจริงโดยไม่จำเป็น, error reporting, feature flags, migration/rollback และ incident runbooks
- `P9-T04` ทำ unit/integration/E2E/accessibility/visual/performance/security tests ครบ critical journeys: onboarding → import → plan → scenario → review → export/delete
- `P9-T05` เปิด beta แบบ staged rollout, เก็บ usability metrics ที่ได้รับ consent, ทำ model/data disclaimers และปิด feature ที่ยังไม่ผ่าน release gate
- **Acceptance:** ผู้ใช้ทำงานสำคัญได้ทั้ง offline และ sync mode, กู้ข้อมูลได้, ลบบัญชีและข้อมูลได้จริง, responsive/accessibility ผ่าน และไม่มีการเปลี่ยนแปลงพอร์ตโดยปราศจากการยืนยัน
- **Gate G9:** threat model, privacy review, backup restore drill, load/performance budget, cross-browser E2E และ release checklist ผ่านก่อนติดป้าย Production

[ ] **P10 — บริหารการส่งมอบแบบ incremental และ Definition of Done ทุก phase**

- [x] `P10-T01` สร้าง `docs/TASK_REGISTER.md` ครบทุก task พร้อม owner/acceptance owner, dependency, estimate, test plan, demo evidence และสถานะ gate โดยแยก done/partial/deferred/external-gate ชัดเจน
- [x] `P10-T02` กำหนดและใช้วงจร build → unit test → integration test → browser verification → code/security review → user acceptance พร้อม release evidence; UAT ยังเป็นสิทธิ์ของผู้ใช้และต้องทำซ้ำทุก slice
- [x] `P10-T03` เพิ่ม schema v10 และ immutable calculation-model registry: แผนเก่าถูก pin กับรุ่นเดิม, projection dispatch ตาม version, แจ้งผลกระทบก่อน, สร้าง restore point แล้วจึง rerun หลังผู้ใช้อนุมัติ และใส่ model version ในรายงาน
- [x] `P10-T04` เพิ่ม `docs/DEFINITION_OF_DONE.md` ครบ code/test/browser/accessibility/source/migration/rollback/privacy/UAT evidence และห้ามนับ UI mock เป็น completion
- [x] `P10-T05` บังคับ gate ด้วย compile-time flags และ safe fallback; Tax/Protection/live data/account/sync/sharing/external analytics/transactions ยังคงปิดเมื่อหลักฐานภายนอกไม่ครบ
- [x] `P10-T06` เตรียม repository delivery controls: GitHub CI, dependency updates, pull-request checklist, release-boundary scan และ initial-publish handoff; local gate mirror ผ่านแล้ว แต่ hosted CI, branch protection และ commit แรกยังรอการ push/ตั้งค่าบน GitHub
- [x] `P10-T07` เพิ่ม Product Acceptance Snapshot แบบ deterministic สำหรับ 4 คำถาม Final Gate พร้อม provenance/as-of/model version, Monte Carlo seed/path, เงินฝากประจำ, risks, pending-user actions, known limitations, rollback และ print-safe packet; automated evidence ผ่าน แต่ Product Owner/G6/G7/G9 ยังต้องลงนามเอง
- [x] `P10-T08` เพิ่ม external review-response contract และ verifier แบบ fail-closed ที่ผูกคำตอบกับ bundle/manifest/evidence/source SHA-256, บังคับบทบาทแยกกัน วันที่/expiry, เงื่อนไขที่ปิดแล้ว, Product Owner คนเดียวกัน และลำดับ G6 → G7 → G9 → Final; verifier ไม่เปิด capability และไม่แทนการตรวจลายเซ็นภายนอก
- [x] `P10-T09` ทำกราฟประมาณการใน Studio View ให้สำรวจปีและเส้นข้อมูลได้ด้วย pointer/touch/keyboard พร้อม tooltip/ARIA และย้าย input ตัวเลขที่แก้ไขได้ทั้ง 94 จุดไปใช้ตัวควบคุมเดียวที่ใส่ comma ทุกสามหลักอัตโนมัติ; browser contract ผ่าน desktop/mobile และตรวจครบ 13 หน้าโดยไม่เหลือ native number input
- **Acceptance:** ทุก release มี demo ที่ใช้งานจริง, changelog, known limitations, rollback path และไม่มี task ที่ถูกนับว่าเสร็จจาก UI mockup เพียงอย่างเดียว
- **Final Gate:** Release 1.0 ต้องตอบได้ครบว่า “ตอนนี้อยู่ตรงไหน”, “จะถึงเป้าหมายหรือไม่”, “ความเสี่ยงคืออะไร” และ “เดือนนี้ควรทำอะไรต่อ” พร้อมหลักฐานและสมมติฐานที่ตรวจสอบได้

## Open questions

- จะยืนยัน stack ตามสมมติฐาน React + TypeScript + Vite + IndexedDB หรือมี framework/backend ที่ต้องใช้เป็นมาตรฐานอยู่แล้ว
- สำหรับข้อมูล NAV/ราคา/กองทุน/ธนาคาร ต้องการเริ่มด้วยไฟล์ curated + manual refresh ก่อน หรือมี provider/API ที่มีสิทธิ์ใช้งานแล้ว
- Release แรกควรเป็น local-only สำหรับเจ้าของคนเดียว หรือให้เตรียม account/cloud sync และ household sharing ตั้งแต่โครงสร้างฐานข้อมูลรุ่นแรก
