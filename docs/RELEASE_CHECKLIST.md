# Publication preparation checklist

- [ ] Create empty GitHub repository `spartakos87/dt_softwarex` (do not import/fork old history).
- [ ] Push the single-root-commit Git snapshot supplied in the deliverable.
- [ ] Run Docker Compose on a clean machine; collect logs/screenshot of all 5 sensor types and the virtual building view.
- [ ] Validate `python3 scripts/smoke_demo.py` and successful frontend build.
- [ ] Inspect all large/binary artifacts and their redistribution rights; never publish original `backup.sql` or the original `initialize.zip` without authorization.
- [ ] Audit and rotate any secrets ever published in the original fork or source archives.
- [ ] Confirm proper credit to original code authors, thesis contributors and publication coauthors.
- [ ] Replace floating Python requirement ranges with exact reproducible lockfile / image digests.
- [ ] Tag a fixed release (e.g. `v0.1.0`) once functional and archive the tagged source with Zenodo or another DOI service.
- [ ] Add immutable commit SHA/DOI, tested environment, data-availability declarations and tested release date to SoftwareX manuscript.

**No benchmark performance, data provenance, full-stack end-to-end functionality or production security assurance is claimed solely from these source-code modifications.**
