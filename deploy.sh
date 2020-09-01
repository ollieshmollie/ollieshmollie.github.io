#!/usr/bin/env bash

set -e

bundle exec jekyll clean
bundle exec jekyll build
scp -r _site/* ajbond@people.tamu.edu:public_html/
