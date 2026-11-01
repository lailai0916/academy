#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess


RELEASE = re.compile(r"\d{8}T\d{6}Z")


def compose_references():
    containers = subprocess.check_output(
        ["docker", "container", "ls", "--all", "--quiet"], text=True
    ).split()
    if not containers:
        return []
    template = (
        '{"files":{{json (index .Config.Labels "com.docker.compose.project.config_files")}},'
        '"directory":{{json (index .Config.Labels "com.docker.compose.project.working_dir")}}}'
    )
    output = subprocess.check_output(
        ["docker", "container", "inspect", "--format", template, *containers], text=True
    )
    paths = []
    for line in output.splitlines():
        labels = json.loads(line)
        paths.extend(filter(None, (labels.get("files") or "").split(",")))
        if labels.get("directory"):
            paths.append(labels["directory"])
    return paths


def protected_releases(root, references):
    releases = (root / "releases").resolve()
    protected = set()
    for name in ("current", "previous"):
        link = root / name
        if not link.is_symlink():
            if name == "current" or link.exists():
                raise ValueError(f"Invalid {name} release pointer")
            continue
        target = link.resolve(strict=True)
        if target.parent != releases or not RELEASE.fullmatch(target.name):
            raise ValueError(f"Invalid {name} release target")
        protected.add(target)
    for reference in references:
        target = Path(reference).resolve()
        if target.is_relative_to(releases):
            relative = target.relative_to(releases)
            if relative.parts:
                protected.add(releases / relative.parts[0])
    return protected


def prune_releases(root, references=compose_references, keep=5, dry_run=False):
    root = Path(root).resolve()
    releases = root / "releases"
    versions = sorted(
        (path for path in releases.iterdir()
         if RELEASE.fullmatch(path.name) and not path.is_symlink() and path.is_dir()),
        key=lambda path: path.name,
        reverse=True,
    )
    removed = []
    for path in versions[keep:]:
        # Recheck live pointers and container references immediately before each removal.
        protected = protected_releases(root, references())
        if path.resolve() in protected:
            continue
        if path.is_symlink() or not path.is_dir() or path.resolve().parent != releases:
            raise ValueError("Release changed during retention check")
        if not dry_run:
            shutil.rmtree(path)
        removed.append(path.name)
    return removed


IMAGE = re.compile(r"academy-api:(\d{8}T\d{6}Z)")


def image_ids(references):
    if not references:
        return {}
    output = subprocess.check_output(
        ["docker", "image", "inspect", "--format", "{{json .Id}}", *references], text=True
    )
    identities = [json.loads(line) for line in output.splitlines()]
    if len(identities) != len(references):
        raise ValueError("Incomplete image metadata")
    return dict(zip(references, identities))


def academy_images():
    output = subprocess.check_output(
        ["docker", "image", "ls", "--filter", "reference=academy-api:*",
         "--format", "{{.Repository}}:{{.Tag}}"], text=True
    )
    return image_ids(sorted({line for line in output.splitlines() if IMAGE.fullmatch(line)}))


def protected_images(root):
    pointers = protected_releases(root, [])
    protected = set(image_ids([f"academy-api:{path.name}" for path in sorted(pointers)]).values())
    containers = subprocess.check_output(
        ["docker", "container", "ls", "--all", "--quiet"], text=True
    ).split()
    if containers:
        template = '{"id":{{json .Image}},"reference":{{json .Config.Image}}}'
        output = subprocess.check_output(
            ["docker", "container", "inspect", "--format", template, *containers], text=True
        )
        records = [json.loads(line) for line in output.splitlines()]
        if len(records) != len(containers):
            raise ValueError("Incomplete container image metadata")
        references = sorted({row["id"] for row in records} |
                            {row["reference"] for row in records if IMAGE.fullmatch(row["reference"])})
        protected.update(image_ids(references).values())
    return protected


def remove_image(reference):
    result = subprocess.run(
        ["docker", "image", "rm", reference], capture_output=True, text=True
    )
    if result.returncode:
        print(f"Kept {reference}; Docker rejected its removal")
    return result.returncode == 0


def prune_images(root, inventory=academy_images, protected=protected_images,
                 remove=remove_image, keep=5, dry_run=False):
    root = Path(root).resolve()
    versions = {reference: identity for reference, identity in inventory().items()
                if IMAGE.fullmatch(reference)}
    removed = []
    for reference, identity in sorted(versions.items()):
        # Resolve aliases and live container references again before each exact tag removal.
        current = {tag: value for tag, value in inventory().items() if IMAGE.fullmatch(tag)}
        newest = sorted(set(current.values()),
                        key=lambda value: max(tag for tag, image in current.items() if image == value),
                        reverse=True)[:keep]
        if current.get(reference) != identity or identity in set(newest) | protected(root):
            continue
        if dry_run or remove(reference):
            removed.append(reference)
    return removed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    arguments = parser.parse_args()
    removed = prune_releases(arguments.root, dry_run=arguments.dry_run)
    images = prune_images(arguments.root, dry_run=arguments.dry_run)
    print(json.dumps({"dry_run": arguments.dry_run, "removed": removed, "images_removed": images}))
