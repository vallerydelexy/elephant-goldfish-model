# Copyright 2026 Google LLC.
# SPDX-License-Identifier: Apache-2.0

"""Guard the Pi manifest against resource collisions that break host sessions."""

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def test_pi_slash_command_names_are_unique() -> None:
  """Templates and extensions must not claim the same /command.

  Pi hosts that validate the command list (Pendant) reject every session with
  "Duplicate named protocol entries are not allowed".
  """
  prompts = {path.stem for path in (ROOT / "prompts").glob("*.md")}
  source = (ROOT / "extensions/index.ts").read_text()
  registered = set(re.findall(r'pi\.registerCommand\(\s*"([^"]+)"', source))
  assert not prompts & registered, f"duplicate /commands: {prompts & registered}"


def test_pi_manifest_publishes_every_resource_root() -> None:
  manifest = json.loads((ROOT / "package.json").read_text())["pi"]
  for key in ("extensions", "skills", "prompts"):
    for entry in manifest[key]:
      root = entry.split("*")[0].rstrip("/")
      assert (ROOT / root).exists(), f"pi.{key} points at missing {root}"
