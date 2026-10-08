# ASSUMPTIONS

> Recorded: 2026-10-08. Defaults applied where the owner left fields blank.
> Any assumption can be overturned at any Gate — just say so.

| ID | Assumption | Reason chosen | How to detect if wrong | Cost if wrong |
|----|-----------|--------------|------------------------|---------------|
| A01 | Owner device: Windows laptop (Chrome), Android phone (Chrome) | Prompt default; blanks left unfilled | Owner reports a bug specific to another browser | Low — we test Chrome P0 anyway |
| A02 | Partner device: iPhone Safari + laptop Chrome (unknown) | Prompt default | Partner reports incompatibility | Medium — iOS Safari has quirks; we mitigate by default |
| A03 | Partner country: unknown; assume <= 300 ms RTT, home Wi-Fi >= 10 Mbps upload | Prompt default | Sync quality poor; doctor reports high RTT | Medium — sync engine handles up to 400 ms RTT gracefully |
| A04 | Both viewers will use their own local film files (Mode A default) | Owner confirmed explicitly | Owner requests streaming mode | Low — Modes B/C are built but not default |
| A05 | Owner will create free Cloudflare + TMDB accounts and a free Gemini API key | Owner confirmed ("yes, guide me") | Owner declines a step | Low — we provide step-by-step guide and card-free fallbacks |
| A06 | App name: "Matinee"; tone: warm, quiet, cinematic | Prompt default | Owner requests a rename | Zero — rename is a 5-minute config change |
| A07 | "Fingerprint" = file hash (section 8.4). STT runs only when section 9.4 routing finds no good existing subtitles. | Owner correction 2026-10-08 | n/a — correction is definitive | n/a |
| A08 | The Cloudflare edge server routes sealed E2EE envelopes only; it never stores or decrypts movie content or chat | Owner correction 2026-10-08 | n/a — correction is definitive | n/a |
| A09 | UI language at launch: English (default), Malayalam, Thai | Spec section 15.1 | Owner requests additional language | Medium — i18n scaffold is extensible |
| A10 | Reference date for research: 2026-10-08 (today) | Prompt section 7.0 rule 4 | Any source older than 12 months for free tiers is re-verified | Low — we re-verify before relying on any fact |
