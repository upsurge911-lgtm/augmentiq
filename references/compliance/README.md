# Compliance Packs

The compliance packs ship in **v0.1.1** as paid add-ons:

| Pack | Basis |
|---|---|
| `gdpr.md` | GDPR (Arts. 15–22 timeline mapping, lawful-basis fields, DSR flows) |
| `soc2.md` | SOC 2 (control mapping, evidence export, retention windows) |
| `hipaa.md` | HIPAA (PHI classification, BAAs, access logging) |
| `iso27001.md` | ISO 27001 (Annex A control mapping, audit evidence) |

Until v0.1.1, the Compliance tier variables in `references/variables.md`
default to `none` and the 5 Immutable Principles apply on their own.
The pack system's variable hooks (`compliance_packs: []` in
`~/.augmentiq/config.yaml`) are ready — enabling a pack enriches every
timeline event with the pack's required fields.