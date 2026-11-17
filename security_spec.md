# iFumo — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Isolation (`UserProfile`)**: A user profile at `/users/{userId}` can only be read or mutated by the matching `request.auth.uid == userId` or a verified administrator. Users cannot self-assign `role: 'admin'`.
2. **Order Ownership & Terminal State Locking (`Order`)**: Orders at `/orders/{orderId}` must have `userId == request.auth.uid` upon creation, strict key validation (`hasAll` and `hasOnly`), positive `totalAmount`, and once an order reaches terminal state (`delivered` or `cancelled`), non-admin updates are rejected.
3. **Public Reviews Integrity (`Review`)**: Reviews at `/reviews/{reviewId}` must have `rating >= 1 && rating <= 5`, `comment.size() <= 600`, `userId == request.auth.uid`, and `visibility == 'public'`.
4. **Support Chat Isolation (`SupportMessage`)**: Support messages at `/supportMessages/{messageId}` are strictly scoped to `resource.data.userId == request.auth.uid` or `isAdmin()`.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must match `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Order**: Adding `"isVipFree": true` to `/orders/ord_1` -> Rejected by `hasOnly`.
2. **Self-Assigned Admin Escalation**: Creating `/users/u1` with `"role": "admin"` -> Rejected by role constraint.
3. **Unverified Email Admin Spoof**: Calling admin route with `email == 'braian.kleber.camargo@gmail.com'` and `email_verified == false` -> Rejected by `email_verified == true`.
4. **Cross-User PII Profile Read**: Authenticated `user_B` reading `/users/user_A` -> Rejected by `isOwner(userId) || isAdmin()`.
5. **Cross-User Order Scraping (`list`)**: Authenticated `user_B` listing `/orders` without filtering `userId == request.auth.uid` -> Rejected by `resource.data.userId == request.auth.uid`.
6. **ID Poisoning Attack**: Creating `/orders/` with a 300-character or special-char ID -> Rejected by `isValidId()`.
7. **Denial-of-Wallet Oversized Comment**: Creating `/reviews/rev_1` with a 50KB `comment` -> Rejected by `comment.size() <= 600`.
8. **Out-of-Bounds Rating**: Creating `/reviews/rev_1` with `rating: 99` -> Rejected by `rating >= 1 && rating <= 5`.
9. **Terminal Order Re-opening**: Updating `/orders/ord_1` when `existing().status == 'delivered'` -> Rejected by terminal state lock.
10. **Forged Client Timestamp**: Creating `/orders/ord_1` with a past/future `createdAt != request.time` -> Rejected by temporal integrity gate.
11. **Ownership Hijack on Order Update**: Updating `userId` or `totalAmount` on an existing order -> Rejected by `affectedKeys().hasOnly(['status', 'updatedAt'])` and immutable checks.
12. **Unauthorized Support Thread Snooping**: Listing `/supportMessages` belonging to another `userId` -> Rejected by `resource.data.userId == request.auth.uid`.
