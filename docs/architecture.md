# TÃ€I LIá»†U KIáº¾N TRÃšC Cá»T LÃ•I Báº¤T BIáº¾N & Báº¢O Vá»† CHá»NG Lá»–I Há»’I QUY
## Há»† THá»NG QUáº¢N LÃ KHÃCH HÃ€NG THAM GIA BHXH Tá»° NGUYá»†N & BHYT Há»˜ GIA ÄÃŒNH
**PhiÃªn báº£n:** `v1.0.0-baseline`  
**NgÃ y ban hÃ nh:** 2026-09-10  
**TÃ¬nh tráº¡ng:** **ÄÃ“NG BÄ‚NG MÃƒ NGUá»’N Gá»C (FROZEN ARCHITECTURE BASELINE)**  
**CÆ°Æ¡ng vá»‹ chá»‹u trÃ¡ch nhiá»‡m:** Lead System Architect & Principal Release Engineer  

---

## 1. Má»¤C ÄÃCH & TUYÃŠN NGÃ”N KIáº¾N TRÃšC (ARCHITECTURE STATEMENT)

TÃ i liá»‡u nÃ y xÃ¡c láº­p **KhuÃ´n máº«u Kiáº¿n trÃºc Báº¥t biáº¿n (Architecture Invariants)** cá»§a há»‡ thá»‘ng táº¡i thá»i Ä‘iá»ƒm Ä‘áº¡t tráº¡ng thÃ¡i á»•n Ä‘á»‹nh 100% (59/59 bÃ i kiá»ƒm thá»­ passed, biÃªn dá»‹ch TypeScript 0 lá»—i, CSDL sáº¡ch sáº½ khÃ´ng dead tuples).

> [!IMPORTANT]
> **QUY Táº®C Báº¢O Vá»† VÄ¨NH VIá»„N (CARDINAL RULE):**  
> Má»i láº­p trÃ¬nh viÃªn, ká»¹ sÆ° phÃ¡t triá»ƒn tÃ­nh nÄƒng, báº£o trÃ¬ hoáº·c AI Agent trong tÆ°Æ¡ng lai **Báº®T BUá»˜C** pháº£i káº¿ thá»«a khung sÆ°á»n kiáº¿n trÃºc Ä‘Æ°á»£c quy Ä‘á»‹nh trong tÃ i liá»‡u nÃ y.  
> **TUYá»†T Äá»I KHÃ”NG ÄÆ¯á»¢C PHÃ‰P:**
> 1. Thay Ä‘á»•i logic gá»‘c cá»§a cÃ¡c Invariants táº¡i Táº§ng LÃµi (Core Layer) mÃ  khÃ´ng cÃ³ sá»± phÃª duyá»‡t báº±ng vÄƒn báº£n cá»§a Kiáº¿n trÃºc sÆ° TrÆ°á»Ÿng.
> 2. ÄÆ°a mÃ£ nguá»“n má»›i lÃªn nhÃ¡nh `main` náº¿u lÃ m há»ng (FAIL) báº¥t ká»³ bÃ i kiá»ƒm thá»­ nÃ o trong bá»™ 59 Golden Test Cases.
> 3. Sá»­a Ä‘á»•i ná»™i dung cÃ¡c file Migration SQL cÅ© Ä‘Ã£ triá»ƒn khai vÃ o CSDL production.

---

## 2. CÃC NGUYÃŠN Táº®C Cá»T LÃ•I Báº¤T BIáº¾N (CORE INVARIANTS)

SÃ¡u trá»¥ cá»™t nghiá»‡p vá»¥ vÃ  ká»¹ thuáº­t dÆ°á»›i Ä‘Ã¢y lÃ  báº¥t kháº£ xÃ¢m pháº¡m:

