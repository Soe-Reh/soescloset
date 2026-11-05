#!/bin/sh
# Reproduce the collection. Picks are frozen in selection.json; 02/03 only regenerate the review sheets used to choose them.
set -e; cd "$(dirname "$0")"
npm install
node 01-feeds.mjs        # public products.json feeds, one store at a time
node 02-candidates.mjs   # pullover-hoodie filter
node 03-sheets.mjs       # thumbnails for eyeballing
node 05-prepare.mjs      # originals -> assets/raw, items.json
node 06-matte.mjs        # model matte -> assets/masks
node 07-refine.mjs       # retouch.mjs, matte, peel of contact shadows and underarm plugs, pen-tool clipping path, hood and hem rail scale, shared grade (grade.mjs), shadow layer, measures
node 08-overlay.mjs      # QA: measure lines over cutouts
node 09-data.mjs         # site/data.json + research/contact.png
node selfcheck.mjs
node qa-scan.mjs        # QA: rim line, notches, spurs, pinholes on every master
node qa-edge.mjs         # QA: whole contour unrolled on white and near-black (sheets/edge-*.png), worst rim cells
