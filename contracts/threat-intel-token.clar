;; CyberShield ThreatIntel Token Contract
;; Clarity v2 (Stacks 2.1+ syntax, SIP-010 compliant)
;; Implements fungible token with mint, burn, transfer, approvals, staking, batch transfers, and inflation controls

(define-trait sip-010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-name () (response (string-ascii 32) uint))
    (get-symbol () (response (string-ascii 32) uint))
    (get-decimals () (response uint uint))
    (get-balance (principal) (response uint uint))
    (get-total-supply () (response uint uint))
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INSUFFICIENT-STAKE u102)
(define-constant ERR-MAX-SUPPLY-REACHED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-ALLOWANCE-EXCEEDED u107)
(define-constant ERR-BATCH-LIMIT-EXCEEDED u108)
(define-constant ERR-INFLATION-NOT-ENABLED u109)
(define-constant ERR-ALREADY-PAUSED u110)
(define-constant ERR-NOT-PAUSED u111)

;; Token metadata
(define-constant TOKEN-NAME "CyberShield Threat Intel Token")
(define-constant TOKEN-SYMBOL "CTIT")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000) ;; 1B tokens max (with decimals separate)
(define-constant BATCH-MAX-SIZE u10) ;; Limit batch transfers to prevent gas abuse
(define-constant TOKEN-URI u"https://cybershield.example/token-metadata.json")

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)
(define-data-var inflation-enabled bool false) ;; Toggle for controlled inflation minting

;; Balances, stakes, and allowances
(define-map balances principal uint)
(define-map staked-balances principal uint)
(define-map allowances {owner: principal, spender: principal} uint)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate principal
(define-private (validate-principal (addr principal))
  (asserts! (not (is-eq addr 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
)

;; Private helper: update allowance
(define-private (update-allowance (owner principal) (spender principal) (amount uint))
  (map-set allowances {owner: owner, spender: spender} amount)
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (validate-principal new-admin)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (if pause
      (asserts! (not (var-get paused)) (err ERR-ALREADY-PAUSED))
      (asserts! (var-get paused) (err ERR-NOT-PAUSED))
    )
    (var-set paused pause)
    (ok pause)
  )
)

;; Toggle inflation enabling
(define-public (set-inflation-enabled (enabled bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set inflation-enabled enabled)
    (ok enabled)
  )
)

;; Mint new tokens (admin only, respects max supply unless inflation enabled)
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (validate-principal recipient)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((new-supply (+ (var-get total-supply) amount)))
      (if (var-get inflation-enabled)
        true ;; Allow exceeding if inflation enabled
        (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      )
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (ok true)
    )
  )
)

;; Burn tokens
(define-public (burn (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (var-set total-supply (- (var-get total-supply) amount))
      (ok true)
    )
  )
)

;; Transfer tokens (SIP-010 compliant)
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (ensure-not-paused)
    (validate-principal recipient)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-eq tx-sender sender) (err ERR-NOT-AUTHORIZED))
    (let ((sender-balance (default-to u0 (map-get? balances sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (match memo some-memo (print some-memo) true)
      (ok true)
    )
  )
)

;; Approve spender allowance
(define-public (approve (spender principal) (amount uint))
  (begin
    (ensure-not-paused)
    (validate-principal spender)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (update-allowance tx-sender spender amount)
    (ok true)
  )
)

;; Transfer from (using allowance)
(define-public (transfer-from (owner principal) (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (validate-principal recipient)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((allowance (default-to u0 (map-get? allowances {owner: owner, spender: tx-sender}))))
      (asserts! (>= allowance amount) (err ERR-ALLOWANCE-EXCEEDED))
      (let ((owner-balance (default-to u0 (map-get? balances owner))))
        (asserts! (>= owner-balance amount) (err ERR-INSUFFICIENT-BALANCE))
        (map-set balances owner (- owner-balance amount))
        (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
        (update-allowance owner tx-sender (- allowance amount))
        (ok true)
      )
    )
  )
)

;; Batch transfer (multiple recipients)
(define-public (batch-transfer (transfers (list 10 {recipient: principal, amount: uint})))
  (begin
    (ensure-not-paused)
    (asserts! (<= (len transfers) BATCH-MAX-SIZE) (err ERR-BATCH-LIMIT-EXCEEDED))
    (fold batch-transfer-iter transfers (ok true))
  )
)

(define-private (batch-transfer-iter (transfer {recipient: principal, amount: uint}) (prev (response bool uint)))
  (match prev
    success (transfer (get amount transfer) tx-sender (get recipient transfer) none)
    error prev
  )
)

;; Stake tokens for governance
(define-public (stake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set staked-balances tx-sender (+ amount (default-to u0 (map-get? staked-balances tx-sender))))
      (ok true)
    )
  )
)

;; Unstake tokens
(define-public (unstake (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((stake-balance (default-to u0 (map-get? staked-balances tx-sender))))
      (asserts! (>= stake-balance amount) (err ERR-INSUFFICIENT-STAKE))
      (map-set staked-balances tx-sender (- stake-balance amount))
      (map-set balances tx-sender (+ amount (default-to u0 (map-get? balances tx-sender))))
      (ok true)
    )
  )
)

;; Read-only: get name (SIP-010)
(define-read-only (get-name)
  (ok TOKEN-NAME)
)

;; Read-only: get symbol (SIP-010)
(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

;; Read-only: get decimals (SIP-010)
(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

;; Read-only: get balance (SIP-010)
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

;; Read-only: get total supply (SIP-010)
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: get token URI (SIP-010 optional)
(define-read-only (get-token-uri)
  (ok (some TOKEN-URI))
)

;; Read-only: get staked balance
(define-read-only (get-staked (account principal))
  (ok (default-to u0 (map-get? staked-balances account)))
)

;; Read-only: get allowance
(define-read-only (get-allowance (owner principal) (spender principal))
  (ok (default-to u0 (map-get? allowances {owner: owner, spender: spender})))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: check if inflation enabled
(define-read-only (is-inflation-enabled)
  (ok (var-get inflation-enabled))
)