### Invariant 1: Khá»›p ná»‘i Äá»‹nh danh Äa táº§ng (Unification Cluster BFS)
- **Táº­p tin:** [`src/utils/helpers.ts`](file:///d:/HTML/Gravity/QLBHTN/src/utils/helpers.ts) -> `groupRecordsByCustomer()`
- **Äáº·c táº£ nghiá»‡p vá»¥:** KhÃ¡ch hÃ ng tham gia BHXH/BHYT qua nhiá»u ká»³ thÆ°á»ng bá»‹ phÃ¢n máº£nh thÃ´ng tin (ká»³ Ä‘áº§u cÃ³ CCCD nhÆ°ng chÆ°a cÃ³ sá»‘ sá»• BHXH; ká»³ sau cÃ³ sá»‘ sá»• nhÆ°ng Ä‘á»•i sá»‘ Ä‘iá»‡n thoáº¡i; ká»³ gia háº¡n chá»‰ lÆ°u SÄT vÃ  Há» tÃªn).
- **Thuáº­t toÃ¡n cá»‘t lÃµi:** Thuáº­t toÃ¡n duyá»‡t Ä‘á»“ thá»‹ theo chiá»u rá»™ng (BFS - Breadth-First Search) gom cá»¥m cÃ¡c báº£n ghi cÃ³ chung:
  - KhÃ³a 1: `type + cccd`
  - KhÃ³a 2: `type + bhxh`
  - KhÃ³a 3: `type + phone + name_chuan_hoa`
- **Quy táº¯c báº¥t biáº¿n:**
  - Äá»™ phá»©c táº¡p thá»i gian pháº£i duy trÃ¬ $O(N)$ báº±ng Map lookup, khÃ´ng dÃ¹ng vÃ²ng láº·p lá»“ng nhau $O(N^2)$.
  - Pháº£i loáº¡i trá»« báº£n ghi `paymentStatus === 'ÄÃ£ há»§y'` vÃ  `isAdjustment === true` khá»i danh sÃ¡ch Ä‘áº¡i diá»‡n khÃ¡ch hÃ ng.
  - LuÃ´n chá»n báº£n ghi cÃ³ `nextPayment` má»›i nháº¥t lÃ m Ä‘áº¡i diá»‡n cho khÃ¡ch hÃ ng.

### Invariant 2: PhÃ²ng thá»§ KhÃ³a ká»³ TÃ i chÃ­nh 2 Lá»›p (Financial Lock Guard)
- **Táº­p tin Client:** [`src/utils/helpers.ts`](file:///d:/HTML/Gravity/QLBHTN/src/utils/helpers.ts) -> `isDateLocked()`, `checkFinancialLockViolation()`
- **Táº­p tin Database:** PostgreSQL Trigger `trg_protect_financial_lock` trong [`20260910_financial_lock_and_snapshot.sql`](file:///d:/HTML/Gravity/QLBHTN/supabase/migrations/20260910_financial_lock_and_snapshot.sql)
- **Quy táº¯c báº¥t biáº¿n:**
  - **Lá»›p 1 (UI/Context):** Giao diá»‡n vÃ´ hiá»‡u hÃ³a cÃ¡c nÃºt Sá»­a/XÃ³a sá»‘ tiá»n, chuyá»ƒn sang cháº¿ Ä‘á»™ xem náº¿u ngÃ y phÃ¡t sinh giao dá»‹ch náº±m trong ká»³ tÃ i chÃ­nh Ä‘Ã£ bá»‹ khÃ³a sá»• (`policies` cÃ³ `is_active = true` hoáº·c `notes LIKE '%LOCKED%'`).
  - **Lá»›p 2 (Database Trigger):** Cháº·n Ä‘á»©ng má»i lá»‡nh `UPDATE/DELETE` sá»­a Ä‘á»•i cÃ¡c trÆ°á»ng tÃ i chÃ­nh (`amount`, `commission`, `date`, `income`, `wage`) á»Ÿ cáº¥p CSDL, nÃ©m lá»—i ngoáº¡i lá»‡ mÃ£ `P0001`. Ká»ƒ cáº£ khi káº» táº¥n cÃ´ng gá»i trá»±c tiáº¿p qua PostgREST API hoáº·c Service Key thÃ¬ CSDL váº«n báº£o vá»‡ sá»‘ liá»‡u.

### Invariant 3: Káº¿ toÃ¡n BÃºt toÃ¡n BÃ¹ trá»« Ã‚m (Clawback / Negative Adjustment)
- **Táº­p tin:** [`src/context/AppContext.tsx`](file:///d:/HTML/Gravity/QLBHTN/src/context/AppContext.tsx) -> `cancelRecordWithClawback()`
- **Äáº·c táº£ nghiá»‡p vá»¥:** Khi cáº§n há»§y hoáº·c Ä‘iá»u chá»‰nh má»™t biÃªn lai thu tiá»n thuá»™c vá» ká»³ tÃ i chÃ­nh Ä‘Ã£ khÃ³a sá»•:
  - **TUYá»†T Äá»I KHÃ”NG** sá»­a Ä‘á»•i hoáº·c xÃ³a báº£n ghi gá»‘c á»Ÿ ká»³ Ä‘Ã£ khÃ³a (báº£o toÃ n nguyÃªn váº¹n sá»‘ liá»‡u bÃ¡o cÃ¡o cá»§a ká»³ cÅ©).
  - Tá»± Ä‘á»™ng sinh ra **BÃºt toÃ¡n bÃ¹ trá»« Ã¢m** táº¡i ká»³ hiá»‡n táº¡i vá»›i `amount = -abs(amount)`, `commission = -abs(commission)`, `isAdjustment = true`, `originalRecordId = targetRecord.id`.
  - Doanh thu vÃ  hoa há»“ng ká»³ hiá»‡n táº¡i Ä‘Æ°á»£c cá»™ng trá»« Ä‘áº¡i sá»‘ chÃ­nh xÃ¡c; sá»‘ lÆ°á»£ng khÃ¡ch hÃ ng má»›i (`headcount`) khÃ´ng bá»‹ tÃ­nh trÃ¹ng do cÃ³ cá» `isAdjustment = true`.

### Invariant 4: ÄÃ³ng bÄƒng ChÃ­nh sÃ¡ch táº¡i Thá»i Ä‘iá»ƒm Láº­p (Point-in-Time Policy Snapshot)
- **Táº­p tin:** [`src/context/types.ts`](file:///d:/HTML/Gravity/QLBHTN/src/context/types.ts) -> cÃ¡c trÆ°á»ng `baseSalarySnapshot`, `povertyStandardSnapshot`, `policyVersionId`, `appliedRates`
- **Quy táº¯c báº¥t biáº¿n:**
  - Má»—i khi má»™t giao dá»‹ch má»›i Ä‘Æ°á»£c táº¡o, cÃ¡c thÃ´ng sá»‘ chÃ­nh sÃ¡ch táº¡i thá»i Ä‘iá»ƒm Ä‘Ã³ (LÆ°Æ¡ng cÆ¡ sá»Ÿ 2.340.000Ä‘, Chuáº©n nghÃ¨o nÃ´ng thÃ´n 1.500.000Ä‘, Tá»· lá»‡ há»— trá»£) pháº£i Ä‘Æ°á»£c Ä‘Ã³ng bÄƒng (snapshot) trá»±c tiáº¿p vÃ o dÃ²ng giao dá»‹ch.
  - Khi NhÃ  nÆ°á»›c Ä‘iá»u chá»‰nh chÃ­nh sÃ¡ch má»›i (vÃ­ dá»¥ tÄƒng lÆ°Æ¡ng cÆ¡ sá»Ÿ), sá»‘ tiá»n vÃ  hoa há»“ng cá»§a cÃ¡c giao dá»‹ch trong quÃ¡ khá»© **khÃ´ng bao giá» bá»‹ tÃ­nh toÃ¡n láº¡i theo chÃ­nh sÃ¡ch má»›i**.

### Invariant 5: TÃ­nh toÃ¡n BHYT Coterminous ThÃ¡ng Láº» theo Nghá»‹ Ä‘á»‹nh 146/2018/NÄ-CP
- **Táº­p tin:** [`src/utils/calculations.ts`](file:///d:/HTML/Gravity/QLBHTN/src/utils/calculations.ts) -> `calculateBHYTCoterminous()`
- **Quy táº¯c báº¥t biáº¿n:**
  - Há»™ gia Ä‘Ã¬nh Ä‘Æ°á»£c phÃ©p Ä‘Ã³ng sá»‘ thÃ¡ng láº» Ä‘á»™c láº­p cho tá»«ng thÃ nh viÃªn Ä‘á»ƒ Ä‘á»“ng bá»™ ká»³ háº¡n háº¿t háº¡n (Coterminous Expiration).
  - Tá»· lá»‡ giáº£m trá»« báº­c thang pháº£i Ä‘Æ°á»£c gÃ¡n theo thá»© tá»± thá»© háº¡ng thÃ nh viÃªn: NgÆ°á»i 1 (100%) -> NgÆ°á»i 2 (70%) -> NgÆ°á»i 3 (60%) -> NgÆ°á»i 4 (50%) -> NgÆ°á»i 5 trá»Ÿ Ä‘i (40%).
  - Má»©c Ä‘Ã³ng 1 thÃ¡ng cÆ¡ sá»Ÿ: $\text{LÆ°Æ¡ng cÆ¡ sá»Ÿ} \times 4.5\% = 105.300 \text{ VNÄ}$.
  - Sai sá»‘ lÃ m trÃ²n giá»¯a tá»•ng há»™ vÃ  tá»«ng thÃ nh viÃªn pháº£i Ä‘áº£m báº£o $= 0 \text{ VNÄ}$.

### Invariant 6: Báº£o vá»‡ Dá»¯ liá»‡u CÃ¡ nhÃ¢n (PII Masking) & Audit Logs Báº¥t biáº¿n (Append-Only)
- **Táº­p tin:** [`src/utils/security.ts`](file:///d:/HTML/Gravity/QLBHTN/src/utils/security.ts) & PostgreSQL Trigger `trg_auditlog_append_only`
- **Quy táº¯c báº¥t biáº¿n:**
  - **Máº·t náº¡ dá»¯ liá»‡u:** CCCD (che 6 sá»‘ giá»¯a: `001******234`), SÄT (che 4 sá»‘ giá»¯a: `091****678`), MÃ£ BHXH (che 5 sá»‘ giá»¯a) Ä‘á»‘i vá»›i táº¥t cáº£ vai trÃ² khÃ´ng pháº£i Admin theo Nghá»‹ Ä‘á»‹nh 13/2023/NÄ-CP.
  - **Audit Logs Append-Only:** Báº£ng `auditlogs` nghiÃªm cáº¥m má»i lá»‡nh `UPDATE` hoáº·c `DELETE`. Má»i hÃ nh vi xuáº¥t file Excel danh báº¡ Ä‘á»u pháº£i ghi nháº­n log kÃ¨m IP vÃ  danh tÃ­nh ngÆ°á»i thao tÃ¡c.

---

## 3. Báº¢N Äá»’ PHÃ‚N QUYá»€N & RANH GIá»šI MODULE (MODULE BOUNDARIES)

Äá»ƒ Ä‘áº£m báº£o há»‡ thá»‘ng khÃ´ng bá»‹ phÃ¡ vá»¡ khi cÃ³ nhiá»u láº­p trÃ¬nh viÃªn cÃ¹ng tham gia, mÃ£ nguá»“n Ä‘Æ°á»£c phÃ¢n Ä‘á»‹nh thÃ nh 2 phÃ¢n vÃ¹ng ranh giá»›i rÃµ rÃ ng:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        CORE LAYER (VÃ™NG Báº¤T BIáº¾N)                      â”‚
â”‚   [Cáº¤M Sá»¬A Äá»”I TRá»°C TIáº¾P Náº¾U KHÃ”NG CÃ“ PHÃŠ DUYá»†T KIáº¾N TRÃšC SÆ¯ TRÆ¯á»žNG]    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â€¢ src/utils/calculations.ts      (CÃ´ng thá»©c toÃ¡n tÃ i chÃ­nh BHXH/BHYT) â”‚
â”‚  â€¢ src/utils/helpers.ts           (BFS Unification & Financial Lock)   â”‚
â”‚  â€¢ src/utils/security.ts          (Data Masking & Security Audit)      â”‚
â”‚  â€¢ src/context/types.ts           (Cáº¥u trÃºc Schema Type trung tÃ¢m)     â”‚
â”‚  â€¢ src/context/AppContext.tsx     (Tráº¡ng thÃ¡i Ä‘á»“ng bá»™ Data Store)      â”‚
â”‚  â€¢ supabase/migrations/*.sql      (CÃ¡c migration cÆ¡ sá»Ÿ tá»« 000010->nay) â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â–²
                                    â”‚ Káº¿ thá»«a / Gá»i hÃ m
                                    â”‚ (KhÃ´ng sá»­a ngÆ°á»£c láº¡i Core)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    EXTENSION LAYER (VÃ™NG ÄÆ¯á»¢C PHÃ‰P Má»ž Rá»˜NG)            â”‚
â”‚                 [Láº¬P TRÃŒNH VIÃŠN THOáº¢I MÃI PHÃT TRIá»‚N THÃŠM]             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â€¢ src/components/admin/          (CÃ¡c View/Tabs quáº£n trá»‹ má»›i)         â”‚
â”‚  â€¢ src/components/calculators/    (CÃ¡c cÃ´ng cá»¥ tÃ­nh toÃ¡n tham kháº£o má»›i)â”‚
â”‚  â€¢ src/components/modals/         (CÃ¡c há»™p thoáº¡i nghiá»‡p vá»¥ má»›i)        â”‚
â”‚  â€¢ src/hooks/                     (Custom hooks má»Ÿ rá»™ng)               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 4. HÃ€NG RÃ€O KIá»‚M THá»¬ CHá»NG Há»’I QUY (GOLDEN TEST SUITE)

Bá»™ kiá»ƒm thá»­ phÃ²ng thá»§ gá»“m **59 Test Cases** Ä‘Æ°á»£c chia thÃ nh 6 bá»™ test tá»± Ä‘á»™ng trong thÆ° má»¥c `src/tests/` vÃ  `src/utils/`:

| Bá»™ Kiá»ƒm thá»­ | Sá»‘ Tests | Trá»ng tÃ¢m kiá»ƒm soÃ¡t |
| :--- | :---: | :--- |
| [`calculations.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/utils/calculations.test.ts) | 21 | CÃ´ng thá»©c BHXH, chiáº¿t kháº¥u Ä‘Ã³ng trÆ°á»›c, pháº¡t ná»™p muá»™n, BHYT báº­c thang |
| [`financialLock.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/tests/financialLock.test.ts) | 8 | Kiá»ƒm tra cháº·n sá»­a trÆ°á»ng tÃ i chÃ­nh á»Ÿ ká»³ khÃ³a, cho phÃ©p sá»­a ghi chÃº |
| [`clawbackCommission.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/tests/clawbackCommission.test.ts) | 5 | Äá»‘i soÃ¡t bÃºt toÃ¡n Ã¢m: doanh thu rÃ²ng, hoa há»“ng rÃ²ng, khÃ´ng tÄƒng headcount |
| [`coterminousBHYT.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/tests/coterminousBHYT.test.ts) | 7 | Há»™ 5 ngÆ°á»i [12,10,8,6,3] thÃ¡ng, trÆ°á»ng há»£p 1 thÃ¡ng láº», fallback an toÃ n |
| [`unificationCluster.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/tests/unificationCluster.test.ts) | 4 | Khá»›p ná»‘i CCCD/SÄT/MÃ£ BHXH, Benchmark 1.000 records < 50ms |
| [`securityPrivacy.test.ts`](file:///d:/HTML/Gravity/QLBHTN/src/tests/securityPrivacy.test.ts) | 14 | Máº·t náº¡ PII (CCCD, SÄT), PhÃ²ng chá»‘ng XSS injection, Append-only Audit |

### Quy táº¯c Cháº¡y Kiá»ƒm tra Báº¯t buá»™c (Verification Rule):
Má»i láº­p trÃ¬nh viÃªn trÆ°á»›c khi commit hoáº·c merge code má»›i **Báº®T BUá»˜C** pháº£i cháº¡y lá»‡nh:
```bash
npm run verify-baseline
```
Lá»‡nh nÃ y tá»± Ä‘á»™ng thá»±c hiá»‡n chuá»—i 3 bÆ°á»›c:
1. `npx tsc --noEmit` (Kiá»ƒm tra kiá»ƒu dá»¯ liá»‡u tÄ©nh TypeScript).
2. `npx vitest run` (Cháº¡y toÃ n bá»™ 59 bÃ i test há»“i quy).
3. `npm run build` (Kiá»ƒm tra kháº£ nÄƒng Ä‘Ã³ng gÃ³i bundle production).

Náº¿u **báº¥t ká»³ bÆ°á»›c nÃ o bá»‹ lá»—i**, viá»‡c cáº­p nháº­t mÃ£ nguá»“n sáº½ bá»‹ Ä‘Ã¬nh chá»‰ ngay láº­p tá»©c.

---

## 5. HÆ¯á»šNG DáºªN QUY CHUáº¨N Má»ž Rá»˜NG DÃ€NH CHO DEVELOPER TÆ¯Æ NG LAI

### 1. Khi muá»‘n ThÃªm MÃ n hÃ¬nh / PhÃ¢n há»‡ Má»›i
- Táº¡o component má»›i trong thÆ° má»¥c `src/components/admin/` (vÃ­ dá»¥ `NewModuleView.tsx`).
- Náº¡p component báº±ng `React.lazy()` trong `src/App.tsx` hoáº·c tab con trong `AdminView.tsx`.
- Láº¥y dá»¯ liá»‡u thÃ´ng qua hook `useAppContext()`:
  ```typescript
  const { records, currentUser, showToast, addAuditLog } = useAppContext();
  ```
- **KhÃ´ng Ä‘Æ°á»£c tá»± Ã½ sá»­a Ä‘á»•i hÃ m `fetchData` hay cÃ¡c State gá»‘c trong `AppContext.tsx`**.

### 2. Khi NÃ¢ng cáº¥p CÆ¡ sá»Ÿ Dá»¯ liá»‡u Supabase
- **Quy táº¯c báº¥t biáº¿n:** TUYá»†T Äá»I KHÃ”NG sá»­a Ä‘á»•i ná»™i dung cÃ¡c file SQL cÅ© trong `supabase/migrations/`.
- LuÃ´n táº¡o file migration má»›i vá»›i Ä‘á»‹nh dáº¡ng thá»i gian: `supabase/migrations/YYYYMMDD_ten_nang_cap.sql`.
- Má»i báº£ng má»›i táº¡o thÃªm **Báº®T BUá»˜C** pháº£i cÃ³:
  ```sql
  ALTER TABLE public.ten_bang_moi ENABLE ROW LEVEL SECURITY;
  ```
  vÃ  cáº¥p quyá»n rÃµ rÃ ng theo vai trÃ² `Admin`, `Quáº£n lÃ½`, `NhÃ¢n viÃªn`, nghiÃªm cáº¥m má»Ÿ quyá»n tá»± do cho `anon`.

### 3. Khi Bá»• sung Loáº¡i hÃ¬nh Báº£o hiá»ƒm hoáº·c CÃ´ng thá»©c Má»›i
- KhÃ´ng sá»­a Ä‘á»•i trá»±c tiáº¿p vÃ o thÃ¢n hÃ m `calculateBHXH` hoáº·c `calculateBHYTCoterminous`.
- Sá»­ dá»¥ng mÃ´ hÃ¬nh **Adapter Pattern**: Viáº¿t hÃ m tÃ­nh toÃ¡n má»›i riÃªng biá»‡t (vÃ­ dá»¥ `calculateBHTN`) vÃ  xuáº¥t ra tá»« file tiá»‡n Ã­ch má»Ÿ rá»™ng, sau Ä‘Ã³ tÃ­ch há»£p vÃ o modal Ä‘Äƒng kÃ½.

---

## 6. Lá»†NH ÄÃ“NG BÄ‚NG MÃƒ NGUá»’N Gá»C (GIT RELEASE TAG)

Dá»± Ã¡n Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u má»‘c lá»‹ch sá»­ phiÃªn báº£n cÆ¡ sá»Ÿ vá»¯ng cháº¯c:
```bash
git tag -a v1.0.0-baseline -m "Baseline Production Release - 100% stable, 59 tests passed, zero TypeScript errors"
```
Má»i nhÃ¡nh phÃ¡t triá»ƒn tiáº¿p theo pháº£i phÃ¢n nhÃ¡nh tá»« tag nÃ y (`git checkout -b feature/ten-tinh-nang v1.0.0-baseline`).
