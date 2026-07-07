# ExplainabilityReceipt

Every assembly result carries a receipt: a machine-readable statement of exactly
what context entered the reasoning act and why. The receipt is the product's trust
primitive — for an account manager it means "safe to send without triple-checking";
for a reviewer it is the audit trail; for the agency's client it is proof of
isolation from competing accounts.

## 1. Client Brain receipt (V1)

Returned by `POST /api/clients/:clientId/enhance`:

```json
{
  "clientId": "client-meridian-foods",
  "clientName": "Meridian Foods",
  "itemsUsed": [
    { "id": "know-…", "kind": "voice",    "title": "Brand voice is witty and informal",  "reason": "brand voice — always included" },
    { "id": "know-…", "kind": "rule",     "title": "Health claims are strictly forbidden", "reason": "client rule — mandatory" },
    { "id": "know-…", "kind": "fact",     "title": "Hero SKU",                            "reason": "matched request" },
    { "id": "know-…", "kind": "learning", "title": "Engagement peaks after 9 PM IST",     "reason": "frequently used" }
  ],
  "walls": "Assembled exclusively from Meridian Foods's Client Brain. No other client's knowledge was accessible to this request.",
  "assembledAt": 1783300000000,
  "constitutionVersion": "1.0"
}
```

Semantics:
- **`itemsUsed`** — the complete list; if it isn't on the receipt, it wasn't in the
  pack. Reasons are human-readable inclusion causes, not scores.
- **`walls`** — an explicit isolation assertion. This is backed by construction
  (client-bound query shapes, see [AUTHORIZATION.md](AUTHORIZATION.md)), not by
  post-hoc filtering.
- **`constitutionVersion`** — the governance version the assembly ran under,
  enabling future auditing across policy changes.

## 2. Legacy receipt (personal engine)

Returned by `POST /api/enhance` as `explainabilityReceipt[]` — per selected memory:

```json
{
  "type": "Project",
  "name": "Q1 Tech Earnings",
  "reasons": ["Matched intent", "Active state"],
  "confidence": "High",
  "weight": 187
}
```

This older shape explains *ranking* (why the engine chose an item). The Client
Brain receipt extends the idea to *authorization* (what was allowed to enter, and
what boundary held).

## 3. Design rules

1. **Approvals only.** Receipts list what entered — never what was denied. A
   user-visible denial log is itself an information leak (it reveals the existence
   of things the principal isn't allowed to see); denials belong to a separate
   audit stream.
2. **Receipts are cheap and mandatory.** They are constructed from data the
   assembly already has; no assembly path may skip them.
3. **Planned:** receipts will carry `authorizationDecisionId` + `policyVersion`
   issued by the Policy Decision Point once the template registry ships
   (see [PROJECT_STATE.md](PROJECT_STATE.md)) — making every receipt entry
   traceable to the exact policy that allowed it.
