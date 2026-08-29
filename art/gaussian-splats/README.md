# Gaussian Splat Lab

This directory defines the publication boundary for a real Gaussian-splat experiment derived from three supplied *Current Story* images.

## Current status

`SOURCE_PREPARED`

Three source PNGs have been selected, hashed, and packaged. No `.spz` scene has been generated or published. The public page must continue to report zero scenes until a scene file exists and passes the checks below.

## Generator

The intended upstream project is:

- `https://github.com/neilsonnn/image-blaster`

Before running a pilot:

1. Record the exact upstream commit.
2. Follow the upstream installation and provider instructions as written at that commit.
3. Configure service credentials locally or through a protected secret store.
4. Never put credentials in this repository, the public manifest, an issue, or a run receipt.
5. Preserve the source PNG without modification.

Do not invent a command line here. Store the exact command actually used in the run directory after following the selected upstream revision.

## Pilot sources

The separate source package is:

- `Gaussian_Splat_Pilot_Inputs_2026-07-24.zip`
- bytes: `10039366`
- SHA-256: `88fd03de5406eaa78aef99162ef0ad19140da54b6082371189e380fabb14d7b4`

The package contains:

1. `pilot-01-city-and-witnesses.png`
2. `pilot-02-gate-and-figure.png`
3. `pilot-03-monochrome-geometry.png`

Exact source hashes and dimensions are recorded in `manifest.json`.

## Required run record

Create one directory per run:

```text
art/gaussian-splats/runs/<run-id>/
  source.sha256
  generator-repository.txt
  generator-commit.txt
  provider-and-model.json
  parameters.json
  command.txt
  stdout.log
  stderr.log
  scene.spz
  scene.sha256
  observations.md
  disclosure.md
```

The run record must identify:

- the pilot source and its hash;
- the exact generator commit;
- provider and model versions;
- parameters and command;
- timestamp and execution environment;
- output byte size and SHA-256;
- known holes, floating fragments, duplicated forms, invented backsides, and out-of-frame geometry;
- whether the scene demonstrated meaningful parallax and changing occlusion.

## Acceptance boundary

A result is not accepted merely because it resembles a point cloud.

A published pilot must include:

- a loadable spatial artifact, planned as `.spz`;
- meaningful parallax under camera translation;
- depth-dependent occlusion or changing spatial relation;
- the source image shown beside the scene;
- an exact generator and output receipt;
- a written account of inferred geometry and visible failure modes.

A PNG, screenshot, or video may document a scene, but it is not the scene itself.

## Disclosure

These pilots begin from one 2D image. Any output is a generated spatial interpretation, not a scan, photogrammetric capture, or measured reconstruction of a physical place. The canonical artwork remains unchanged.

## Tracking

Generation and review are tracked in repository issue 81.
