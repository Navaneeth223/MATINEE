# FLEURS Search Report — Malayalam and Thai

**Date:** 2026-10-10  
**Required by:** Gate A condition 3

## Where Searched

1. **Whisper GitHub README** — https://github.com/openai/whisper/blob/main/README.md  
   - Full-text search for "Malayalam" → no results  
   - Full-text search for "Thai" → no results  
   - README contains a generic FLEURS performance chart image and aggregate WER figures; individual language breakdowns are not listed in the README.

2. **Whisper paper arXiv HTML** — https://arxiv.org/html/2212.04356v1  
   - Full-text search for "Malayalam" → no results  
   - Full-text search for "Thai" → no results  
   - The HTML version of the paper is available but Appendix D (language-by-language FLEURS breakdown) is referenced in the text but the table data is not rendered in the HTML version.

3. **Whisper paper PDF** — https://cdn.openai.com/papers/whisper.pdf  
   - PDF is not directly fetchable via automated web tools.  
   - The paper (Radford et al., 2022, arXiv:2212.04356) states Appendix D contains per-language FLEURS WER results for each model size, but these numbers could not be extracted from available sources.

## Result

**Malayalam (ISO 639-1: ml):** WER on FLEURS not found in accessible portions of the Whisper paper or README.

**Thai (ISO 639-1: th):** WER on FLEURS not found in accessible portions of the Whisper paper or README.

## Conclusion

Per-language FLEURS WER for Malayalam and Thai (with model size) could not be confirmed from publicly accessible web-fetched sources. Appendix D of the Whisper paper (Radford et al., 2022) contains this data but was not accessible for extraction.

**Recommendation for M7:** Use Whisper large-v2 or large-v3 for Thai and Malayalam and validate empirically during M7 spike S3. Accept that WER for these languages is higher than English — the Whisper paper notes overall that low-resource languages have higher error rates.

## Citation

Radford, A., Kim, J. W., Xu, T., Brockman, G., McLeavey, C., & Sutskever, I. (2022).  
*Robust Speech Recognition via Large-Scale Weak Supervision.*  
arXiv:2212.04356. https://arxiv.org/abs/2212.04356

- GitHub README accessed: 2026-10-10 via https://github.com/openai/whisper
- arXiv HTML accessed: 2026-10-10 via https://arxiv.org/html/2212.04356v1
